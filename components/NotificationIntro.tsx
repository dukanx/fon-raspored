'use client'

import { useEffect, useState } from 'react'
import { app } from '@/lib/storage'
import {
  isStandalone,
  pushSupported,
  notificationPermission,
  getPushSubscription,
  enablePush,
} from '@/lib/push'

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
const IconBell = (p: IconProps) => (
  <svg {...baseIcon(p)}>
    <path d="M6 9a6 6 0 0 1 12 0v.75a8.97 8.97 0 0 0 2.31 6.02c.3.33.06.86-.38.98A23.85 23.85 0 0 1 12 18a23.85 23.85 0 0 1-7.93-1.25c-.44-.12-.68-.65-.38-.98A8.97 8.97 0 0 0 6 9.75Z" />
    <path d="M9.5 20a2.5 2.5 0 0 0 5 0" />
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

// Prvi-put modal koji pita za notifikacije u instaliranoj PWA. Prikazuje se
// jednom (fon_notif_intro_seen), svakome ko nije već uključio notifikacije.
export default function NotificationIntro() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (app.notifIntroSeen.get()) return
    // Samo u instaliranoj PWA — u browseru nema smisla (i iOS Web Push radi tek odatle).
    if (!isStandalone() || !pushSupported()) return
    // Ako je već odbijeno na nivou browsera, ne možemo ponovo da pitamo.
    if (notificationPermission() === 'denied') {
      app.notifIntroSeen.set()
      return
    }

    let cancelled = false
    getPushSubscription().then((sub) => {
      if (cancelled) return
      if (sub) {
        app.notifIntroSeen.set() // već uključeno — ne prikazuj
        return
      }
      setOpen(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function enable() {
    setBusy(true)
    setError(null)
    const res = await enablePush()
    setBusy(false)
    if (res.ok) {
      app.notifIntroSeen.set()
      setOpen(false)
    } else {
      setError(res.error)
    }
  }

  function later() {
    app.notifIntroSeen.set()
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/40 px-4 py-6 backdrop-blur-sm sm:items-center">
      <div className="liquid-glass w-full max-w-sm rounded-[1.75rem] p-6 ring-1 ring-[#024c7d]/15 dark:ring-white/15">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#024c7d]/10 text-[#024c7d] dark:bg-[#60c3ad]/15 dark:text-[#60c3ad]">
            <IconBell className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Uključi notifikacije
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
            onClick={enable}
            disabled={busy}
            className={`w-full rounded-xl bg-[#024c7d] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0] ${
              busy ? 'cursor-wait opacity-60' : ''
            }`}
          >
            {busy ? 'Uključivanje…' : 'Uključi notifikacije'}
          </button>
          <button
            onClick={later}
            disabled={busy}
            className="w-full rounded-xl py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-white/70 dark:text-gray-400 dark:hover:bg-gray-800/60"
          >
            Možda kasnije
          </button>
        </div>
      </div>
    </div>
  )
}
