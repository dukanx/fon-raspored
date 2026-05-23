'use client'

import { useState, useEffect, useMemo, useSyncExternalStore } from 'react'
import Link from 'next/link'
import type { RokData, RokEntry } from '@/lib/types'
import NotificationBell from '@/components/NotificationBell'

const COLORS = [
  { bg: '#d6f0ec', text: '#1a5e52', bar: '#60c3ad', darkBg: '#0f3530', darkText: '#8ed8ca' },
  { bg: '#cce0f0', text: '#012f4e', bar: '#024c7d', darkBg: '#051e30', darkText: '#7ab5d8' },
  { bg: '#fff4d6', text: '#7a5a00', bar: '#ffcd67', darkBg: '#3d3200', darkText: '#ffd97a' },
  { bg: '#e8e7f5', text: '#44408a', bar: '#9a95c9', darkBg: '#1e1b3d', darkText: '#b8b4e0' },
  { bg: '#fde6e5', text: '#892d2a', bar: '#f48580', darkBg: '#3d1512', darkText: '#f4a09c' },
  { bg: '#f0d9ec', text: '#7a2e5a', bar: '#d264a7', darkBg: '#3d1a30', darkText: '#e8a8d0' },
]

const SR_MONTHS = [
  'januar', 'februar', 'mart', 'april', 'maj', 'jun',
  'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar',
]
const SR_MONTHS_SHORT = [
  'jan', 'feb', 'mar', 'apr', 'maj', 'jun',
  'jul', 'avg', 'sep', 'okt', 'nov', 'dec',
]
const SR_DAYS_SHORT = ['pon', 'uto', 'sre', 'čet', 'pet', 'sub', 'ned']

const SR_DAYS_FULL = ['ned', 'pon', 'uto', 'sre', 'čet', 'pet', 'sub']

function formatDateSr(isoDate: string) {
  const d = new Date(isoDate + 'T00:00:00')
  return `${d.getDate()}. ${SR_MONTHS_SHORT[d.getMonth()]}`
}

function getDaySr(isoDate: string) {
  return SR_DAYS_FULL[new Date(isoDate + 'T00:00:00').getDay()]
}

function buildColorMap(entries: RokEntry[]) {
  const map: Record<string, number> = {}
  let i = 0
  for (const e of entries) {
    if (!(e.subject in map)) { map[e.subject] = i % COLORS.length; i++ }
  }
  return map
}

type Tab = 'kolokvijumi' | 'ispiti'

