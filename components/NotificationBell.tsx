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

export default function NotificationBell() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(true)
  const [showIOSModal, setShowIOSModal] = useState(false)

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
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
        .then((sub) => setSubscribed(!!sub))
        .catch(() => setSupported(false))
    } else {
      setSupported(false)
    }
  }, [])

  async function enable() {
    setBusy(true)
    setError(null)
    try {
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
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await unsubscribeUser(sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
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
  const offBtnClass =
    'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-400 dark:hover:border-gray-500'

  // iOS pre instalacije: dugme otvara uputstvo (Web Push radi tek iz home screen-a).
  if (isIOS && !isStandalone) {
    return (
      <div className="mt-3">
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
              className="w-full max-w-xs rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 shadow-xl"
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
      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        Notifikacije nisu podržane u ovom browseru.
      </p>
    )
  }

  return (
    <div className="mt-3">
      <button
        onClick={subscribed ? disable : enable}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
          ${subscribed
            ? 'text-[#024c7d] dark:text-[#60c3ad] border-[#024c7d]/30 dark:border-[#60c3ad]/30 bg-[#024c7d]/5 dark:bg-[#60c3ad]/10 hover:bg-[#024c7d]/10'
            : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-400 dark:hover:border-gray-500'}
          ${busy ? 'opacity-60 cursor-wait' : ''}`}
      >
        {subscribed ? bellFilled : bellOutline}
        {subscribed ? 'Notifikacije uključene' : 'Uključi notifikacije'}
      </button>
      {subscribed && (
        <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500 max-w-xs">
          Obaveštavamo te o novim rokovima i podsetnik dan pred početak/kraj prijave.
        </p>
      )}
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  )
}
