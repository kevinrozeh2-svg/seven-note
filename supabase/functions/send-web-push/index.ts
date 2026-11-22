import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || ''
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || ''
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@sevennote.app'

    if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
      return jsonResponse({ error: 'Push service not configured' }, 500)
    }

    // 1. Require and verify Supabase Auth JWT
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : ''

    if (!token) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: userData, error: authError } = await supabase.auth.getUser(token)
    const authUser = userData?.user

    if (authError || !authUser) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    // 2. Verify caller is an active member in user_profiles
    const { data: callerProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, status, role')
      .eq('id', authUser.id)
      .single()

    if (profileError || !callerProfile || callerProfile.status !== 'active') {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    // 3. Parse and strictly validate payload
    const body = await req.json()
    const title = String(body?.title || 'Seven Note').replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 120)
    const message = String(body?.body || body?.message || 'Nueva notificación')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .slice(0, 400)

    const rawWorkspaceId = String(body?.workspaceId || '').trim()
    const rawNodeId = String(body?.nodeId || '').trim()
    const workspaceId = SAFE_ID_REGEX.test(rawWorkspaceId) ? rawWorkspaceId : ''
    const nodeId = SAFE_ID_REGEX.test(rawNodeId) ? rawNodeId : ''

    const recipientId = String(body?.recipientId || 'all').trim()
    if (recipientId !== 'all' && !SAFE_ID_REGEX.test(recipientId)) {
      return jsonResponse({ error: 'Invalid recipientId' }, 400)
    }

    // Always derive senderUserId from verified JWT (never trust request body)
    const senderUserId = authUser.id

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    // 4. Query subscriptions safely without PostgREST filter injection
    let subscriptions: Array<{
      endpoint: string
      p256dh: string
      auth: string
      user_id: string | null
    }> = []

    if (recipientId === 'all') {
      const { data, error } = await supabase
        .from('seven_push_subscriptions')
        .select('endpoint, p256dh, auth, user_id')
      if (error) throw error
      subscriptions = data || []
    } else if (UUID_REGEX.test(recipientId)) {
      const { data, error } = await supabase
        .from('seven_push_subscriptions')
        .select('endpoint, p256dh, auth, user_id')
        .eq('user_id', recipientId)
      if (error) throw error
      subscriptions = data || []
    } else {
      const { data, error } = await supabase
        .from('seven_push_subscriptions')
        .select('endpoint, p256dh, auth, user_id')
        .eq('member_id', recipientId)
      if (error) throw error
      subscriptions = data || []
    }

    const targets = subscriptions.filter((s) => s.user_id !== senderUserId)

    const payload = JSON.stringify({
      title,
      body: message,
      workspaceId,
      nodeId,
      url: workspaceId ? `/#note=${encodeURIComponent(workspaceId)}` : '/',
    })

    let sent = 0
    const expiredEndpoints: string[] = []

    await Promise.all(
      targets.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload
          )
          sent++
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number })?.statusCode
          if (statusCode === 404 || statusCode === 410) {
            expiredEndpoints.push(sub.endpoint)
          }
        }
      })
    )

    if (expiredEndpoints.length > 0) {
      await supabase
        .from('seven_push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints)
    }

    return jsonResponse({ ok: true, sent, cleaned: expiredEndpoints.length })
  } catch {
    return jsonResponse({ error: 'Failed to send web push notification' }, 500)
  }
})
