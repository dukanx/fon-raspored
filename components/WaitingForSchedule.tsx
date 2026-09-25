'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  isIOS as detectIOS,
  isStandalone as detectStandalone,
  pushSupported,
  getPushSubscription,
  enablePush,
} from '@/lib/push'
import type { PendingSemester } from '@/lib/season'
import InstallPrompt from './InstallPrompt'

type PushState = 'loading' | 'off' | 'on' | 'ios-install' | 'unsupported'

const primary =
  'bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0]'

// Sadržaj kartice na početnoj u periodu "čekamo raspored" (v. lib/season), za
// sve korisnike, umesto izbora godine i prezimena. Stari raspored tada nikome
// ne koristi, pa je jedini cilj da posetilac uključi notifikacije (a gde bez
// instalacije ne može, da instalira aplikaciju) i da mu javimo kad izađe.
export default function WaitingForSchedule({
  pending,
  savedGroup,
}: {
  pending: PendingSemester
  savedGroup: string | null
}) {
  const [push, setPush] = useState<PushState>('loading')
  const [standalone, setStandalone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sa = detectStandalone()
    // Isti redosled provera kao NotificationBell: iOS van home screen-a nema
    // PushManager, pa mora pre pushSupported().
    if (detectIOS() && !sa) {
      queueMicrotask(() => setPush('ios-install'))
      return
    }
    queueMicrotask(() => setStandalone(sa))
    if (!pushSupported()) {
      queueMicrotask(() => setPush('unsupported'))
      return
    }
    // Stanje je iz stvarne pretplate, i u dev-u. Na localhost-u se glumi samo
    // klik (enablePush odmah vraća uspeh), pa se vide oba stanja.
    getPushSubscription().then(sub => setPush(sub ? 'on' : 'off'))
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
    <div className="anim-up mt-7 lg:mt-9" style={{ animationDuration: '0.4s' }}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#024c7d]/10 text-[#024c7d] dark:bg-[#60c3ad]/15 dark:text-[#60c3ad]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2.5" />
            <path d="M3 10h18M8 3v4M16 3v4" />
            <path d="M12 13.5V16l1.5 1" />
          </svg>
        </span>
        <div>
          <h2 className="text-base font-semibold text-gray-900 lg:text-lg dark:text-gray-100">
            {kind} raspored {year} još nije objavljen
          </h2>
          <p className="mt-1 text-sm text-pretty text-gray-600 dark:text-gray-300">
            FON ga objavljuje pred početak semestra.
            {push !== 'unsupported' && ' Čim izađe, stiže ti notifikacija.'}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {push === 'loading' && <div className="h-11 animate-pulse rounded-xl bg-white/60 dark:bg-gray-800/68" />}

        {push === 'on' && (
          <p className="rounded-xl bg-[#60c3ad]/15 px-3 py-2.5 text-sm font-medium text-[#024c7d] dark:text-[#60c3ad]">
            Notifikacije su uključene. Javljamo ti čim raspored izađe.
          </p>
        )}

        {/* Push radi i bez instalacije (Android Chrome, desktop): dugme odmah. */}
        {push === 'off' && (
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className={`btn-lift w-full rounded-xl py-3 text-sm font-medium ${primary} ${busy ? 'cursor-wait opacity-60' : ''}`}
          >
            {busy ? 'Sačekaj…' : 'Uključi notifikacije'}
          </button>
        )}
        {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

        {push === 'unsupported' && (
          <p className="text-sm text-pretty text-gray-600 dark:text-gray-300">
            Ovaj pregledač ne podržava notifikacije. Otvori sajt u Chrome-u ili Safariju, pa ih
            uključi tamo. Raspored stiže ovde istog dana kad ga FON objavi.
          </p>
        )}

        {/* Van instalirane aplikacije: uputstvo za instalaciju, skupljeno da
            kartica ne bude pretrpana (raširi se na tap). Na iPhone-u je to jedini
            put do notifikacija, pa ispod stoji i zašto. InstallPrompt se sam
            sakrije gde instalacija nije moguća (desktop bez prompta). */}
        {push !== 'loading' && !standalone && (
          <>
            <InstallPrompt compact />
            {push === 'ios-install' && (
              <p className="text-xs text-pretty text-gray-500 dark:text-gray-400">
                Na iPhone-u notifikacije rade samo iz instalirane aplikacije. Kad je otvoriš sa
                početnog ekrana, dozvoli notifikacije.
              </p>
            )}
          </>
        )}
      </div>

      {savedGroup && (
        <div className="mt-6 border-t border-[#024c7d]/12 pt-5 text-[13px] leading-[18px] text-gray-500 dark:border-white/15 dark:text-gray-400">
          <p className="text-pretty">
            Tvoji podaci su sačuvani (grupa {savedGroup}).
            {pending.newAcademicYear && ' Kad raspored izađe, samo proveri godinu i grupu.'}
          </p>
          <Link
            href="/rokovi"
            className="-mx-1 mt-1 inline-block px-1 py-1 font-medium text-[#024c7d] hover:underline dark:text-[#60c3ad]"
          >
            Rokovi
          </Link>
        </div>
      )}
    </div>
  )
}
