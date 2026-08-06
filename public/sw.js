// Service worker za FON Raspored — Web Push notifikacije + offline keš.
// Radi na Androidu, desktopu i iOS-u (16.4+) kad je aplikacija dodata na home screen.
//
// TRI PRAVILA KOJA SE NE KRŠE:
//
// 1. `install` NIKAD ne sme da baci. Ako precache padne, SW mora svejedno da se
//    instalira — u suprotnom registracija nema aktivnog workera i PUSH PRESTAJE
//    DA RADI. Svaki korak je zasebno try/catch-ovan.
//
// 2. /data/*.json ide NETWORK-FIRST, keš se čita SAMO kad mreža stvarno padne.
//    Razlog: lib/semester.ts -> reconcileSemester() poredi `semester` string iz
//    god.json sa localStorage-om i na svaku razliku BRIŠE korisnikov izbor
//    predmeta. Stale-while-revalidate bi serviranjem starog god.json obrisao
//    korisničke podatke. Online ponašanje mora ostati identično današnjem.
//
// 3. RSC (flight) zahteve NE PRESREĆEMO uopšte. Keširanje po URL-u je NETAČNO,
//    ne samo rizično: FLIGHT_HEADERS uključuje `next-router-state-tree`, pa
//    odgovor za /rokovi zavisi od toga odakle se navigira — isti URL ima više
//    različitih ispravnih odgovora. Nije ni potrebno: Next 16 na grešku mreže
//    sam radi MPA (hard) navigaciju (ppr-navigations.js:919), koju onda uhvati
//    navigation handler ispod i servira keširan HTML.

const VERSION = 'v1' // ručni sledgehammer — ne treba dizati na svaki deploy

const SHELL = `fon-shell-${VERSION}`   // HTML ljuska      — network-first
const STATIC = `fon-static-${VERSION}` // /_next/static/*  — cache-first (hashovano)
const DATA = 'fon-data'                // /data/*.json     — network-first (BEZ verzije)
const ASSETS = 'fon-assets'            // ikonice/manifest — SWR          (BEZ verzije)

// Rute čiji se HTML sme keširati. Ključ je uvek pathname bez query stringa —
// /deli?s=... je statičan HTML koji query čita tek na klijentu, pa jedan unos
// pokriva sve podeljene linkove.
const SHELL_ROUTES = ['/', '/raspored', '/rokovi', '/preneseni', '/izborni', '/deli']

const PRECACHE_ASSETS = [
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-icon2.png',
  '/favicon.ico',
  '/sun.png',
  '/moon.png',
]

// ~380 KB. Precache-ujemo sve četiri godine jer install nema pristup
// localStorage-u pa ne zna koja je korisnikova. Bez ovoga garancija "posle
// JEDNE online posete radi offline" ne stoji: na prvoj poseti SW se aktivira
// paralelno sa fetch-evima stranice i ne stigne uvek da ih presretne.
// god-zimski/god-letnji se NE precache-uju — lenjo se učitavaju i već imaju
// .catch (izborni/page.tsx, lib/schedule.ts).
const PRECACHE_DATA = [
  '/data/rokovi.json',
  '/data/subjects-meta.json',
  '/data/1god.json',
  '/data/2god.json',
  '/data/3god.json',
  '/data/4god.json',
]

// Turbopack imena chunk-ova sadrže ~ . - _ , a u inline flight payload-u su
// escape-ovana ("...js\"), pa se sidrimo na ekstenziju umesto na navodnik.
const NEXT_ASSET_RE = /\/_next\/static\/[A-Za-z0-9._~/-]+?\.(?:js|css|woff2?|png|svg)/g

const IMAGE_RE = /\.(?:png|jpe?g|svg|ico|webp|woff2?)$/

