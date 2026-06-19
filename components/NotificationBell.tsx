'use client'

import { useEffect, useState } from 'react'
import { subscribeUser, unsubscribeUser } from '@/app/actions'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

function isLocalNotificationPreview() {
  return (
    typeof window !== 'undefined' &&
    process.env.NODE_ENV === 'development' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname)
  )
}

export default function NotificationBell({ className = 'mt-3' }: { className?: string }) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(true)
  const [showIOSModal, setShowIOSModal] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    const platform = navigator.platform
    const maxTouchPoints = navigator.maxTouchPoints ?? 0
    const localPreview = isLocalNotificationPreview()
    const iosUA = /iPad|iPhone|iPod/.test(ua)
    const ipadOS = platform === 'MacIntel' && maxTouchPoints > 1
    const ios = (iosUA || ipadOS) && maxTouchPoints > 0
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari koristi navigator.standalone
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    setIsIOS(ios)
    setIsStandalone(standalone)

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setSupported(true)
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setSubscribed(localPreview || !!sub))
        .catch(() => setSupported(false))
    } else {
      setSupported(false)
    }
  }, [])

  async function enable() {
    setBusy(true)
    setError(null)
    try {
      if (isLocalNotificationPreview()) {
        setSubscribed(true)
        return
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        setError('VAPID ključ nije podešen (NEXT_PUBLIC_VAPID_PUBLIC_KEY).')
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('Dozvola za notifikacije je odbijena.')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      const res = await subscribeUser(JSON.parse(JSON.stringify(sub)))
      if (!res.success) throw new Error(res.error || 'Greška')
      setSubscribed(true)
    } catch (e) {
      console.error(e)
      setError('Nije uspelo uključivanje notifikacija.')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    setError(null)
    try {
      if (isLocalNotificationPreview()) {
        setSubscribed(false)
        setShowInfo(false)
        return
      }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await unsubscribeUser(sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
      setShowInfo(false)
    } catch (e) {
      console.error(e)
      setError('Nije uspelo isključivanje.')
    } finally {
      setBusy(false)
    }
  }

  if (supported === null) return null

  const bellOutline = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  )
  const bellFilled = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a6 6 0 0 0-6 6v.75a8.967 8.967 0 0 1-2.312 6.022.75.75 0 0 0 .37 1.244 23.85 23.85 0 0 0 4.412.927 3.5 3.5 0 0 0 6.86 0 23.85 23.85 0 0 0 4.412-.927.75.75 0 0 0 .37-1.244A8.967 8.967 0 0 1 18 8.75V8a6 6 0 0 0-6-6Zm0 19a2 2 0 0 1-1.94-1.515 24.3 24.3 0 0 0 3.88 0A2 2 0 0 1 12 21Z" />
    </svg>
  )
  const infoIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  )
  const offBtnClass =
    'liquid-glass inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-white/80 dark:text-gray-300 dark:hover:bg-gray-800/70 sm:px-3'

  // iOS pre instalacije: dugme otvara uputstvo (Web Push radi tek iz home screen-a).
  if (isIOS && !isStandalone) {
    return (
      <div className={className}>
        <button onClick={() => setShowIOSModal(true)} className={offBtnClass}>
          {bellOutline}
          Uključi notifikacije
        </button>

        {showIOSModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => setShowIOSModal(false)}
          >
            <div
              className="w-full max-w-xs rounded-2xl border border-white/75 bg-white/92 p-5 shadow-xl backdrop-blur-2xl dark:border-white/15 dark:bg-gray-900/90"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-1.5">
                {bellOutline} Notifikacije na iPhone-u
              </h3>
              <ol className="text-xs text-gray-600 dark:text-gray-300 space-y-1.5 list-decimal list-inside">
                <li>Klikni <span className="font-medium">Share</span> u Safariju.</li>
                <li>Izaberi <span className="font-medium">{'„Add to Home Screen”'}</span>.</li>
                <li>Otvori aplikaciju sa home screen-a.</li>
                <li>Tu ponovo klikni <span className="font-medium">{'„Uključi notifikacije”'}</span>.</li>
              </ol>
              <button
                onClick={() => setShowIOSModal(false)}
                className="mt-4 w-full py-2 rounded-lg text-xs font-medium bg-[#024c7d] text-white dark:bg-[#60c3ad] dark:text-[#024c7d]"
              >
                Razumem
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!supported) {
    return (
      <p className={`${className} text-xs text-gray-400 dark:text-gray-500`}>
        Notifikacije nisu podržane u ovom browseru.
      </p>
    )
  }

  return (
    <div className={className}>
      <div className="relative inline-flex items-center gap-1.5">
        <button
          onClick={subscribed ? disable : enable}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3
            ${subscribed
              ? 'text-[#024c7d] dark:text-[#60c3ad] border-[#024c7d]/30 dark:border-[#60c3ad]/30 bg-[#024c7d]/5 dark:bg-[#60c3ad]/10 hover:bg-[#024c7d]/10'
              : 'liquid-glass text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-800/70'}
            ${busy ? 'opacity-60 cursor-wait' : ''}`}
        >
          {subscribed ? bellFilled : bellOutline}
          {subscribed ? 'Notifikacije uključene' : 'Uključi notifikacije'}
        </button>

        {subscribed && (
          <span className="relative inline-flex">
            <button
              type="button"
              onClick={() => setShowInfo(v => !v)}
              aria-label="Detalji o notifikacijama"
              aria-expanded={showInfo}
              className="no-hover-lift flex h-6 w-6 items-center justify-center text-[#024c7d] dark:text-[#60c3ad]"
            >
              {infoIcon}
            </button>

            {showInfo && (
              <div className="absolute left-1/2 top-full z-40 mt-2 w-56 max-w-[calc(100vw-2rem)] -translate-x-[42%] rounded-xl border border-[#024c7d]/15 bg-white/95 px-3 py-2 text-[11px] leading-relaxed text-gray-500 shadow-lg backdrop-blur-xl dark:border-white/15 dark:bg-gray-900/95 dark:text-gray-300 sm:left-auto sm:right-0 sm:w-64 sm:translate-x-0">
                <span className="absolute -top-1.5 left-[42%] h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-[#024c7d]/15 bg-white/95 dark:border-white/15 dark:bg-gray-900/95 sm:left-auto sm:right-2.5 sm:translate-x-0" />
                Obaveštavamo te o novim rokovima i na dan kad počne i kad se završava prijava.
              </div>
            )}
          </span>
        )}
      </div>
      {subscribed && (
        <p className="sr-only">
          Obaveštavamo te o novim rokovima i na dan kad počne i kad se završava prijava.
        </p>
      )}
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  )
}
