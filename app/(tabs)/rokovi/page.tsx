'use client'

import { useState, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useSwipeable } from 'react-swipeable'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

const GLASS = 'liquid-glass'

type IconProps = React.SVGProps<SVGSVGElement>
const baseIcon = (props: IconProps) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
})
const IconBack = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
)
const IconMoon = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
)
const IconSun = (p: IconProps) => (
  <svg {...baseIcon(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
)
const IconExternal = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
)
const IconCalendar = (p: IconProps) => (
  <svg {...baseIcon(p)}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
)
const IconList = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
)
const IconHidden = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 9 5 9 5s-.9 1.1-2.3 2.4" /><path d="M6.6 6.6C4.4 8 3 10 3 10s4 5 9 5c1.2 0 2.3-.2 3.3-.6" /></svg>
)

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

function rokEntryKey(e: RokEntry) {
  return `${e.date}|${e.start}|${e.subject}|${e.type ?? ''}`
}

// Dodaje predmete drugog semestra u set za filtriranje rokova:
// - fon_other_sem_${group}: predmeti drugog semestra koje je student ručno štiklirao
// - fon_subjects_history: akumulirani izbor po semestrima (za mešane Sep/Okt rokove)
function addOtherSemesterSubjects(set: Set<string>, group: string) {
  const other = localStorage.getItem(`fon_other_sem_${group}`)
  if (other) {
    for (const s of JSON.parse(other) as string[]) set.add(s)
  }
  const hist = localStorage.getItem('fon_subjects_history')
  if (hist) {
    for (const arr of Object.values(JSON.parse(hist) as Record<string, string[]>)) {
      for (const s of arr) set.add(s)
    }
  }
}

