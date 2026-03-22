'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { SemesterData } from '@/lib/types'
import { findGroup, getProgramsForYear } from '@/lib/schedule'

export default function OnboardingPage() {
  const router = useRouter()

  const [year, setYear] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    const savedYear = localStorage.getItem('fon_saved_year')
    return savedYear ? Number(savedYear) : null
  })
  const [program, setProgram] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('fon_saved_program') ?? ''
  })
  const [lastName, setLastName] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('fon_saved_lastName') ?? ''
  })
  const [data, setData] = useState<SemesterData | null>(null)
  const [programs, setPrograms] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Učitaj JSON kad se odabere godina
  useEffect(() => {
    if (!year) return

    fetch(`/data/${year}god.json`)
      .then(r => r.json())
      .then((d: SemesterData) => {
        setData(d)
        setPrograms(getProgramsForYear(d))

      })
      .catch(() => setError('Greška pri učitavanju podataka.'))
      .finally(() => setLoading(false))
  }, [year])

  function handleYearSelect(selectedYear: number) {
    setYear(selectedYear)
    setLoading(true)
    setError(null)
    setProgram('')
    setData(null)
  }

  function handleSubmit() {
    if (!data || !lastName.trim()) return
    setError(null)

    const groupId = findGroup(
      data,
      lastName.trim(),
      program || null
    )

    if (!groupId) {
      setError('Nije pronađena grupa za unesene podatke. Proveri prezime i smer.')
      return
    }

    // Sačuvaj u sessionStorage pa redirectuj
    sessionStorage.setItem('fon_group', groupId)
    sessionStorage.setItem('fon_year', String(year))
    sessionStorage.setItem('fon_lastName', lastName.trim())
    sessionStorage.setItem('fon_semester', data.semester)
    if (program) sessionStorage.setItem('fon_program', program)

    localStorage.setItem('fon_saved_year', String(year))
    localStorage.setItem('fon_saved_program', program)
    localStorage.setItem('fon_saved_lastName', lastName.trim())
    router.push('/izborni')
  }

  const canSubmit =
    year !== null &&
    lastName.trim().length > 1 &&
    program !== '' &&
    !loading

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-8">

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">FON Raspored</h1>
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
                  ${year === y
                    ? 'bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:border-gray-500'
                  }`}
              >
                {y}.
              </button>
            ))}
          </div>
        </div>

        {/* Smer - samo za 2., 3., 4. godinu */}
        {year && (
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Studijski program
            </label>
            {loading ? (
              <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            ) : (
              <select
                value={program}
                onChange={e => setProgram(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm
                           text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900
                           dark:border-gray-700 focus:outline-none focus:ring-2
                           focus:ring-gray-900 dark:focus:ring-gray-200 focus:border-transparent"
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
        {year && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Prezime
            </label>
            <input
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canSubmit && handleSubmit()}
              placeholder="npr. Petrović"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm
                         text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900
                         dark:border-gray-700 placeholder-gray-400 dark:placeholder-gray-500
                         focus:outline-none focus:ring-2 focus:ring-gray-900
                         dark:focus:ring-gray-200 focus:border-transparent"
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
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors
            ${canSubmit
              ? 'bg-gray-900 text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500'
            }`}
        >
          Prikaži raspored
        </button>

      </div>
    </main>
  )
}
