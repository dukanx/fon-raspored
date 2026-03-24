'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import type { SemesterData } from '@/lib/types'
import { findGroup, getProgramsForYear } from '@/lib/schedule'
import BlurText from '@/components/BlurText'

export default function OnboardingPage() {
  const router = useRouter()

  const [year, setYear] = useState<number | null>(null)
  const [program, setProgram] = useState<string | null>(null)
  const [lastName, setLastName] = useState<string | null>(null)
  const [data, setData] = useState<SemesterData | null>(null)
  const [programs, setPrograms] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isHydrated = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false
  )

  const storedYear = isHydrated
    ? (() => {
      const raw = localStorage.getItem('fon_saved_year')
      if (!raw) return null
      const parsed = Number(raw)
      return Number.isFinite(parsed) ? parsed : null
    })()
    : null

  const selectedYear = year ?? storedYear
  const selectedProgram = program ?? (isHydrated ? (localStorage.getItem('fon_saved_program') ?? '') : '')
  const enteredLastName = lastName ?? (isHydrated ? (localStorage.getItem('fon_saved_lastName') ?? '') : '')

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

  function handleSubmit() {
    if (!data || !enteredLastName.trim() || selectedYear === null) return
    setError(null)

    const groupId = findGroup(
      data,
      enteredLastName.trim(),
      selectedProgram || null
    )

    if (!groupId) {
      setError('Nije pronađena grupa za unesene podatke. Proveri prezime i smer.')
      return
    }

    // Sačuvaj u sessionStorage pa redirectuj
    sessionStorage.setItem('fon_group', groupId)
    sessionStorage.setItem('fon_year', String(selectedYear))
    sessionStorage.setItem('fon_lastName', enteredLastName.trim())
    sessionStorage.setItem('fon_semester', data.semester)
    if (selectedProgram) sessionStorage.setItem('fon_program', selectedProgram)

    localStorage.setItem('fon_saved_year', String(selectedYear))
    localStorage.setItem('fon_saved_program', selectedProgram)
    localStorage.setItem('fon_saved_lastName', enteredLastName.trim())
    router.push('/izborni')
  }

  const canSubmit =
    selectedYear !== null &&
    enteredLastName.trim().length > 1 &&
    selectedProgram !== '' &&
    !loading

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8">

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4 text-xs">
            <span className="font-semibold text-[#024c7d] dark:text-[#60c3ad]">1. Podaci</span>
            <span className="text-gray-300 dark:text-gray-700">→</span>
            <span className="font-medium text-gray-400">2. Predmeti</span>
            <span className="text-gray-300 dark:text-gray-700">→</span>
            <span className="font-medium text-gray-400">3. Raspored</span>
          </div>
          <BlurText
            text="FON Raspored"
            animateBy="letters"
            direction="top"
            delay={60}
            stepDuration={0.3}
            className="text-2xl font-semibold text-[#024c7d] dark:text-[#60c3ad]"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Unesi svoje podatke i dobij lični raspored
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
                className={`py-2 rounded-lg text-sm font-medium border transition-colors
                  ${selectedYear === y
                    ? 'bg-[#024c7d] text-white border-[#024c7d] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:border-[#60c3ad]'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:border-gray-500'
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
              <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            ) : (
              <select
                value={selectedProgram}
                onChange={e => setProgram(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm
                           text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900
                           dark:border-gray-700 focus:outline-none focus:ring-2
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
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm
                         text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900
                         dark:border-gray-700 placeholder-gray-400 dark:placeholder-gray-500
                         focus:outline-none focus:ring-2 focus:ring-[#024c7d]
                         dark:focus:ring-[#60c3ad] focus:border-transparent"
            />
          </div>
        )}

        {/* Greška */}
        {error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all active:scale-[0.97]
            ${canSubmit
              ? 'bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0]'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500'
            }`}
        >
          Prikaži raspored
        </button>

        {/* Fallback - ručni odabir grupe */}
        {selectedYear && data && (
          <div className="mt-6 pt-6 border-t border-gray-300 dark:border-gray-800">
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mb-3">
              Znaš svoju grupu? Odaberi direktno
            </p>
            <select
              onChange={e => {
                if (!e.target.value || selectedYear === null) return
                const groupId = e.target.value
                sessionStorage.setItem('fon_group', groupId)
                sessionStorage.setItem('fon_year', String(selectedYear))
                sessionStorage.setItem('fon_lastName', enteredLastName.trim() || groupId)
                sessionStorage.setItem('fon_semester', data.semester)
                if (selectedProgram) sessionStorage.setItem('fon_program', selectedProgram)

                localStorage.setItem('fon_saved_year', String(selectedYear))
                localStorage.setItem('fon_saved_program', selectedProgram)
                localStorage.setItem('fon_saved_lastName', enteredLastName.trim())
                router.push('/izborni')
              }}
              className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700
                 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900
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
    </main>
  )
}