export default function RokoviPage() {
  const [allRokovi, setAllRokovi] = useState<RokData[]>([])
  const [tab, setTab] = useState<Tab>('kolokvijumi')
  const [manualView, setManualView] = useState<'list' | 'calendar' | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [tooltip, setTooltip] = useState<{ date: string; entries: RokEntry[] } | null>(null)
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(new Set())

  const isMobile = useSyncExternalStore(
    (cb) => {
      if (typeof window === 'undefined') return () => {}
      window.addEventListener('resize', cb)
      return () => window.removeEventListener('resize', cb)
    },
    () => window.innerWidth < 640,
    () => false
  )
  const isDark = useSyncExternalStore(
    (cb) => {
      if (typeof window === 'undefined') return () => {}
      const obs = new MutationObserver(cb)
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
      return () => obs.disconnect()
    },
    () => document.documentElement.classList.contains('dark'),
    () => false
  )
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  const view: 'list' | 'calendar' = manualView ?? (isMobile ? 'list' : 'calendar')

  const meta = isHydrated
    ? {
        group: sessionStorage.getItem('fon_group') ?? '',
        year: sessionStorage.getItem('fon_year') ?? '',
        program: sessionStorage.getItem('fon_program') ?? '',
        semester: sessionStorage.getItem('fon_semester') ?? '',
      }
    : { group: '', year: '', program: '', semester: '' }

  useEffect(() => {
    if (!isHydrated) return
    const today = new Date().toISOString().split('T')[0]
    fetch('/data/rokovi.json')
      .then(r => r.json())
      .then((d: RokData[]) => {
        const data = Array.isArray(d) ? d : []
        setAllRokovi(data)
        const hasActiveKol = data.some(r => r.tip === 'kolokvijum' && r.entries.some(e => e.date >= today))
        if (hasActiveKol) {
          setTab('kolokvijumi')
        } else {
          const hasActiveIsp = data.some(r => r.tip === 'ispit' && r.entries.some(e => e.date >= today))
          setTab(hasActiveIsp ? 'ispiti' : 'kolokvijumi')
        }
        const dismissed = new Set(
          data
            .filter(r => sessionStorage.getItem('fon_dismissed_prijava_' + r.rok))
            .map(r => r.rok)
        )
        setDismissedBanners(dismissed)
      })
      .catch(() => setAllRokovi([]))
  }, [isHydrated])

  // Skup predmeta koje student sluša (regularni + preneseni iz prošlih godina)
  const userSubjects: Set<string> | null = isHydrated && meta.group
    ? (() => {
        const saved = localStorage.getItem(`fon_subjects_${meta.group}`)
        if (!saved) return null
        const checked: Record<string, boolean> = JSON.parse(saved)
        const subjects = new Set(
          Object.entries(checked).filter(([, v]) => v !== false).map(([k]) => k)
        )
        const extra = localStorage.getItem(`fon_extra_${meta.group}`)
        if (extra) {
          const extraEntries: { subject: string }[] = JSON.parse(extra)
          for (const e of extraEntries) subjects.add(e.subject)
        }
        const prev = localStorage.getItem(`fon_prev_subjects_${meta.group}`)
        if (prev) {
          const prevEntries: { subject: string }[] = JSON.parse(prev)
          for (const e of prevEntries) subjects.add(e.subject)
        }
        return subjects
      })()
    : null

  function filterEntries(entries: RokEntry[]): RokEntry[] {
    return entries.filter(e => {
      if (e.date < todayStr) return false
      if (userSubjects && !userSubjects.has(e.subject)) return false
      return true
    })
  }

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  const activeRokovi = useMemo(() => allRokovi.filter(r => {
    if (tab === 'ispiti' ? r.tip !== 'ispit' : r.tip !== 'kolokvijum') return false
    if (r.entries.length === 0) return false
    return r.entries.some(e => e.date >= todayStr)
  }), [allRokovi, tab, todayStr])

  const allFilteredEntries = useMemo(
    () => activeRokovi.flatMap(r => filterEntries(r.entries)),
    [activeRokovi, userSubjects] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const colorMap = useMemo(() => buildColorMap(allFilteredEntries), [allFilteredEntries])

  const prijavaNotice = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tipFilter = tab === 'kolokvijumi' ? 'kolokvijum' : 'ispit'
    return allRokovi.find(r => {
      if (r.tip !== tipFilter || !r.prijava_datumi?.length) return false
      if (dismissedBanners.has(r.rok)) return false
      const last = r.prijava_datumi.at(-1)!
      const [d, m, y] = last.replace(/\.$/, '').split('.')
      const deadline = new Date(+y, +m - 1, +d)
      return deadline >= today
    }) ?? null
  }, [allRokovi, tab, dismissedBanners])

  function dismissBanner(rok: string) {
    setDismissedBanners(prev => new Set([...prev, rok]))
    sessionStorage.setItem('fon_dismissed_prijava_' + rok, '1')
  }

  const byDate = useMemo(() => {
    const map: Record<string, RokEntry[]> = {}
    for (const e of allFilteredEntries) {
      if (!e.date) continue
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    }
    return map
  }, [allFilteredEntries])

  function toggleTheme() {
    const root = document.documentElement
    const willBeDark = !root.classList.contains('dark')
    root.classList.toggle('dark', willBeDark)
    localStorage.setItem('fon_theme', willBeDark ? 'dark' : 'light')
  }

  const isEmpty = activeRokovi.length === 0

  // --- Lista view ---
  function ListView() {
    const groups = activeRokovi
      .map(r => ({ label: r.rok, entries: filterEntries(r.entries).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)) }))
      .filter(g => g.entries.length > 0)

    if (!groups.length) {
      return <EmptyState />
    }

    return (
      <div className="space-y-8">
        {groups.map(g => (
          <div key={g.label}>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap">
                {g.label}
              </h2>
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
            </div>
            <div className="space-y-3">
              {Object.entries(
                g.entries.reduce((acc, e) => {
                  if (!acc[e.date]) acc[e.date] = []
                  acc[e.date].push(e)
                  return acc
                }, {} as Record<string, typeof g.entries>)
              ).map(([date, dateEntries]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {getDaySr(date)}, {formatDateSr(date)}
                    </span>
                    <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                  </div>
                  {dateEntries.map((e, i) => {
                    const c = COLORS[colorMap[e.subject]]
                    return (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <span className="text-xs text-gray-400 dark:text-gray-500 w-10 text-right shrink-0">{e.start}</span>
                        <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: c.bar }} />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-900 dark:text-gray-100 block truncate">{e.subject}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {e.rooms.join(', ')}
                            {e.note ? ` · ${e.note}` : ''}
                          </span>
                        </div>
                        {e.type && (
                          <span
                            style={{ background: isDark ? c.darkBg : c.bg, color: isDark ? c.darkText : c.text }}
                            className="text-xs font-medium px-2 py-0.5 rounded-md shrink-0"
                          >
                            {e.type === 'P' ? 'Pismeni' : e.type === 'U' ? 'Usmeni' : e.type}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // --- Kalendar view ---
  function CalendarView() {
    const { year, month } = calendarMonth
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const startOffset = (firstDay + 6) % 7

    const cells: (number | null)[] = [
      ...Array(startOffset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ]
    while (cells.length % 7 !== 0) cells.push(null)

    const weeks: (number | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

    if (isEmpty) return <EmptyState />

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCalendarMonth(prev => {
              const d = new Date(prev.year, prev.month - 1)
              return { year: d.getFullYear(), month: d.getMonth() }
            })}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700
              bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300
              hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >←</button>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">
            {SR_MONTHS[month]} {year}
          </h3>
          <button
            onClick={() => setCalendarMonth(prev => {
              const d = new Date(prev.year, prev.month + 1)
              return { year: d.getFullYear(), month: d.getMonth() }
            })}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700
              bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300
              hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >→</button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {SR_DAYS_SHORT.map(d => (
            <div key={d} className="text-center text-xs text-gray-400 dark:text-gray-500 py-1 font-medium">{d}</div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
            {week.map((day, di) => {
              if (!day) return <div key={di} />
              const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayEntries = byDate[isoDate] ?? []
              const isToday = isoDate === todayStr
              const hasEvents = dayEntries.length > 0

              return (
                <div
                  key={di}
                  onClick={() => hasEvents && setTooltip(t => t?.date === isoDate ? null : { date: isoDate, entries: dayEntries })}
                  className={`relative min-h-13 rounded-lg p-1.5 transition-colors
                    ${hasEvents ? 'cursor-pointer' : ''}
                    ${isToday ? 'border-2 border-[#024c7d] dark:border-[#60c3ad]' : 'border border-gray-100 dark:border-gray-800'}
                    ${hasEvents ? 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-900/30'}
                    ${tooltip?.date === isoDate ? 'ring-2 ring-[#024c7d]/30 dark:ring-[#60c3ad]/30' : ''}
                  `}
                >
                  <span className={`text-xs font-medium block leading-none mb-1
                    ${isToday ? 'text-[#024c7d] dark:text-[#60c3ad]' : hasEvents ? 'text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-700'}`}>
                    {day}
                  </span>
                  {hasEvents && (
                    <div className="flex flex-col gap-px mt-0.5">
                      {dayEntries.slice(0, 3).map((e, i) => (
                        <div
                          key={i}
                          className="rounded-sm px-0.5 overflow-hidden"
                          style={{ background: isDark ? COLORS[colorMap[e.subject]].darkBg : COLORS[colorMap[e.subject]].bg }}
                        >
                          <span
                            className="text-[9px] leading-tight truncate block font-medium"
                            style={{ color: isDark ? COLORS[colorMap[e.subject]].darkText : COLORS[colorMap[e.subject]].text }}
                          >
                            {e.subject}
                          </span>
                        </div>
                      ))}
                      {dayEntries.length > 3 && (
                        <span className="text-[9px] text-gray-400 dark:text-gray-500 px-0.5">+{dayEntries.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {tooltip && (
          <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {getDaySr(tooltip.date)}, {formatDateSr(tooltip.date)}
              </h4>
              <button onClick={() => setTooltip(null)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
            </div>
            <div className="space-y-3">
              {tooltip.entries.map((e, i) => {
                const c = COLORS[colorMap[e.subject]]
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-1 h-8 rounded-full shrink-0 mt-0.5" style={{ background: c.bar }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-gray-100">{e.subject}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {e.start}–{e.end} · {e.rooms.join(', ')}
                        {e.type && ` · ${e.type === 'P' ? 'Pismeni' : e.type === 'U' ? 'Usmeni' : e.type}`}
                      </p>
                      {e.note && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{e.note}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {allFilteredEntries.length > 0 && (
          <div className="mt-6 space-y-1">
            <h4 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Predmeti</h4>
            {Object.entries(colorMap).map(([subject, idx]) => (
              <div key={subject} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[idx].bar }} />
                <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{subject}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function EmptyState() {
    return (
      <div className="py-16 text-center text-gray-400 dark:text-gray-500 text-sm">
        Nema podataka za prikaz.
      </div>
    )
  }

  if (isHydrated && !meta.group) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Prvo izaberi grupu</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Da bi video svoje ispite i kolokvijume, potrebno je da prođeš kroz onboarding.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium
              bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d]
              dark:hover:bg-[#4db3a0] transition-colors"
          >
            Idi na početak →
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8">

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs">
              <Link
                href="/raspored"
                className="font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                ← Raspored
              </Link>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Ispiti i kolokvijumi</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {meta.program && `${meta.program} · `}{meta.year && `${meta.year}. godina`}
            </p>
            <NotificationBell />
            <a
              href="https://student.fon.bg.ac.rs/security/login.jsf"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-[#024c7d] dark:text-[#60c3ad] hover:underline"
            >
              Prijavi ispite na eStudent →
            </a>
          </div>

          {/* Desktop controls */}
          <div className="hidden sm:flex sm:items-center sm:gap-2">
            <div className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setManualView('calendar')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors
                  ${view === 'calendar' ? 'bg-[#024c7d] text-white dark:bg-[#60c3ad] dark:text-[#024c7d]'
                    : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'}`}
              >Kalendar</button>
              <button
                onClick={() => setManualView('list')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors
                  ${view === 'list' ? 'bg-[#024c7d] text-white dark:bg-[#60c3ad] dark:text-[#024c7d]'
                    : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'}`}
              >Lista</button>
            </div>
            <a
              href={tab === 'kolokvijumi'
                ? 'https://oas.fon.bg.ac.rs/raspored-kolokvijuma/'
                : 'https://oas.fon.bg.ac.rs/raspored-ispita/'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium
                text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900
                rounded-lg bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50
                transition-colors"
            >
              FON →
            </a>
            <button
              onClick={toggleTheme}
              className="inline-flex items-center justify-center px-3 py-1.5 text-xs text-gray-500 border border-gray-300
                rounded-lg bg-white dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700
                hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              aria-label="Promeni temu"
            >
              <img src="/moon.png" alt="Tamna tema" className="w-4 h-4 dark:hidden" />
              <img src="/sun.png" alt="Svetla tema" className="w-4 h-4 hidden dark:block" />
            </button>
          </div>

          {/* Mobile controls */}
          <div className="flex gap-2 sm:hidden">
            <button onClick={() => setManualView('list')}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors
                ${view === 'list' ? 'bg-[#024c7d] text-white dark:bg-[#60c3ad] dark:text-[#024c7d]'
                  : 'bg-white text-gray-600 border border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700'}`}
            >Lista</button>
            <button onClick={() => setManualView('calendar')}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors
                ${view === 'calendar' ? 'bg-[#024c7d] text-white dark:bg-[#60c3ad] dark:text-[#024c7d]'
                  : 'bg-white text-gray-600 border border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700'}`}
            >Kalendar</button>
            <a
              href={tab === 'kolokvijumi'
                ? 'https://oas.fon.bg.ac.rs/raspored-kolokvijuma/'
                : 'https://oas.fon.bg.ac.rs/raspored-ispita/'}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-900 text-xs font-medium
                text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/40
                hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              FON →
            </a>
            <button onClick={toggleTheme}
              className="px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-500
                bg-white dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700"
            >
              <img src="/moon.png" alt="Tamna tema" className="w-4 h-4 dark:hidden" />
              <img src="/sun.png" alt="Svetla tema" className="w-4 h-4 hidden dark:block" />
            </button>
          </div>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-1 mb-6 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
          {(['ispiti', 'kolokvijumi'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setTooltip(null) }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize
                ${tab === t
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Baner za prijavu kolokvijuma */}
        {prijavaNotice && (
          <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-xl
                          bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
            <svg className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {tab === 'kolokvijumi' ? 'Prijava predispitnih obaveza' : 'Prijava ispita'}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                {prijavaNotice.rok} · {prijavaNotice.prijava_datumi!.join(' i ')}
                {prijavaNotice.reklamacija_datum && ` · Reklamacije: ${prijavaNotice.reklamacija_datum}`}
              </p>
            </div>
            <button
              onClick={() => dismissBanner(prijavaNotice.rok)}
              className="text-amber-400 dark:text-amber-600 hover:text-amber-600 dark:hover:text-amber-400 transition-colors shrink-0 text-sm leading-none mt-0.5"
              aria-label="Zatvori"
            >
              ✕
            </button>
          </div>
        )}

        {!isHydrated ? (
          <div className="py-16 text-center text-gray-400 dark:text-gray-500 text-sm">Učitavanje...</div>
        ) : view === 'list' ? (
          <ListView />
        ) : (
          <CalendarView />
        )}

      </div>
    </main>
  )
}
