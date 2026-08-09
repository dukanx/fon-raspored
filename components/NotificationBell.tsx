'use client'

import { useEffect, useState } from 'react'
import {
  isIOS as detectIOS,
  isStandalone as detectStandalone,
  pushSupported,
  isLocalNotificationPreview,
  getPushSubscription,
  enablePush,
  disablePush,
} from '@/lib/push'

const GLASS = 'liquid-glass'

type IconProps = React.SVGProps<SVGSVGElement>
const baseIcon = (p: IconProps) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
})
const IconBellOutline = (p: IconProps) => (
  <svg {...baseIcon(p)}>
    <path d="M6 9a6 6 0 0 1 12 0v.75a8.97 8.97 0 0 0 2.31 6.02c.3.33.06.86-.38.98A23.85 23.85 0 0 1 12 18a23.85 23.85 0 0 1-7.93-1.25c-.44-.12-.68-.65-.38-.98A8.97 8.97 0 0 0 6 9.75Z" />
    <path d="M9.5 20a2.5 2.5 0 0 0 5 0" />
  </svg>
)
const IconBellFilled = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M6 9a6 6 0 0 1 12 0v.75a8.97 8.97 0 0 0 2.31 6.02c.3.33.06.86-.38.98A23.85 23.85 0 0 1 12 18a23.85 23.85 0 0 1-7.93-1.25c-.44-.12-.68-.65-.38-.98A8.97 8.97 0 0 0 6 9.75Z" />
    <path d="M9.5 20a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" fill="none" />
  </svg>
)
const IconCalendar = (p: IconProps) => (
  <svg {...baseIcon(p)}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
)
const IconClock = (p: IconProps) => (
  <svg {...baseIcon(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

// Kompaktno ikonica-dugme. Klik ne (od)prijavljuje odmah — otvara popup sa
// istim objašnjenjem kao NotificationIntro (prvi-put modal) plus dugme za
// uključi/isključi, tako da objašnjenje ostaje dostupno i posle prvog puta.
export default function NotificationBell({ className = '' }: { className?: string }) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [isStandalone, setIsStandalone] = useState(true)
  const [showIOSModal, setShowIOSModal] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => {
    const localPreview = isLocalNotificationPreview()
    const ios = detectIOS()
    const android = /Android/i.test(navigator.userAgent)
    const standalone = detectStandalone()
    const supported = pushSupported()
    // queueMicrotask: izbegava setState sinhrono u efektu (react-hooks pravilo).
    queueMicrotask(() => {
      setIsIOS(ios)
      setIsAndroid(android)
      setIsStandalone(standalone)
      setSupported(supported)
    })

    if (supported) {
      getPushSubscription().then((sub) => setSubscribed(localPreview || !!sub))
    }
  }, [])

  async function enable() {
    setBusy(true)
    setError(null)
    const res = await enablePush()
    setBusy(false)
    if (res.ok) {
      setSubscribed(true)
      setShowInfo(false)
    } else {
      setError(res.error)
    }
  }

  async function disable() {
    setBusy(true)
    setError(null)
    const res = await disablePush()
    setBusy(false)
    if (res.ok) {
      setSubscribed(false)
      setShowInfo(false)
    } else {
      setError(res.error)
    }
  }

  // Samo dok se ne utvrdi platforma (pre hidracije) — da ne bljesne pogrešan UI.
  if (supported === null) return null

  const btnClass = (active: boolean) =>
    `flex h-9 w-9 items-center justify-center rounded-full transition-colors ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 ${
      active ? 'text-[#024c7d] dark:text-[#60c3ad]' : 'text-gray-600 dark:text-gray-300'
    }`

  // iOS pre instalacije: dugme otvara uputstvo (Web Push radi tek iz home screen-a).
  // Provera ide PRE pushSupported() jer iOS van standalone moda ne izlaže
  // PushManager — inače bi uputstvo bilo skriveno baš onima kojima treba.
  if (isIOS && !isStandalone) {
    return (
      <div className={className}>
        <button onClick={() => setShowIOSModal(true)} aria-label="Uključi notifikacije" className={btnClass(false)}>
          <IconBellOutline className="h-[18px] w-[18px]" />
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
                <IconBellOutline className="h-4 w-4" /> Notifikacije na iPhone-u
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

  // Bez podrške za push (star pregledač, in-app webview iz Instagrama/Facebooka…).
  // Zvonce ipak stoji — inače korisnik nema gde da sazna zašto notifikacija nema.
  if (!supported) {
    return (
      <div className={className}>
        <button onClick={() => setShowIOSModal(true)} aria-label="Notifikacije" className={btnClass(false)}>
          <IconBellOutline className="h-[18px] w-[18px]" />
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
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-1.5">
                <IconBellOutline className="h-4 w-4" /> Notifikacije
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                {isAndroid
                  ? 'Ovaj pregledač ih ne podržava. Otvori aplikaciju u Chrome-u, pa je dodaj na početni ekran.'
                  : 'Ovaj pregledač ih ne podržava. Probaj Chrome, Firefox ili Safari 16+.'}
              </p>
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

  return (
    <div className={className}>
      <button
        onClick={() => setShowInfo(true)}
        aria-label={subscribed ? 'Notifikacije uključene - detalji' : 'Uključi notifikacije'}
        aria-pressed={subscribed}
        className={btnClass(subscribed)}
      >
        {subscribed ? <IconBellFilled className="h-[18px] w-[18px]" /> : <IconBellOutline className="h-[18px] w-[18px]" />}
      </button>

      {showInfo && (
        <div
          className="fixed inset-0 z-60 flex items-end justify-center bg-black/40 px-4 py-6 backdrop-blur-sm sm:items-center"
          onClick={() => setShowInfo(false)}
        >
          <div
            className={`${GLASS} w-full max-w-sm rounded-[1.75rem] p-6 ring-1 ring-[#024c7d]/15 dark:ring-white/15`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <span className="flex h-9 w-9 items-center justify-center text-[#024c7d] dark:text-[#60c3ad]">
                {subscribed ? <IconBellFilled className="h-8 w-8" /> : <IconBellOutline className="h-8 w-8" />}
              </span>
              <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {subscribed ? 'Notifikacije uključene' : 'Uključi notifikacije'}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Da ne propustiš rok ili prijavu ispita.
              </p>
            </div>

            <div className="mt-5 space-y-2.5">
              <div className="flex items-start gap-3 rounded-2xl border border-[#024c7d]/10 p-3 dark:border-white/10">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#024c7d]/10 text-[#024c7d] dark:bg-[#60c3ad]/15 dark:text-[#60c3ad]">
                  <IconCalendar className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Novi rokovi</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Čim izađu ispitni rokovi i kolokvijumi.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-[#024c7d]/10 p-3 dark:border-white/10">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#024c7d]/10 text-[#024c7d] dark:bg-[#60c3ad]/15 dark:text-[#60c3ad]">
                  <IconClock className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Prijava ispita</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Na dan kad počne i kad se završava prijava.
                  </p>
                </div>
              </div>
            </div>

            {error && <p className="mt-3 text-center text-xs text-red-500">{error}</p>}

            <div className="mt-5 space-y-2">
              <button
                onClick={subscribed ? disable : enable}
                disabled={busy}
                className={`w-full rounded-xl py-2.5 text-sm font-medium transition-colors ${
                  subscribed
                    ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10'
                    : 'bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0]'
                } ${busy ? 'cursor-wait opacity-60' : ''}`}
              >
                {busy ? 'Sačekaj…' : subscribed ? 'Isključi notifikacije' : 'Uključi notifikacije'}
              </button>
              <button
                onClick={() => setShowInfo(false)}
                disabled={busy}
                className="w-full rounded-xl py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-white/70 dark:text-gray-400 dark:hover:bg-gray-800/60"
              >
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