const OFFLINE_HTML = `<!doctype html><html lang="sr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FON Raspored</title>
<style>html,body{height:100%;margin:0}body{display:grid;place-items:center;
font:15px/1.5 system-ui,sans-serif;background:#f6f8fa;color:#1f2937}
@media(prefers-color-scheme:dark){body{background:#0b1220;color:#e5e7eb}}
a{display:inline-block;margin-top:16px;padding:8px 16px;border-radius:10px;
background:#024c7d;color:#fff;text-decoration:none;font-size:13px}</style></head>
<body><div style="text-align:center"><p>Nema interneta</p>
<a href="/raspored">Raspored</a></div></body></html>`

/* ------------------------------------------------------------------ */
/* Precache                                                            */
/* ------------------------------------------------------------------ */

// Vraća true samo ako je CELA ljuska (HTML + svi njeni chunk-ovi) sačuvana.
// Ta vrednost gejtuje brisanje starih keševa u `activate`.
async function precache() {
  let ok = true
  const assetUrls = new Set()

  // 1. HTML ljuska + izvlačenje hashovanih chunk-ova iz same stranice.
  //    (Nema stabilnog javnog build manifesta u App Routeru, pa parsiramo HTML.)
  const shell = await caches.open(SHELL)
  for (const route of SHELL_ROUTES) {
    try {
      const res = await fetch(route, { cache: 'reload' })
      if (!res.ok) { ok = false; continue }
      const html = await res.clone().text()
      await shell.put(route, res)
      for (const m of html.matchAll(NEXT_ASSET_RE)) assetUrls.add(m[0])
    } catch { ok = false }
  }

  // 2. Hashovani statički resursi — bez njih je keširan HTML beo ekran.
  const staticCache = await caches.open(STATIC)
  for (const url of assetUrls) {
    try {
      if (await staticCache.match(url)) continue
      const res = await fetch(url, { cache: 'reload' })
      if (!res.ok) { ok = false; continue }
      await staticCache.put(url, res)
    } catch { ok = false }
  }

  // 3. Ikonice i podaci — best effort, ne obaraju `ok`.
  const assets = await caches.open(ASSETS)
  await Promise.all(PRECACHE_ASSETS.map(async (url) => {
    try {
      const res = await fetch(url, { cache: 'reload' })
      if (res.ok) await assets.put(url, res)
    } catch { }
  }))

  const data = await caches.open(DATA)
  await Promise.all(PRECACHE_DATA.map(async (url) => {
    try {
      const res = await fetch(url, { cache: 'reload' })
      if (res.ok) await data.put(url, res)
    } catch { }
  }))

  return ok
}

// Modul-scope: preživljava install -> activate u istoj instanci workera.
// Ako browser ubije worker između to dvoje, ostaje false i samo preskočimo
// čišćenje — bezbedan default (stari keš ostaje, sledeći activate ga počisti).
let precacheComplete = false

self.addEventListener('install', (event) => {
  self.skipWaiting()
  // .catch(() => {}) je OBAVEZAN — v. pravilo 1 na vrhu fajla.
  event.waitUntil(
    precache().then((ok) => { precacheComplete = ok }).catch(() => { })
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      // Brišemo staru generaciju SAMO ako je nova kompletna. Kod delimičnog
      // precache-a (mrežni prekid usred activate) korisnik zadržava prethodnu
      // kompletnu i međusobno konzistentnu generaciju — inače bi ostao sa
      // HTML-om čiji chunk-ovi 404-uju, tj. beo ekran offline.
      if (precacheComplete) {
        const keep = [SHELL, STATIC, DATA, ASSETS]
        const keys = await caches.keys()
        await Promise.all(
          keys.filter(k => k.startsWith('fon-') && !keep.includes(k))
            .map(k => caches.delete(k))
        )
      }
    } catch { }
    await self.clients.claim()
  })())
})

/* ------------------------------------------------------------------ */
/* Strategije                                                          */
/* ------------------------------------------------------------------ */
// Napomena: `event.waitUntil` se svuda zove PRE nego što se respondWith
// promise reši — posle toga baca InvalidStateError.