function escapeICS(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function SwipeableListItem({ onHide, children }: { onHide: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const handlers = useSwipeable({
    onSwipedLeft: () => setOpen(true),
    onSwipedRight: () => setOpen(false),
    preventScrollOnSwipe: true,
    trackMouse: false,
  })
  return (
    <div className="relative overflow-hidden rounded-2xl sm:overflow-visible">
      <div
        className="absolute inset-y-0 right-0 flex w-16 items-center justify-center sm:hidden transition-opacity duration-200"
        style={{ opacity: open ? 1 : 0 }}
      >
        <button
          onClick={() => { onHide(); setOpen(false) }}
          className="flex h-9 w-9 items-center justify-center rounded-full
                     text-red-500 bg-red-50 dark:bg-red-950/60 dark:text-red-400
                     hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
          aria-label="Sakrij termin"
        >
          ✕
        </button>
      </div>
      <div
        {...handlers}
        className="transition-transform duration-200 sm:transform-none"
        style={{ transform: open ? 'translateX(-64px)' : 'translateX(0)' }}
      >
        {children}
      </div>
    </div>
  )
}

type Tab = 'kolokvijumi' | 'ispiti'

export default function RokoviPage() {
  const router = useRouter()
  const [allRokovi, setAllRokovi] = useState<RokData[]>([])
  const [tab, setTab] = useState<Tab>('kolokvijumi')
  const [manualView, setManualView] = useState<'list' | 'calendar' | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [tooltip, setTooltip] = useState<{ date: string } | null>(null)
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(new Set())
  const [hiddenEntries, setHiddenEntries] = useState<RokEntry[]>([])
  const [showHidden, setShowHidden] = useState(false)
  const [downloadToast, setDownloadToast] = useState(false)

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
        const savedSubjects = meta.group ? localStorage.getItem(`fon_subjects_${meta.group}`) : null
        const subjectSet: Set<string> | null = savedSubjects
          ? new Set(Object.entries(JSON.parse(savedSubjects)).filter(([, v]) => v !== false).map(([k]) => k))
          : null
        const extra = meta.group ? localStorage.getItem(`fon_extra_${meta.group}`) : null
        if (subjectSet && extra) {
          for (const e of JSON.parse(extra) as { subject: string }[]) subjectSet.add(e.subject)
        }
        const prev = meta.group ? localStorage.getItem(`fon_prev_subjects_${meta.group}`) : null
        if (subjectSet && prev) {
          for (const e of JSON.parse(prev) as { subject: string }[]) subjectSet.add(e.subject)
        }
        if (subjectSet && meta.group) addOtherSemesterSubjects(subjectSet, meta.group)

        const nearestDate = (tip: string) =>
          data
            .filter(r => r.tip === tip)
            .flatMap(r => r.entries.filter(e => !subjectSet || subjectSet.has(e.subject)).map(e => e.date))
            .filter(d => d >= today)
            .sort()[0] ?? null

        const nearestKol = nearestDate('kolokvijum')
        const nearestIsp = nearestDate('ispit')

        if (!nearestKol && !nearestIsp) {
          setTab('kolokvijumi')
        } else if (!nearestKol) {
          setTab('ispiti')
        } else if (!nearestIsp) {
          setTab('kolokvijumi')
        } else {
          setTab(nearestIsp <= nearestKol ? 'ispiti' : 'kolokvijumi')
        }
        const dismissed = new Set(
          data
            .filter(r => sessionStorage.getItem('fon_dismissed_prijava_' + r.rok))
            .map(r => r.rok)
        )
        setDismissedBanners(dismissed)
      })
      .catch(() => setAllRokovi([]))
  }, [isHydrated, meta.group])

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
        addOtherSemesterSubjects(subjects, meta.group)
        return subjects
      })()
    : null

  const hiddenKeys = useMemo(() => new Set(hiddenEntries.map(rokEntryKey)), [hiddenEntries])

  // Skriveni termini se čuvaju odvojeno po tabu i grupi
  useEffect(() => {
    if (!isHydrated || !meta.group) { setHiddenEntries([]); return }
    const raw = localStorage.getItem(`fon_rok_hidden_${tab}_${meta.group}`)
    setHiddenEntries(raw ? JSON.parse(raw) : [])
    setShowHidden(false)
  }, [isHydrated, tab, meta.group])

  function hideEntry(e: RokEntry) {
    if (hiddenKeys.has(rokEntryKey(e))) return
    const next = [...hiddenEntries, e]
    setHiddenEntries(next)
    localStorage.setItem(`fon_rok_hidden_${tab}_${meta.group}`, JSON.stringify(next))
  }

  function restoreEntry(e: RokEntry) {
    const key = rokEntryKey(e)
    const next = hiddenEntries.filter(h => rokEntryKey(h) !== key)
    setHiddenEntries(next)
    localStorage.setItem(`fon_rok_hidden_${tab}_${meta.group}`, JSON.stringify(next))
  }

  function filterEntries(entries: RokEntry[]): RokEntry[] {
    return entries.filter(e => {
      if (e.date < todayStr) return false
      if (userSubjects && !userSubjects.has(e.subject)) return false
      if (hiddenKeys.has(rokEntryKey(e))) return false
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
    [activeRokovi, userSubjects, hiddenKeys] // eslint-disable-line react-hooks/exhaustive-deps
  )

  function downloadICS() {
    if (!allFilteredEntries.length) return
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FON Raspored//SR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ]
    const sorted = [...allFilteredEntries].sort(
      (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)
    )
    for (const e of sorted) {
      const dateStr = e.date.replace(/-/g, '')
      const [sh, sm] = e.start.split(':')
      const [eh, em] = e.end.split(':')
      const typeLabel = e.type === 'P' ? 'Pismeni' : e.type === 'U' ? 'Usmeni' : ''
      const desc = [tab === 'ispiti' ? 'Ispit' : 'Kolokvijum', e.note].filter(Boolean).join(' · ')
      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${dateStr}-${sh}${sm}-${e.subject.replace(/\s/g, '')}-${e.type ?? ''}@fonraspored`)
      lines.push(`DTSTART;TZID=Europe/Belgrade:${dateStr}T${sh}${sm}00`)
      lines.push(`DTEND;TZID=Europe/Belgrade:${dateStr}T${eh}${em}00`)
      lines.push(`SUMMARY:${escapeICS(e.subject + (typeLabel ? ` [${typeLabel}]` : ''))}`)
      if (e.rooms.length) lines.push(`LOCATION:${escapeICS(e.rooms.join(', '))}`)
      lines.push(`DESCRIPTION:${escapeICS(desc)}`)
      // Podsetnik dan ranije
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Podsetnik', 'TRIGGER:-P1D', 'END:VALARM')
      lines.push('END:VEVENT')
    }
    lines.push('END:VCALENDAR')

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
    const link = document.createElement('a')
    link.download = `${tab}-${meta.group}.ics`
    link.href = URL.createObjectURL(blob)
    link.click()
    setDownloadToast(true)
    setTimeout(() => setDownloadToast(false), 3500)
  }

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

  function ActionButtons() {
    return (
      <>
        <button
          onClick={downloadICS}
          disabled={allFilteredEntries.length === 0}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium
            text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70
            disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
        >
          <IconCalendar className="h-4 w-4 opacity-80" />
          Izvezi u kalendar
        </button>
        {hiddenEntries.length > 0 && (
          <button
            onClick={() => setShowHidden(s => !s)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium
              text-gray-500 dark:text-gray-400 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
          >
            <IconHidden className="h-4 w-4 opacity-80" />
            Skriveni ({hiddenEntries.length})
          </button>
        )}
      </>
    )
  }

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
                      <SwipeableListItem key={i} onHide={() => hideEntry(e)}>
                        <div className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
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
                          <button
                            onClick={() => hideEntry(e)}
                            className="hidden sm:flex w-6 h-6 items-center justify-center rounded-md text-gray-300 dark:text-gray-600 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-400 transition-colors shrink-0 text-xs"
                            aria-label="Sakrij termin"
                          >
                            ✕
                          </button>
                        </div>
                      </SwipeableListItem>
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
            className={`rounded-lg px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
          >←</button>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">
            {SR_MONTHS[month]} {year}
          </h3>
          <button
            onClick={() => setCalendarMonth(prev => {
              const d = new Date(prev.year, prev.month + 1)
              return { year: d.getFullYear(), month: d.getMonth() }
            })}
            className={`rounded-lg px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
          >→</button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1 sm:gap-1.5">
          {SR_DAYS_SHORT.map(d => (
            <div key={d} className="text-center text-xs text-gray-400 dark:text-gray-500 py-1 font-medium">{d}</div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className="mb-1 grid grid-cols-7 gap-1 sm:mb-1.5 sm:gap-1.5">
            {week.map((day, di) => {
              if (!day) return <div key={di} />
              const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayEntries = byDate[isoDate] ?? []
              const isToday = isoDate === todayStr
              const hasEvents = dayEntries.length > 0

              return (
                <div
                  key={di}
                  onClick={() => hasEvents && setTooltip(t => t?.date === isoDate ? null : { date: isoDate })}
                  className={`relative min-h-13 rounded-lg p-1.5 transition-colors sm:min-h-20 sm:p-2
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

        {tooltip && (byDate[tooltip.date]?.length ?? 0) > 0 && (
          <div className={`mt-4 rounded-xl p-4 ${GLASS}`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {getDaySr(tooltip.date)}, {formatDateSr(tooltip.date)}
              </h4>
              <button
                onClick={() => setTooltip(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-base leading-none text-gray-400 transition-colors hover:bg-white/70 hover:text-gray-700 dark:hover:bg-gray-800/70 dark:hover:text-gray-100"
                aria-label="Zatvori detalje"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              {(byDate[tooltip.date] ?? []).map((e, i) => {
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
                    <button
                      onClick={() => hideEntry(e)}
                      className="w-6 h-6 flex items-center justify-center rounded-md text-gray-300 dark:text-gray-600 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-400 transition-colors shrink-0 text-xs"
                      aria-label="Sakrij termin"
                    >
                      ✕
                    </button>
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
    <main className="min-h-screen pb-32 sm:pb-0">
      <div className="mx-auto max-w-4xl px-3 py-3 sm:px-4 sm:py-8">

        <header className="mb-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Rokovi</h1>
              <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
                {meta.program && `${meta.program} · `}{meta.year && `${meta.year}. godina`}
              </p>
              <div className="mt-2 flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row sm:items-start sm:gap-3">
                <NotificationBell className="min-w-0" />
                <a
                  href="https://student.fon.bg.ac.rs/security/login.jsf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center rounded-lg bg-[#024c7d]/10 px-3 py-1.5 text-xs font-semibold text-[#024c7d]
                             hover:bg-[#024c7d]/15 dark:bg-[#60c3ad]/10 dark:text-[#60c3ad] dark:hover:bg-[#60c3ad]/15 transition-colors"
                >
                  eStudent →
                </a>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => router.push('/raspored')}
                className={`hidden items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 sm:inline-flex ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
              >
                <IconBack className="h-4 w-4 opacity-80" />
                Nazad
              </button>
              <button
                onClick={toggleTheme}
                aria-label="Promeni temu"
                className={`flex h-9 w-9 items-center justify-center rounded-full text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
              >
                <IconMoon className="h-[18px] w-[18px] dark:hidden" />
                <IconSun className="hidden h-[18px] w-[18px] dark:block" />
              </button>
              <a
                href={tab === 'kolokvijumi'
                  ? 'https://oas.fon.bg.ac.rs/raspored-kolokvijuma/'
                  : 'https://oas.fon.bg.ac.rs/raspored-ispita/'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#024c7d]/20 dark:border-[#60c3ad]/25
                           bg-[#024c7d]/10 dark:bg-[#60c3ad]/10 px-3 py-2 text-xs font-semibold backdrop-blur-2xl
                           text-[#024c7d] dark:text-[#60c3ad] hover:bg-[#024c7d]/15 dark:hover:bg-[#60c3ad]/15 transition-colors"
              >
                FON <IconExternal className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className={`inline-flex rounded-full p-1 ${GLASS}`}>
              {([['list', 'Lista', IconList], ['calendar', 'Kalendar', IconCalendar]] as const).map(([v, label, Icon]) => (
                <button
                  key={v}
                  onClick={() => setManualView(v)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors
                    ${view === v
                      ? 'bg-white text-[#024c7d] shadow-sm dark:bg-gray-700 dark:text-[#60c3ad]'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {isHydrated && !isEmpty && (
              <div className="hidden items-center gap-2 sm:flex">
                <ActionButtons />
              </div>
            )}
          </div>
        </header>

        {/* Akcije (mobilni): izvoz u kalendar + skriveni termini */}
        {isHydrated && !isEmpty && (
          <div className="mb-5 flex flex-wrap items-center gap-2 sm:hidden">
            <ActionButtons />
          </div>
        )}

        <div className="mb-6 flex items-center justify-between gap-3 border-b border-gray-200/70 dark:border-gray-800/80">
          <div className="flex items-end gap-6">
            {(['ispiti', 'kolokvijumi'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setTooltip(null) }}
                className={`no-hover-lift relative pb-2 text-sm font-semibold transition-colors capitalize
                  ${tab === t
                    ? 'text-[#024c7d] dark:text-[#60c3ad]'
                    : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'}`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {tab === t && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#024c7d] dark:bg-[#60c3ad]" />
                )}
              </button>
            ))}
          </div>
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
                {prijavaNotice.rok} · {prijavaNotice.prijava_datumi!.join(' - ')}
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

        {showHidden && hiddenEntries.length > 0 && (
          <div className={`mb-5 rounded-xl p-4 ${GLASS}`}>
            <h4 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
              Skriveni termini
            </h4>
            <div className="space-y-2">
              {hiddenEntries.map((e, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-700 dark:text-gray-300 block truncate">{e.subject}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {getDaySr(e.date)}, {formatDateSr(e.date)} · {e.start}
                      {e.type && ` · ${e.type === 'P' ? 'Pismeni' : e.type === 'U' ? 'Usmeni' : e.type}`}
                    </span>
                  </div>
                  <button
                    onClick={() => restoreEntry(e)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md shrink-0
                      text-[#024c7d] dark:text-[#60c3ad] border border-[#024c7d]/30 dark:border-[#60c3ad]/30
                      hover:bg-[#024c7d]/5 dark:hover:bg-[#60c3ad]/10 transition-colors"
                  >
                    Vrati
                  </button>
                </div>
              ))}
            </div>
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

      {downloadToast && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-100 sm:bottom-6">
          <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium">
            <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 dark:text-green-600 flex items-center justify-center shrink-0">
              ✓
            </span>
            Kalendar (.ics) preuzet — otvori fajl da dodaš termine.
          </div>
        </div>
      )}
    </main>
  )
}
