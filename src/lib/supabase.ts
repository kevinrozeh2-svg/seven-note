import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { type UserProfile, type UserRole, type UserStatus, isAuthorizedAdminEmail } from './teamAuth'

export interface SupabaseConfig {
  url: string
  anonKey: string
  enabled: boolean
}

export interface TeamInvitation {
  id: string
  email: string
  role: UserRole
  invited_by?: string
  created_at: number
}

const STORAGE_KEY = 'seven_note_supabase_config'

export function getStoredSupabaseConfig(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        url: parsed.url || '',
        anonKey: parsed.anonKey || '',
        enabled: Boolean(parsed.enabled)
      }
    }
  } catch (e) {
    console.error('Error reading Supabase config from storage', e)
  }

  // Fallback to environment variables if provided
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || ''
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || ''

  return {
    url: envUrl,
    anonKey: envKey,
    enabled: Boolean(envUrl && envKey)
  }
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  cachedClient = null // Reset cached client
}

export function isSupabaseConfigured(): boolean {
  const config = getStoredSupabaseConfig()
  return Boolean(config.enabled && config.url && config.anonKey)
}

let cachedClient: SupabaseClient | null = null

/**
 * Normaliza `expires_at` en respuestas de Supabase Auth usando el reloj local (`Date.now()`)
 * sumado al `expires_in` relativo del servidor. Esto evita bucles infinitos de refresh_token
 * (y el consecuente error 429 + cierre de sesión) cuando el reloj del PC o móvil del usuario
 * está adelantado o atrasado respecto a la hora UTC del servidor.
 */
function normalizeAuthSessionExpiry(payload: any, nowSec: number): boolean {
  if (!payload || typeof payload !== 'object') return false
  let modified = false

  if (
    typeof payload.access_token === 'string' &&
    typeof payload.expires_in === 'number' &&
    Number.isFinite(payload.expires_in) &&
    payload.expires_in > 0
  ) {
    payload.expires_at = nowSec + Math.round(payload.expires_in)
    modified = true
  }

  if (payload.session && typeof payload.session === 'object') {
    if (normalizeAuthSessionExpiry(payload.session, nowSec)) {
      modified = true
    }
  }

  return modified
}

const clockSkewSafeFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init)

  try {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url

    if (
      response.ok &&
      url.includes('/auth/v1/') &&
      (response.headers.get('content-type') || '').includes('application/json')
    ) {
      const cloned = response.clone()
      const data = await cloned.json()
      const nowSec = Math.floor(Date.now() / 1000)

      if (normalizeAuthSessionExpiry(data, nowSec)) {
        const headers = new Headers(response.headers)
        headers.delete('content-length')
        return new Response(JSON.stringify(data), {
          status: response.status,
          statusText: response.statusText,
          headers
        })
      }
    }
  } catch {
    // Si la respuesta no es JSON válido, devolver la respuesta original sin modificar
  }

  return response
}

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient

  const config = getStoredSupabaseConfig()
  if (!config.enabled || !config.url || !config.anonKey) {
    return null
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      global: {
        fetch: clockSkewSafeFetch
      }
    })
    return cachedClient
  } catch (err) {
    console.error('Failed to create Supabase client:', err)
    return null
  }
}

export async function testSupabaseConnection(url: string, anonKey: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!url || !anonKey) {
      return { success: false, message: 'URL y Anon Key son obligatorios' }
    }
    const testClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })
    // Check if we can reach the health or query workspaces table
    const { error } = await testClient.from('seven_workspaces').select('id').limit(1)
    if (error) {
      if (error.code === '42P01') {
        return { 
          success: true, 
          message: 'Conectado a Supabase, pero falta ejecutar el esquema SQL.' 
        }
      }
      return { success: false, message: `Error de Supabase: ${error.message}` }
    }
    return { success: true, message: '¡Conexión exitosa con Supabase!' }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error al conectar con Supabase' }
  }
}

// ==========================================
// SUPABASE AUTHENTICATION HELPERS
// ==========================================

export async function signInUser(email: string, password: string) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { data: null, error: new Error('Supabase no está configurado o habilitado.') }
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password
  })
  return { data, error }
}

export async function signUpUser(email: string, password: string, fullName?: string) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { data: null, error: new Error('Supabase no está configurado o habilitado.') }
  }
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        full_name: fullName || email.split('@')[0]
      }
    }
  })
  return { data, error }
}

export async function resetPasswordForEmail(email: string, redirectTo?: string) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { data: null, error: new Error('Supabase no está configurado o habilitado.') }
  }
  const redirect = redirectTo || (typeof window !== 'undefined' ? window.location.origin : undefined)
  const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: redirect
  })
  return { data, error }
}

export async function updateUserPassword(newPassword: string) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { data: null, error: new Error('Supabase no está configurado o habilitado.') }
  }
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  })
  return { data, error }
}

export async function signOutUser() {
  const supabase = getSupabaseClient()
  if (!supabase) return { error: null }
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getAuthUser() {
  const supabase = getSupabaseClient()
  if (!supabase) return null
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    if (sessionData?.session?.user) {
      return sessionData.session.user
    }
    const { data: { user }, error } = await supabase.auth.getUser()
    if (user) return user
    if (error && (error.status === 401 || error.status === 403)) {
      return null
    }
    return null
  } catch {
    return null
  }
}

export function onAuthChange(callback: (event: string, session: any) => void) {
  const supabase = getSupabaseClient()
  if (!supabase) return () => {}
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session)
  })
  return () => subscription.unsubscribe()
}