async function cacheFirst(event, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(event.request)
  if (hit) return hit
  const res = await fetch(event.request) // offline + promašaj = ista greška kao bez SW-a
  if (res.ok) event.waitUntil(cache.put(event.request, res.clone()))
  return res
}

async function networkFirst(event, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(event.request)
    if (res.ok) event.waitUntil(cache.put(event.request, res.clone()))
    return res
  } catch {
    const hit = await cache.match(event.request)
    // Response.error() => fetch() na klijentu ODBIJA, tačno kao offline bez SW-a.
    // NE vraćamo lažni 503-JSON jer neki pozivi rade r.json() bez provere r.ok.
    return hit || Response.error()
  }
}

async function staleWhileRevalidate(event, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(event.request)
  const network = fetch(event.request)
    .then(async (res) => { if (res.ok) await cache.put(event.request, res.clone()); return res })
    .catch(() => null)
  if (hit) { event.waitUntil(network); return hit }
  return (await network) || Response.error()
}

function shellKey(url) {
  let p = url.pathname
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return SHELL_ROUTES.includes(p) ? p : null
}

async function handleNavigate(event) {
  const key = shellKey(new URL(event.request.url))
  const cache = await caches.open(SHELL)
  try {
    // NETWORK-FIRST: online uvek sveži HTML, nikad zaključavanje na stari build.
    // Bez timeout-a — fallback samo kad mreža stvarno pukne.
    const res = await fetch(event.request)
    const ct = res.headers.get('content-type') || ''
    if (res.ok && key && ct.includes('text/html')) {
      event.waitUntil(cache.put(key, res.clone()))
    }
    return res
  } catch {
    const hit = key ? await cache.match(key) : null
    if (hit) return hit
    return new Response(OFFLINE_HTML, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}

/* ------------------------------------------------------------------ */
/* Fetch router                                                        */
/* ------------------------------------------------------------------ */

self.addEventListener('fetch', (event) => {
  const req = event.request

  // --- Šta NAMERNO ne diramo (default browser ponašanje) ---
  if (req.method !== 'GET') return     // POST /api/preneseni, Server Actions
  if (req.headers.has('range')) return // parcijalni zahtevi (media)

  let url
  try { url = new URL(req.url) } catch { return }
  if (url.origin !== self.location.origin) return                   // cross-origin
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return // chrome-extension: itd.

  // RSC / flight — v. pravilo 3 na vrhu fajla.
  if (req.headers.has('rsc') || url.searchParams.has('_rsc')) return

  const p = url.pathname
  if (p.startsWith('/api/')) return     // Groq proxy — nema smisla keširati
  if (p.startsWith('/_vercel/')) return // Vercel Analytics (isti origin!)
  if (p.startsWith('/__next')) return   // dev/HMR endpointi
  if (p === '/sw.js') return            // nikad ne keširaj samog sebe

  // --- Rutiranje ---
  if (req.mode === 'navigate') {
    event.respondWith(handleNavigate(event))
    return
  }
  if (p.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(event, STATIC)) // content-hashed => immutable
    return
  }
  if (p.startsWith('/data/') && p.endsWith('.json')) {
    event.respondWith(networkFirst(event, DATA)) // pravilo 2
    return
  }
  if (p === '/manifest.webmanifest' || IMAGE_RE.test(p)) {
    event.respondWith(staleWhileRevalidate(event, ASSETS))
    return
  }
  // sve ostalo: ne presrećemo
})

/* ------------------------------------------------------------------ */
/* Poruke sa stranice                                                  */
/* ------------------------------------------------------------------ */

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type
  if (type === 'SKIP_WAITING') self.skipWaiting()
  if (type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k.startsWith('fon-')).map(k => caches.delete(k)))
      )
    )
  }
})

/* ------------------------------------------------------------------ */
/* Web Push — NEPROMENJENO                                             */
/* ------------------------------------------------------------------ */

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
          client.navigate(targetUrl).catch(() => { })
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl)
    })
  )
})
