/* Seven Note - Background Web Push Handler (loaded via Workbox importScripts) */

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

  const title = payload.title || 'Seven Note'
  const workspaceId = payload.workspaceId || payload.data?.workspaceId || ''
  const targetUrl = payload.url || (workspaceId ? `/#note=${encodeURIComponent(workspaceId)}` : '/')

  const options = {
    body: payload.body || payload.message || 'Tienes una nueva notificación',
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/pwa-192x192.png',
    tag: payload.tag || (workspaceId ? `seven-note-${workspaceId}` : 'seven-note-push'),
    renotify: true,
    data: {
      url: targetUrl,
      workspaceId,
      nodeId: payload.nodeId || payload.data?.nodeId || '',
      notificationId: payload.notificationId || ''
    }
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data || {}
  const targetUrl = data.url || '/'

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