// ==========================================
// USER PROFILES & TEAM MANAGEMENT HELPERS
// ==========================================

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = getSupabaseClient()
  if (!supabase || !userId) return null

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || !data) return null

    const isAuthorized = isAuthorizedAdminEmail(data.email)
    const role: UserRole = isAuthorized ? 'admin' : (data.role || 'member')

    // Si el correo está autorizado como admin pero en la BD aún figuraba como member, sincronizar en BD
    if (isAuthorized && data.role !== 'admin') {
      supabase.from('user_profiles').update({ role: 'admin' }).eq('id', userId).then()
    }

    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name || '',
      avatarUrl: data.avatar_url,
      color: data.color || '#2563eb',
      initial: (data.full_name || data.email || 'U').charAt(0).toUpperCase(),
      role: role,
      status: data.status || 'active',
      createdAt: data.created_at,
      updatedAt: data.updated_at
    }
  } catch (e) {
    console.warn('Error fetching user profile:', e)
    return null
  }
}

export async function updateUserProfile(
  userId: string,
  updates: { fullName?: string; color?: string; avatarUrl?: string | null; email?: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient()
  if (!supabase || !userId) return { success: false, error: 'No conectado' }

  try {
    const now = Date.now()
    const payload: Record<string, any> = {
      updated_at: now
    }
    if (updates.fullName !== undefined) payload.full_name = updates.fullName
    if (updates.color !== undefined) payload.color = updates.color
    if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl ?? ''

    // Verificar que realmente se actualizó una fila (evita fallos silenciosos cuando falta la fila en user_profiles)
    const { data: updatedRows, error: updateError } = await supabase
      .from('user_profiles')
      .update(payload)
      .eq('id', userId)
      .select('id')

    if (updateError) throw updateError

    if (!updatedRows || updatedRows.length === 0) {
      const authUser = await getAuthUser()
      const resolvedEmail = (updates.email || authUser?.email || '').trim().toLowerCase()
      if (!resolvedEmail) {
        return {
          success: false,
          error: 'No se encontró tu registro de perfil en Supabase. Cierra sesión y vuelve a entrar.'
        }
      }

      const { data: upsertedRows, error: upsertError } = await supabase
        .from('user_profiles')
        .upsert(
          {
            id: userId,
            email: resolvedEmail,
            full_name: updates.fullName ?? authUser?.user_metadata?.full_name ?? resolvedEmail.split('@')[0],
            color: updates.color ?? '#2563eb',
            avatar_url: updates.avatarUrl ?? '',
            updated_at: now
          },
          { onConflict: 'id' }
        )
        .select('id')

      if (upsertError) throw upsertError
      if (!upsertedRows || upsertedRows.length === 0) {
        return {
          success: false,
          error: 'No se pudo guardar el perfil por permisos de base de datos (RLS).'
        }
      }
    }

    // Sincronizar metadatos ligeros en Supabase Auth (nunca guardar data: URIs grandes en el JWT)
    const authData: Record<string, any> = {}
    if (updates.fullName !== undefined) {
      authData.full_name = updates.fullName
    }
    if (updates.avatarUrl !== undefined) {
      const url = (updates.avatarUrl || '').trim()
      if (!url) {
        authData.avatar_url = null
      } else if (/^https?:\/\//i.test(url) && url.length <= 512) {
        authData.avatar_url = url
      }
    }

    if (Object.keys(authData).length > 0) {
      const { error: authErr } = await supabase.auth.updateUser({ data: authData })
      if (authErr) {
        console.warn('No se pudieron sincronizar metadatos de auth (perfil guardado en BD):', authErr)
      }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al actualizar perfil' }
  }
}

export async function fetchAllProfiles(): Promise<UserProfile[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: true })

    if (error || !data) return []

    return data.map((d: any) => {
      const isAuthorized = isAuthorizedAdminEmail(d.email)
      return {
        id: d.id,
        email: d.email,
        fullName: d.full_name || '',
        avatarUrl: d.avatar_url,
        color: d.color || '#2563eb',
        initial: (d.full_name || d.email || 'U').charAt(0).toUpperCase(),
        role: isAuthorized ? 'admin' : (d.role || 'member'),
        status: d.status || 'active',
        createdAt: d.created_at,
        updatedAt: d.updated_at
      }
    })
  } catch (e) {
    console.warn('Error fetching all profiles:', e)
    return []
  }
}

export async function updateMemberRoleAndStatus(
  userId: string,
  role: UserRole,
  status: UserStatus
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient()
  if (!supabase || !userId) return { success: false, error: 'No conectado' }

  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        role,
        status,
        updated_at: Date.now()
      })
      .eq('id', userId)

    if (error) throw error
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al cambiar rol' }
  }
}

export async function fetchInvitations(): Promise<TeamInvitation[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  try {
    const { data, error } = await supabase
      .from('team_invitations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

export async function createInvitation(email: string, role: UserRole): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient()
  if (!supabase) return { success: false, error: 'No conectado' }

  try {
    const { error } = await supabase
      .from('team_invitations')
      .insert({
        email: email.trim().toLowerCase(),
        role,
        created_at: Date.now()
      })

    if (error) throw error
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al crear invitación' }
  }
}

export async function deleteInvitation(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient()
  if (!supabase) return { success: false, error: 'No conectado' }

  try {
    const { error } = await supabase
      .from('team_invitations')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al eliminar invitación' }
  }
}
