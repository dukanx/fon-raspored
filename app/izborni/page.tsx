'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { SemesterData } from '@/lib/types'
import { getScheduleForGroup } from '@/lib/schedule'

export default function IzbornoPage() {
  const router = useRouter()
  const [group] = useState(() => (typeof window === 'undefined'
    ? ''
    : sessionStorage.getItem('fon_group') ?? ''))
  const [year] = useState(() => (typeof window === 'undefined'
    ? ''
    : sessionStorage.getItem('fon_year') ?? ''))
  const [subjects, setSubjects] = useState<string[]>([])
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  useEffect(() => {
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
  }, [group, router, year])

  function toggle(subject: string) {
    setChecked(prev => ({ ...prev, [subject]: !prev[subject] }))
  }

  function handleConfirm() {
    localStorage.setItem(`fon_subjects_${group}`, JSON.stringify(checked))
    router.push('/raspored')
  }

  const checkedCount = Object.values(checked).filter(Boolean).length

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-8">

        <div className="mb-6">
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
                className="w-4 h-4 rounded accent-gray-900 dark:accent-gray-200 flex-shrink-0"
              />
              <span className={`text-sm ${checked[subject] ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                {subject}
              </span>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {checkedCount} od {subjects.length} predmeta
          </span>
          <button
            onClick={handleConfirm}
            disabled={checkedCount === 0}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${checkedCount > 0
                ? 'bg-gray-900 text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500'}`}
          >
            Prikaži raspored →
          </button>
        </div>

      </div>
    </main>
  )
}
