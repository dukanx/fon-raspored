'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import type { SemesterData, RokData } from '@/lib/types'
import { findGroup, getProgramsForYear } from '@/lib/schedule'
import { session, saved, app } from '@/lib/storage'
import { decodeShare } from '@/lib/share'
import { pickDefaultTab } from '@/lib/rokDefault'
import BlurText from '@/components/BlurText'
import InstallPrompt from '@/components/InstallPrompt'

const GLASS = 'liquid-glass'

// Izvuče share kod iz nalepljenog teksta — bilo pun URL (.../deli?s=KOD) bilo
// sam kod. Omogućava da se deljeni raspored primeni i unutar sveže instalirane
// PWA (na iOS-u home-screen app ima odvojen storage od Safarija).
function extractShareCode(input: string): string {
  const t = input.trim()
  if (!t) return ''
  const m = t.match(/[?&]s=([^&\s]+)/)
  return m ? m[1] : t
}

export default function OnboardingPage() {
  const router = useRouter()

  const [year, setYear] = useState<number | null>(null)
  const [program, setProgram] = useState<string | null>(null)
  const [lastName, setLastName] = useState<string | null>(null)
  const [data, setData] = useState<SemesterData | null>(null)
  const [programs, setPrograms] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareInput, setShareInput] = useState('')
  const [shareError, setShareError] = useState<string | null>(null)
  const isHydrated = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false
  )

  const storedYear = isHydrated
    ? (() => {
      const raw = saved.year.get()
      if (!raw) return null
      const parsed = Number(raw)
      return Number.isFinite(parsed) ? parsed : null
    })()
    : null

  const selectedYear = year ?? storedYear
  const selectedProgram = program ?? (isHydrated ? (saved.program.get() ?? '') : '')
  const enteredLastName = lastName ?? (isHydrated ? (saved.lastName.get() ?? '') : '')

  useEffect(() => {
    if (!isHydrated) return
    // Korisnik je svesno došao da izmeni podatke (klik na "1. Podaci") — ne preusmeravaj.
    if (new URLSearchParams(window.location.search).get('edit') === '1') return

    // Raspored ili Rokovi — zavisi da li je blizu/u toku ispitni rok (stvarni
    // datumi iz rokovi.json, ne pretpostavljeni akademski kalendar).
    async function defaultTab(): Promise<'/raspored' | '/rokovi'> {
      try {
        const rokovi: RokData[] = await fetch('/data/rokovi.json').then(r => r.json())
        const todayStr = new Date().toISOString().split('T')[0]
        return pickDefaultTab(rokovi, todayStr)
      } catch {
        return '/raspored'
      }
    }

    // Isti tab — sessionStorage ima grupu
    if (session.group.get()) { void defaultTab().then(dest => router.replace(dest)); return }
    // Novi tab/browser — localStorage ima grupu (korisnik je već prošao onboarding)
    const savedGroup = saved.group.get()
    const savedYear = saved.year.get()
    if (savedGroup && savedYear) {
      session.group.set(savedGroup)
      session.year.set(savedYear)
      const prog = saved.program.get()
      const name = saved.lastName.get()
      const sem = saved.semester.get()
      if (prog) session.program.set(prog)
      if (name) session.lastName.set(name)
      if (sem) session.semester.set(sem)
      // Postojeći korisnik (već ima sačuvan identitet) — tutorial je samo za nove.
      app.tutorialSeen.set()
      void defaultTab().then(dest => router.replace(dest))
    }
  }, [isHydrated, router])

  // Učitaj JSON kad se odabere godina
  useEffect(() => {
    if (!selectedYear) return

    fetch(`/data/${selectedYear}god.json`)
      .then(r => r.json())
      .then((d: SemesterData) => {
        setData(d)
        setPrograms(getProgramsForYear(d))

      })
      .catch(() => setError('Greška pri učitavanju podataka.'))
      .finally(() => setLoading(false))
  }, [selectedYear])

  function handleYearSelect(selectedYear: number) {
    setYear(selectedYear)
    setLoading(true)
    setError(null)
    setProgram('')
    setData(null)
  }

  // Upisuje izbor u session (aktivni tab) + saved (trajno) i vodi na /izborni.
  // sessionLastName dozvoljava fallback na grupu kad prezime nije uneto.
  function commitSelection(
    groupId: string,
    opts: { year: number; program: string; lastName: string; semester: string; sessionLastName?: string }
  ) {
    const yr = String(opts.year)
    session.group.set(groupId)
    session.year.set(yr)
    session.lastName.set(opts.sessionLastName ?? opts.lastName)
    session.semester.set(opts.semester)
    if (opts.program) session.program.set(opts.program)

    saved.group.set(groupId)
    saved.year.set(yr)
    saved.program.set(opts.program)
    saved.lastName.set(opts.lastName)
    saved.semester.set(opts.semester)
  }

  function handleSubmit() {
    if (!data || !enteredLastName.trim() || selectedYear === null) return
    setError(null)

    const raw = enteredLastName.trim()
    const program = selectedProgram || null
    let groupId = findGroup(data, raw, program)
    let usedName = raw

    // Čest slučaj: uneto "Ime Prezime" — probaj samo poslednju reč (prezime).
    if (!groupId && /\s/.test(raw)) {
      const surnameOnly = raw.split(/\s+/).pop() ?? ''
      const retry = surnameOnly ? findGroup(data, surnameOnly, program) : null
      if (retry) {
        groupId = retry
        usedName = surnameOnly
      }
    }

    if (!groupId) {
      setError(
        `Nismo našli grupu za „${raw}". Unesi samo prezime (bez imena), probaj sa kvačicama (č, ć, š, ž, đ) ili bez njih, a možeš i da odabereš grupu direktno ispod.`
      )
      return
    }

    // Sačuvaj izbor pa redirectuj
    commitSelection(groupId, {
      year: selectedYear,
      program: selectedProgram,
      lastName: usedName,
      semester: data.semester,
    })
    router.push('/izborni')
  }

  // Otvori deljeni raspored iz nalepljenog linka — vodi na /deli koji radi u
  // istom (PWA) kontekstu, pa se primenjuje na pravi storage.
  function openSharedLink() {
    const code = extractShareCode(shareInput)
    if (!code || !decodeShare(code)) {
      setShareError('Link nije važeći. Nalepi ceo link koji si dobio.')
      return
    }
    router.push(`/deli?s=${code}`)
  }

  const canSubmit =
    selectedYear !== null &&
    enteredLastName.trim().length > 1 &&
    selectedProgram !== '' &&
    !loading

  return (
    <main className="relative min-h-screen flex items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-4">
      <div className={`rounded-[1.75rem] p-8 ring-1 ring-[#024c7d]/15 dark:ring-white/15 shadow-[0_18px_60px_rgba(2,76,125,0.10)] dark:shadow-[0_18px_60px_rgba(0,0,0,0.35)] ${GLASS}`}>

        <div className="mb-8">
          <BlurText
            text="FON Raspored"
            animateBy="letters"
            direction="top"
            delay={60}
            stepDuration={0.3}
            className="text-2xl font-semibold text-[#024c7d] dark:text-[#60c3ad]"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Tvoj raspored, ispiti i kolokvijumi na jednom mestu
          </p>
        </div>

        {/* Godina */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Godina studija
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map(y => (
              <button
                key={y}
                onClick={() => handleYearSelect(y)}
                className={`py-2 rounded-full text-sm font-medium border transition-colors
                  ${selectedYear === y
                    ? 'bg-[#024c7d] text-white border-[#024c7d] shadow-sm dark:bg-[#60c3ad] dark:text-[#024c7d] dark:border-[#60c3ad]'
                    : 'bg-white/70 text-gray-700 border-[#024c7d]/15 hover:bg-white/80 dark:bg-gray-900/55 dark:text-gray-300 dark:border-white/20 dark:hover:bg-gray-800/70'
                  }`}
              >
                {y}.
              </button>
            ))}
          </div>
        </div>

        {/* Smer - samo za 2., 3., 4. godinu */}
        {selectedYear && (
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Studijski program
            </label>
            {loading ? (
              <div className="h-10 rounded-xl bg-white/60 dark:bg-gray-800/68 animate-pulse" />
            ) : (
              <select
                value={selectedProgram}
                onChange={e => setProgram(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#024c7d]/15 text-sm
                           text-gray-900 dark:text-gray-100 bg-white/70 dark:bg-gray-900/65
                           dark:border-white/20 focus:outline-none focus:ring-2
                           focus:ring-[#024c7d] dark:focus:ring-[#60c3ad] focus:border-transparent"
              >
                <option value="">Izaberi program...</option>
                {programs.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Prezime */}
        {selectedYear && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Prezime
            </label>
            <input
              type="text"
              value={enteredLastName}
              onChange={e => setLastName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canSubmit && handleSubmit()}
              placeholder="npr. Petrović"
              className="w-full h-10 px-3 rounded-xl border border-[#024c7d]/15 text-sm
                         text-gray-900 dark:text-gray-100 bg-white/70 dark:bg-gray-900/65
                         dark:border-white/20 placeholder-gray-400 dark:placeholder-gray-500
                         focus:outline-none focus:ring-2 focus:ring-[#024c7d]
                         dark:focus:ring-[#60c3ad] focus:border-transparent"
            />
          </div>
        )}

        {/* Greška */}
        {error && (
          <p className="mb-4 rounded-xl border border-red-200/70 bg-red-50/80 px-3 py-2 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full rounded-xl py-2.5 text-sm font-medium transition-all active:scale-[0.97]
            ${canSubmit
              ? 'bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0]'
              : 'bg-white/60 text-gray-400 cursor-not-allowed dark:bg-gray-800/68 dark:text-gray-500'
            }`}
        >
          Izaberi predmete
        </button>

        {/* Fallback - ručni odabir grupe */}
        {selectedYear && data && (
          <div className="mt-6 border-t border-[#024c7d]/15 pt-6 dark:border-white/20">
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mb-3">
              Znaš svoju grupu? Odaberi direktno
            </p>
            <select
              onChange={e => {
                if (!e.target.value || selectedYear === null) return
                const groupId = e.target.value
                commitSelection(groupId, {
                  year: selectedYear,
                  program: selectedProgram,
                  lastName: enteredLastName.trim(),
                  sessionLastName: enteredLastName.trim() || groupId,
                  semester: data.semester,
                })
                router.push('/izborni')
              }}
              className="w-full h-10 px-3 rounded-xl border border-[#024c7d]/15 dark:border-white/20
                 text-sm text-gray-900 dark:text-gray-100 bg-white/70 dark:bg-gray-900/65
                 focus:outline-none focus:ring-2 focus:ring-[#024c7d] dark:focus:ring-[#60c3ad]
                 focus:border-transparent"
            >
              <option value="">Odaberi grupu...</option>
              {Object.entries(data.groups)
                .sort(([a], [b]) => a.localeCompare(b, 'sr', { numeric: true, sensitivity: 'base' }))
                .map(([id, g]) => (
                  <option key={id} value={id}>
                    {id} — {g.program} ({g.range})
                  </option>
                ))}
            </select>
          </div>
        )}

        </div>

        {/* Nalepi deljeni link — odvojeno od kartice; koristi se npr. posle
            instalacije PWA (iOS home screen app ima odvojen storage od Safarija) */}
        <div className={`rounded-2xl border border-[#024c7d]/15 dark:border-white/15 p-4 ${GLASS}`}>
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mb-3">
            Imaš link od kolege? Nalepi ga
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={shareInput}
              onChange={e => { setShareInput(e.target.value); setShareError(null) }}
              onKeyDown={e => e.key === 'Enter' && shareInput.trim() && openSharedLink()}
              placeholder="Nalepi link…"
              className="flex-1 h-10 px-3 rounded-xl border border-[#024c7d]/15 text-sm
                         text-gray-900 dark:text-gray-100 bg-white/70 dark:bg-gray-900/65
                         dark:border-white/20 placeholder-gray-400 dark:placeholder-gray-500
                         focus:outline-none focus:ring-2 focus:ring-[#024c7d]
                         dark:focus:ring-[#60c3ad] focus:border-transparent"
            />
            <button
              onClick={openSharedLink}
              disabled={!shareInput.trim()}
              className={`shrink-0 rounded-xl px-4 text-sm font-medium transition-colors
                ${shareInput.trim()
                  ? 'bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0]'
                  : 'bg-white/60 text-gray-400 cursor-not-allowed dark:bg-gray-800/68 dark:text-gray-500'
                }`}
            >
              Otvori
            </button>
          </div>
          {shareError && (
            <p className="mt-2 text-xs text-red-500 dark:text-red-400 text-center">{shareError}</p>
          )}
        </div>

        <InstallPrompt />
      </div>

      <footer className="absolute inset-x-0 bottom-0 py-4 text-center text-xs text-gray-400 dark:text-gray-600">
        Made by{' '}
        <a
          href="https://github.com/dukanx"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#024c7d] dark:text-[#60c3ad] hover:underline font-medium"
        >
          dukanx
        </a>
      </footer>
    </main>
  )
}
