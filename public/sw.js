// Service worker za FON Raspored — Web Push notifikacije.
// Radi na Androidu, desktopu i iOS-u (16.4+) kad je aplikacija dodata na home screen.

self.addEventListener('push', function (event) {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'FON Raspored', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'FON Raspored'
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    tag: data.tag || undefined,
    data: {
      url: data.url || '/rokovi',
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/rokovi'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Ako je tab već otvoren, fokusiraj ga umesto otvaranja novog.
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl).catch(() => {})
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl)
    })
  )
})
