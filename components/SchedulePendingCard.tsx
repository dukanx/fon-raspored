'use client'

import { useEffect, useState } from 'react'
import {
  isIOS as detectIOS,
  isStandalone as detectStandalone,
  pushSupported,
  isLocalNotificationPreview,
  getPushSubscription,
  enablePush,
} from '@/lib/push'
import type { PendingSemester } from '@/lib/season'

const GLASS = 'liquid-glass'

type PushState = 'loading' | 'off' | 'on' | 'ios-install' | 'unsupported'

// Kartica "Raspored još nije objavljen" — prikazuje se na Rasporedu dok je po
// kalendaru već novi semestar, a FON još nije objavio raspored (v. lib/season).
// Glavni cilj: da korisnik ne ode praznih ruku, nego uključi obaveštenje i
// vrati se kad raspored izađe.
export default function SchedulePendingCard({
  pending,
  oldSemester,
  showingOld,
  onToggleOld,
}: {
  pending: PendingSemester
  oldSemester: string
  showingOld: boolean
  onToggleOld: () => void
}) {
  const [push, setPush] = useState<PushState>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Isti redosled provera kao NotificationBell: iOS van home screen-a nema
    // PushManager, pa mora pre pushSupported().
    if (detectIOS() && !detectStandalone()) {
      queueMicrotask(() => setPush('ios-install'))
      return
    }
    if (!pushSupported()) {
      queueMicrotask(() => setPush('unsupported'))
      return
    }
    const localPreview = isLocalNotificationPreview()
    getPushSubscription().then(sub => setPush(localPreview || sub ? 'on' : 'off'))
  }, [])

  async function enable() {
    setBusy(true)
    setError(null)
    const res = await enablePush()
    setBusy(false)
    if (res.ok) setPush('on')
    else setError(res.error)
  }

  const [kind, ...rest] = pending.label.split(' ')
  const year = rest.join(' ')

  return (
    <section
      aria-labelledby="raspored-uskoro"
      className={`anim-up mx-auto mb-6 max-w-xl rounded-[1.75rem] p-6 text-center ring-1 ring-[#024c7d]/15 dark:ring-white/15 ${GLASS}`}
    >
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#024c7d]/10 text-[#024c7d] dark:bg-[#60c3ad]/15 dark:text-[#60c3ad]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2.5" />
          <path d="M3 10h18M8 3v4M16 3v4" />
          <path d="M12 13.5V16l1.5 1" />
        </svg>
      </span>

      <h2 id="raspored-uskoro" className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {kind} raspored {year} još nije objavljen
      </h2>
      <p className="mt-1.5 text-sm text-pretty text-gray-600 dark:text-gray-300">
        FON ga obično objavi pred sam početak semestra. Čim izađe, biće ovde,
        prilagođen tvojoj grupi i predmetima.
      </p>

      <div className="mt-5">
        {push === 'off' && (
          <button
            onClick={enable}
            disabled={busy}
            className={`btn-lift w-full rounded-xl py-2.5 text-sm font-medium bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0] ${busy ? 'cursor-wait opacity-60' : ''}`}
          >
            {busy ? 'Sačekaj…' : 'Javi mi kad izađe'}
          </button>
        )}
        {push === 'on' && (
          <p className="rounded-xl bg-[#60c3ad]/15 px-3 py-2.5 text-sm font-medium text-[#024c7d] dark:text-[#60c3ad]">
            Obaveštenja su uključena — javljamo ti čim raspored izađe.
          </p>
        )}
        {push === 'ios-install' && (
          <p className="rounded-xl border border-[#024c7d]/10 px-3 py-2.5 text-xs text-gray-600 dark:border-white/10 dark:text-gray-300">
            Da ti javimo kad izađe: u Safariju klikni <span className="font-medium">Share</span> →{' '}
            <span className="font-medium">{'„Add to Home Screen”'}</span>, otvori aplikaciju sa
            početnog ekrana i uključi notifikacije (zvonce na Rokovima).
          </p>
        )}
        {push === 'unsupported' && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Svrati ponovo za dan-dva — raspored stiže ovde istog dana kad ga FON objavi.
          </p>
        )}
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>

      {pending.newAcademicYear && (
        <p className="mt-4 text-xs text-pretty text-gray-500 dark:text-gray-400">
          Nova je školska godina — kad raspored izađe, proveri godinu i grupu u koraku „1. Podaci“.
        </p>
      )}

      <div className="mt-4 flex flex-col items-center gap-1 text-[13px]">
        <a
          href="https://oas.fon.bg.ac.rs/raspored-nastave/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-1 py-1.5 font-medium text-[#024c7d] hover:underline dark:text-[#60c3ad]"
        >
          Proveri na sajtu FON-a
        </a>
        <button
          onClick={onToggleOld}
          className="no-hover-lift px-1 py-1.5 text-gray-500 hover:underline dark:text-gray-400"
        >
          {showingOld ? 'Sakrij prošli raspored' : `Prikaži prošli raspored (${oldSemester})`}
        </button>
      </div>
    </section>
  )
}
