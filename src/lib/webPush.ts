import { getSupabaseClient, getAuthUser } from './supabase'
import { getCurrentMember } from './teamAuth'

const VAPID_STORAGE_KEY = 'seven_note_vapid_public_key'

export interface WebPushStatus {
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  subscribed: boolean
  endpoint: string | null
  vapidKey: string
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const outputArray = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

async function hashEndpoint(endpoint: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(endpoint)
    const digest = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 40)
  } catch {
    return btoa(endpoint).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)
  }
}

export function getConfiguredVapidPublicKey(): string {
  const envKey = (import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim()
  if (envKey) return envKey
  if (typeof window !== 'undefined') {
    return (localStorage.getItem(VAPID_STORAGE_KEY) || '').trim()
  }
  return ''
}

export function saveVapidPublicKey(key: string): void {
  if (typeof window === 'undefined') return
  const cleaned = key.trim()
  if (cleaned) {
    localStorage.setItem(VAPID_STORAGE_KEY, cleaned)
  } else {
    localStorage.removeItem(VAPID_STORAGE_KEY)
  }
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function getWebPushStatus(): Promise<WebPushStatus> {
  const vapidKey = getConfiguredVapidPublicKey()
  if (!isWebPushSupported()) {
    return {
      supported: false,
      permission: 'unsupported',
      subscribed: false,
      endpoint: null,
      vapidKey
    }
  }

  const permission = Notification.permission
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    const sub = registration ? await registration.pushManager.getSubscription() : null
    return {
      supported: true,
      permission,
      subscribed: Boolean(sub),
      endpoint: sub?.endpoint || null,
      vapidKey
    }
  } catch {
    return {
      supported: true,
      permission,
      subscribed: false,
      endpoint: null,
      vapidKey
    }
  }
}

export async function subscribeToWebPush(explicitVapidKey?: string): Promise<{
  success: boolean
  message: string
}> {
  if (!isWebPushSupported()) {
    return { success: false, message: 'Tu navegador no soporta Web Push en segundo plano.' }
  }

  const vapidKey = (explicitVapidKey ?? getConfiguredVapidPublicKey()).trim()
  if (!vapidKey) {
    return {
      success: false,
      message: 'Falta la clave pública VAPID (VITE_VAPID_PUBLIC_KEY).'
    }
  }
  if (explicitVapidKey) {
    saveVapidPublicKey(vapidKey)
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return {
      success: false,
      message: 'Debes conceder permiso de notificaciones en tu navegador.'
    }
  }

  let registration = await navigator.serviceWorker.getRegistration()
  if (!registration) {
    return {
      success: false,
      message: 'Service Worker no activo (en desarrollo usa build/preview o producción HTTPS).'
    }
  }
  registration = await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey)
    })
  }

  const json = subscription.toJSON()
  const p256dh = json.keys?.p256dh || ''
  const auth = json.keys?.auth || ''
  if (!subscription.endpoint || !p256dh || !auth) {
    return { success: false, message: 'Suscripción push incompleta generada por el navegador.' }
  }

  const supabase = getSupabaseClient()
  const authUser = await getAuthUser()
  if (supabase && authUser) {
    const member = getCurrentMember()
    const id = await hashEndpoint(subscription.endpoint)
    const now = Date.now()
    const { error } = await supabase.from('seven_push_subscriptions').upsert(
      {
        id,
        user_id: authUser.id,
        member_id: member?.id || null,
        endpoint: subscription.endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent.slice(0, 200),
        created_at: now,
        updated_at: now
      },
      { onConflict: 'endpoint' }
    )
    if (error) {
      return {
        success: false,
        message: `Suscrito localmente, pero falló guardar en Supabase: ${error.message}`
      }
    }
  }

  return {
    success: true,
    message: 'Push en segundo plano activado. Recibirás alertas aunque la web esté cerrada.'
  }
}

export async function unsubscribeFromWebPush(): Promise<{ success: boolean; message: string }> {
  if (!isWebPushSupported()) {
    return { success: false, message: 'Web Push no soportado.' }
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    const sub = registration ? await registration.pushManager.getSubscription() : null
    const endpoint = sub?.endpoint
    if (sub) {
      await sub.unsubscribe()
    }
    if (endpoint) {
      const supabase = getSupabaseClient()
      if (supabase) {
        await supabase.from('seven_push_subscriptions').delete().eq('endpoint', endpoint)
      }
    }
    return { success: true, message: 'Push en segundo plano desactivado en este dispositivo.' }
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'No se pudo cancelar la suscripción.'
    }
  }
}

export async function triggerRemoteWebPush(params: {
  title: string
  message: string
  workspaceId?: string
  nodeId?: string
  recipientId?: string
}): Promise<void> {
  try {
    const supabase = getSupabaseClient()
    const authUser = await getAuthUser()
    if (!supabase || !authUser) return

    await supabase.functions.invoke('send-web-push', {
      body: {
        title: params.title,
        body: params.message,
        workspaceId: params.workspaceId || '',
        nodeId: params.nodeId || '',
        recipientId: params.recipientId || 'all',
        senderUserId: authUser.id
      }
    })
  } catch {
    // Silencioso si la Edge Function aún no está desplegada
  }
}
