/* Seven Note - Background Web Push Handler (loaded via Workbox importScripts) */

function toSafeNotificationUrl(rawUrl, fallbackWorkspaceId) {
  const fallback = fallbackWorkspaceId
    ? `/#note=${encodeURIComponent(String(fallbackWorkspaceId))}`
    : '/'
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return fallback
  }
  try {
    const resolved = new URL(rawUrl, self.location.origin)
    if (resolved.origin !== self.location.origin) {
      return fallback
    }
    if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') {
      return fallback
    }
    return resolved.pathname + resolved.search + resolved.hash
  } catch {
    return fallback
  }
}

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = {
      title: 'Seven Note',
      body: event.data.text()
    }
  }

  const title = String(payload.title || 'Seven Note').slice(0, 120)
  const workspaceId = String(payload.workspaceId || payload.data?.workspaceId || '').slice(0, 128)
  const targetUrl = toSafeNotificationUrl(payload.url, workspaceId)

  const options = {
    body: String(payload.body || payload.message || 'Tienes una nueva notificación').slice(0, 400),
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.tag || (workspaceId ? `seven-note-${workspaceId}` : 'seven-note-push'),
    renotify: true,
    data: {
      url: targetUrl,
      workspaceId,
      nodeId: String(payload.nodeId || payload.data?.nodeId || '').slice(0, 128),
      notificationId: String(payload.notificationId || '').slice(0, 128)
    }
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data || {}
  const targetUrl = toSafeNotificationUrl(data.url, data.workspaceId)

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          client.postMessage({
            type: 'SEVEN_NOTE_PUSH_NAVIGATE',
            workspaceId: data.workspaceId || '',
            nodeId: data.nodeId || '',
            url: targetUrl
          })
          return
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})
