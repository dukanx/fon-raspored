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

  useEffect(() => {
    if (!isHydrated) return
    if (!group || !year) { router.replace('/'); return }

    fetch(`/data/${year}god.json`)
      .then(r => r.json())
      .then((data: SemesterData) => {
        const entries = getScheduleForGroup(data, group)
        const unique = [...new Set(entries.map(e => e.subject))].sort()
        setSubjects(unique)

        // Učitaj sačuvane izbore ili sve čekiraj
        const saved = localStorage.getItem(`fon_subjects_${group}`)
        if (saved) {
          setChecked(JSON.parse(saved))
        } else {
          const all: Record<string, boolean> = {}
          unique.forEach(s => { all[s] = true })
          setChecked(all)
        }
      })
  }, [group, isHydrated, router, year])

  function toggle(subject: string) {
    setChecked(prev => ({ ...prev, [subject]: !prev[subject] }))
  }

  function handleConfirm() {
    localStorage.setItem(`fon_subjects_${group}`, JSON.stringify(checked))
    router.push('/raspored')
  }

  const checkedCount = Object.values(checked).filter(Boolean).length

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

        <div className="space-y-1 mb-6 max-h-96 overflow-y-auto">
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
                className="w-4 h-4 rounded accent-[#024c7d] dark:accent-[#60c3ad] flex-shrink-0"
              />
              <span className={`text-sm ${checked[subject] ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                {subject}
              </span>
            </label>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          
          {/* Brojač predmeta */}
          <span className="text-xs text-gray-400 dark:text-gray-500 w-full sm:w-auto text-center sm:text-left">
            {checkedCount} od {subjects.length} predmeta
          </span>

          {/* Dugmići */}
          <div className="flex w-full sm:w-auto items-stretch gap-2">
            <button
              onClick={() => router.push('/')}
              className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500
              bg-white dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700
              hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              ← Nazad
            </button>
            <button
              onClick={handleConfirm}
              disabled={checkedCount === 0}
              className={`flex-[2] sm:flex-none flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-[0.97]
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
