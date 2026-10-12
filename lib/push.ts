// Deljeni Web Push sloj - jedno mesto za detekciju platforme i (od)pretplatu.
//
// Koriste ga i NotificationBell (na /rokovi) i NotificationIntro (prvi-put modal),
// da se logika oko dozvola, VAPID-a i service workera ne duplira na dva mesta.
import { subscribeUser, unsubscribeUser, type PushGrupa } from '@/lib/backend'
import { app, saved, session } from '@/lib/storage'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

// Instalirana PWA (home screen). iOS Safari koristi navigator.standalone.
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const maxTouch = navigator.maxTouchPoints ?? 0
  const iosUA = /iPad|iPhone|iPod/.test(ua)
  // Neki Chrome na Mac-u (pogotovo Apple Silicon) vraća maxTouchPoints > 1 iako
  // nema ekran na dodir - trackpad ima "fine" pointer, pravi iPad "coarse".
  const coarsePointer = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const ipadOS = navigator.platform === 'MacIntel' && maxTouch > 1 && coarsePointer
  return (iosUA || ipadOS) && maxTouch > 0
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

// U dev-u na localhost-u nemamo VAPID/Upstash, pa se pravimo da je sve OK
// kako bi se UI mogao pregledati bez pravog push backend-a.
export function isLocalNotificationPreview(): boolean {
  return (
    typeof window !== 'undefined' &&
    process.env.NODE_ENV === 'development' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname)
  )
}

// Trenutna dozvola browsera ('default' | 'granted' | 'denied'); 'default' ako API ne postoji.
export function notificationPermission(): NotificationPermission {
  if (typeof Notification === 'undefined') return 'default'
  return Notification.permission
}

// Registruje SW (idempotentno) i vraća postojeću pretplatu, ako je ima.
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    return await reg.pushManager.getSubscription()
  } catch {
    return null
  }
}

// Studentova godina i grupa: sačuvana, a ako je nema, iz sesije.
function mojaGrupa(): PushGrupa | null {
  const godina = saved.year.get() ?? session.year.get()
  const grupa = saved.group.get() ?? session.group.get()
  return godina && grupa ? { godina, grupa } : null
}
const oznakaGrupe = (g: PushGrupa | null) => (g ? `${g.godina}:${g.grupa}` : '')

export type PushResult = { ok: true } | { ok: false; error: string }

// Traži dozvolu, pretplati se i pošalji pretplatu backend-u.
export async function enablePush(): Promise<PushResult> {
  if (isLocalNotificationPreview()) return { ok: true }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) return { ok: false, error: 'VAPID ključ nije podešen (NEXT_PUBLIC_VAPID_PUBLIC_KEY).' }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { ok: false, error: 'Dozvola za notifikacije je odbijena.' }

    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
    const grupa = mojaGrupa()
    const res = await subscribeUser(JSON.parse(JSON.stringify(sub)), grupa)
    if (!res.success) return { ok: false, error: res.error || 'Greška' }
    app.pushGrupa.set(oznakaGrupe(grupa))
    return { ok: true }
  } catch (e) {
    console.error(e)
    return { ok: false, error: 'Nije uspelo uključivanje notifikacija.' }
  }
}

// Odjavi pretplatu (lokalno + backend).
export async function disablePush(): Promise<PushResult> {
  if (isLocalNotificationPreview()) return { ok: true }

  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await unsubscribeUser(sub.endpoint)
      await sub.unsubscribe()
    }
    app.pushGrupa.remove()
    return { ok: true }
  } catch (e) {
    console.error(e)
    return { ok: false, error: 'Nije uspelo isključivanje.' }
  }
}

// Backend zna grupu pretplatnika, pa notifikacija o izmeni rasporeda stiže samo
// grupama kojima se raspored promenio. Šalje se samo kad se grupa promeni (i
// jednom za pretplate od pre nego što se grupa pamtila).
export async function osveziGrupuPretplate(): Promise<void> {
  if (isLocalNotificationPreview() || notificationPermission() !== 'granted') return
  const grupa = mojaGrupa()
  if (!grupa || app.pushGrupa.get() === oznakaGrupe(grupa)) return
  const sub = await getPushSubscription()
  if (!sub) return
  const res = await subscribeUser(JSON.parse(JSON.stringify(sub)), grupa)
  if (res.success) app.pushGrupa.set(oznakaGrupe(grupa))
}
