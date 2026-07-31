// Deljeni Web Push sloj — jedno mesto za detekciju platforme i (od)pretplatu.
//
// Koriste ga i NotificationBell (na /rokovi) i NotificationIntro (prvi-put modal),
// da se logika oko dozvola, VAPID-a i service workera ne duplira na dva mesta.
import { subscribeUser, unsubscribeUser } from '@/app/actions'

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
  const ipadOS = navigator.platform === 'MacIntel' && maxTouch > 1
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
    const res = await subscribeUser(JSON.parse(JSON.stringify(sub)))
    if (!res.success) return { ok: false, error: res.error || 'Greška' }
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
    return { ok: true }
  } catch (e) {
    console.error(e)
    return { ok: false, error: 'Nije uspelo isključivanje.' }
  }
}
