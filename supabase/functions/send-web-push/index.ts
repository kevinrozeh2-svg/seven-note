import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || ''
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || ''
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@sevennote.app'

    if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase or VAPID environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const body = await req.json()
    const title = String(body.title || 'Seven Note')
    const message = String(body.body || body.message || 'Nueva notificación')
    const workspaceId = String(body.workspaceId || '')
    const nodeId = String(body.nodeId || '')
    const recipientId = String(body.recipientId || 'all')
    const senderUserId = String(body.senderUserId || '')

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    let query = supabase.from('seven_push_subscriptions').select('*')

    if (recipientId !== 'all') {
      query = query.or(`user_id.eq.${recipientId},member_id.eq.${recipientId}`)
    }

    const { data: subscriptions, error } = await query
    if (error) {
      throw error
    }

    const targets = (subscriptions || []).filter(
      (s) => !senderUserId || s.user_id !== senderUserId
    )

    const payload = JSON.stringify({
      title,
      body: message,
      workspaceId,
      nodeId,
      url: workspaceId ? `/#note=${encodeURIComponent(workspaceId)}` : '/'
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
                auth: sub.auth
              }
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

    return new Response(
      JSON.stringify({ ok: true, sent, cleaned: expiredEndpoints.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
