'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import type { SemesterData } from '@/lib/types'
import { getScheduleForGroup } from '@/lib/schedule'

export default function IzbornoPage() {
  const router = useRouter()
  const isHydrated = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false
  )
  const group = isHydrated ? (sessionStorage.getItem('fon_group') ?? '') : ''
  const year = isHydrated ? (sessionStorage.getItem('fon_year') ?? '') : ''
  const [subjects, setSubjects] = useState<string[]>([])
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const [prevOpen, setPrevOpen] = useState(false)
  const [prevGodina, setPrevGodina] = useState<number | null>(null)
  const [prevPredmeti, setPrevPredmeti] = useState<string[]>([])
  const [prevSearch, setPrevSearch] = useState('')
  const [prevLoading, setPrevLoading] = useState(false)
  const [prevSelected, setPrevSelected] = useState<{ year: number; subject: string }[]>([])

  useEffect(() => {
    if (!isHydrated) return
    if (!group || !year) { router.replace('/'); return }

    fetch(`/data/${year}god.json`)
      .then(r => r.json())
      .then((data: SemesterData) => {
        const entries = getScheduleForGroup(data, group)
        const unique = [...new Set(entries.map(e => e.subject))].sort()
        setSubjects(unique)

        const saved = localStorage.getItem(`fon_subjects_${group}`)
        if (saved) {
          setChecked(JSON.parse(saved))
        } else {
          const all: Record<string, boolean> = {}
          unique.forEach(s => { all[s] = true })
          setChecked(all)
        }
      })

    const savedPrev = localStorage.getItem(`fon_prev_subjects_${group}`)
    if (savedPrev) {
      const parsed = JSON.parse(savedPrev)
      setPrevSelected(parsed)
      if (parsed.length > 0) setPrevOpen(true)
    }
  }, [group, isHydrated, router, year])

  useEffect(() => {
    if (!isHydrated || !group) return
    localStorage.setItem(`fon_prev_subjects_${group}`, JSON.stringify(prevSelected))
  }, [prevSelected, isHydrated, group])

  function toggle(subject: string) {
    setChecked(prev => ({ ...prev, [subject]: !prev[subject] }))
  }

  function handleConfirm() {
    localStorage.setItem(`fon_subjects_${group}`, JSON.stringify(checked))
    router.push('/raspored')
  }

  function handlePrevGodina(g: number) {
    setPrevGodina(g)
    setPrevSearch('')
    setPrevPredmeti([])
    setPrevLoading(true)
    fetch(`/data/${g}god.json`)
      .then(r => r.json())
      .then((data: SemesterData) => {
        const unique = [...new Set(data.entries.map(e => e.subject))].sort()
        setPrevPredmeti(unique)
      })
      .finally(() => setPrevLoading(false))
  }

  function togglePrevSubject(g: number, subject: string) {
    setPrevSelected(prev => {
      const exists = prev.some(p => p.year === g && p.subject === subject)
      return exists
        ? prev.filter(p => !(p.year === g && p.subject === subject))
        : [...prev, { year: g, subject }]
    })
  }

  const checkedCount = Object.values(checked).filter(Boolean).length
  const filteredPrev = prevPredmeti.filter(p =>
    p.toLowerCase().includes(prevSearch.toLowerCase())
  )

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8">

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4 text-xs">
            <span className="font-medium text-gray-400">1. Podaci</span>
            <span className="text-gray-300 dark:text-gray-700">→</span>
            <span className="font-semibold text-[#024c7d] dark:text-[#60c3ad]">2. Predmeti</span>
            <span className="text-gray-300 dark:text-gray-700">→</span>
            <span className="font-medium text-gray-400">3. Raspored</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Tvoji predmeti</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Odčekiraj predmete koje ne slušaš
          </p>
        </div>

        <div className="space-y-1 mb-4 max-h-72 overflow-y-auto">
          {subjects.map(subject => (
            <label
              key={subject}
              className="flex items-center gap-3 py-2.5 px-2 rounded-lg
                         hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={checked[subject] ?? true}
                onChange={() => toggle(subject)}
                className="w-4 h-4 rounded accent-[#024c7d] dark:accent-[#60c3ad] shrink-0"
              />
              <span className={`text-sm ${checked[subject] ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                {subject}
              </span>
            </label>
          ))}
        </div>

        {/* Predmeti iz prošlih godina */}
        <div className="mb-6 border-t border-gray-100 dark:border-gray-800 pt-4">
          <button
            type="button"
            onClick={() => setPrevOpen(v => !v)}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors w-full text-left"
          >
            <span className="text-xs w-2">{prevOpen ? '▾' : '▸'}</span>
            <span>Predmeti iz prošlih godina</span>
            {prevSelected.length > 0 && (
              <span className="ml-1 text-[10px] bg-[#024c7d] text-white dark:bg-[#60c3ad] dark:text-[#024c7d] rounded-full px-1.5 py-0.5 font-medium leading-none">
                {prevSelected.length}
              </span>
            )}
          </button>

          {prevOpen && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Termine dodaješ u rasporedu →{' '}
                <span className="font-medium text-gray-600 dark:text-gray-300">Izmena termina</span>
              </p>

              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map(g => (
                  <button
                    key={g}
                    onClick={() => handlePrevGodina(g)}
                    className={`py-1.5 rounded-lg text-xs font-medium border transition-colors
                      ${prevGodina === g
                        ? 'bg-[#024c7d] text-white border-[#024c7d] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:border-[#60c3ad]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700'}`}
                  >
                    {g}. god
                  </button>
                ))}
              </div>

              {prevGodina && (
                <>
                  <input
                    type="text"
                    value={prevSearch}
                    onChange={e => setPrevSearch(e.target.value)}
                    placeholder="Pretraži predmet..."
                    className="w-full h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 text-sm
                               text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900
                               focus:outline-none focus:ring-2 focus:ring-[#024c7d] dark:focus:ring-[#60c3ad]
                               placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                  {prevLoading ? (
                    <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                      {filteredPrev.map(p => {
                        const isSelected = prevSelected.some(s => s.year === prevGodina && s.subject === p)
                        return (
                          <label
                            key={p}
                            className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => togglePrevSubject(prevGodina, p)}
                              className="w-3.5 h-3.5 rounded accent-[#024c7d] dark:accent-[#60c3ad] shrink-0"
                            />
                            <span className={`text-xs ${isSelected ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                              {p}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </>
              )}

              {prevSelected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {prevSelected.map((s, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
                                 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    >
                      {s.year}. · {s.subject}
                      <button
                        onClick={() => togglePrevSubject(s.year, s.subject)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <span className="text-xs text-gray-400 dark:text-gray-500 w-full sm:w-auto text-center sm:text-left">
            {checkedCount} od {subjects.length} predmeta
          </span>
          <div className="flex w-full sm:w-auto items-stretch gap-2">
            <button
              onClick={() => { localStorage.removeItem('fon_saved_group'); sessionStorage.removeItem('fon_group'); router.push('/') }}
              className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500
              bg-white dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700
              hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              ← Nazad
            </button>
            <button
              onClick={handleConfirm}
              disabled={checkedCount === 0}
              className={`flex-2 sm:flex-none flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-[0.97]
                ${checkedCount > 0
                  ? 'bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0]'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500'}`}
            >
              Prikaži raspored →
            </button>
          </div>
        </div>

      </div>
    </main>
  )
}
