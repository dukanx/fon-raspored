// TOMBSTONE — kill-switch nivo 1 za offline keš.
//
// KAKO SE KORISTI: `cp docs/sw-tombstone.js public/sw.js` pa deploy.
//
// Zašto radi: next.config.ts servira /sw.js kao `no-cache, no-store,
// must-revalidate`, obe registracije koriste `updateViaCache: 'none'`, a fetch
// samog SW skripta UVEK zaobilazi service worker — pokvaren `fetch` handler ne
// može da spreči sopstvenu zamenu. Svaki korisnik ovo pokupi na sledećoj
// navigaciji (ili na sledeći fokus taba, zbog reg.update() u providers.tsx).
//
// Bez `fetch` listenera SW postaje čist pass-through i app se ponaša tačno kao
// pre uvođenja keširanja.
//
// KRITIČNO: NE zovemo registration.unregister(). To bi oborilo PushSubscription
// svim pretplatnicima i tiho im ubilo notifikacije — gore od buga koji se
// popravlja. Zato push handleri ostaju doslovno isti.

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.filter(k => k.startsWith('fon-')).map(k => caches.delete(k)))
    } catch { }
    await self.clients.claim()
  })())
})

/* ---------------- Web Push — doslovno kao u public/sw.js ---------------- */

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
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl).catch(() => { })
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl)
    })
  )
})
