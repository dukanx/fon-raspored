'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import type { SemesterData, ScheduleEntry, DayOfWeek } from '@/lib/types'
import { getScheduleForGroup } from '@/lib/schedule'
import Link from 'next/link'

const DAYS: DayOfWeek[] = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak']
const DAY_SHORT: Record<DayOfWeek, string> = {
  Ponedeljak: 'Pon', Utorak: 'Uto', Sreda: 'Sre', Četvrtak: 'Čet', Petak: 'Pet'
}


const SLOTS = ['08:15', '10:15', '12:15', '14:15', '16:15', '18:15']
const SLOT_LABEL: Record<string, string> = {
  '08:15': '08:15–10:00',
  '10:15': '10:15–12:00',
  '12:15': '12:15–14:00',
  '14:15': '14:15–16:00',
  '16:15': '16:15–18:00',
  '18:15': '18:15–20:00',
}

const COLORS = [
  { bg: '#d6f0ec', text: '#1a5e52', bar: '#60c3ad', darkBg: '#0f3530', darkText: '#8ed8ca' },
  { bg: '#cce0f0', text: '#012f4e', bar: '#024c7d', darkBg: '#051e30', darkText: '#7ab5d8' },
  { bg: '#fff4d6', text: '#7a5a00', bar: '#ffcd67', darkBg: '#3d3200', darkText: '#ffd97a' },
  { bg: '#e8e7f5', text: '#44408a', bar: '#9a95c9', darkBg: '#1e1b3d', darkText: '#b8b4e0' },
  { bg: '#fde6e5', text: '#892d2a', bar: '#f48580', darkBg: '#3d1512', darkText: '#f4a09c' },
  { bg: '#f0d9ec', text: '#7a2e5a', bar: '#d264a7', darkBg: '#3d1a30', darkText: '#e8a8d0' },
]

function useSubjectColors(entries: ScheduleEntry[]) {
  const map: Record<string, number> = {}
  let i = 0
  for (const e of entries) {
    if (!(e.subject in map)) {
      map[e.subject] = i % COLORS.length
      i++
    }
  }
  return map
}

export default function RasporedPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [manualView, setManualView] = useState<'grid' | 'list' | null>(null)
  const [showIcsHelp, setShowIcsHelp] = useState(false)
  const [showDownloadToast, setShowDownloadToast] = useState(false)

  const isMobile = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') return () => { }
      window.addEventListener('resize', onStoreChange)
      return () => window.removeEventListener('resize', onStoreChange)
    },
    () => window.innerWidth < 640,
    () => false
  )
  const isDark = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') return () => { }
      const observer = new MutationObserver(onStoreChange)
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
      return () => observer.disconnect()
    },
    () => document.documentElement.classList.contains('dark'),
    () => false
  )
  const isHydrated = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false
  )
  
  const view: 'grid' | 'list' = manualView ?? (isMobile ? 'list' : 'grid')
  const meta = isHydrated
    ? {
      group: sessionStorage.getItem('fon_group') ?? '',
      year: sessionStorage.getItem('fon_year') ?? '',
      lastName: sessionStorage.getItem('fon_lastName') ?? '',
      semester: sessionStorage.getItem('fon_semester') ?? '',
      program: sessionStorage.getItem('fon_program') ?? '',
    }
    : { group: '', year: '', lastName: '', semester: '', program: '' }

  useEffect(() => {
    if (!isHydrated) return

    if (!meta.group || !meta.year) {
      router.replace('/')
      return
    }

    fetch(`/data/${meta.year}god.json`)
      .then(r => r.json())
      .then((data: SemesterData) => {
        const all = getScheduleForGroup(data, meta.group)
        const saved = localStorage.getItem(`fon_subjects_${meta.group}`)
        const checked: Record<string, boolean> = saved ? JSON.parse(saved) : {}
        let base = saved ? all.filter(e => checked[e.subject] !== false) : all

        const extraRaw = localStorage.getItem(`fon_extra_${meta.group}`)
        const extra: ScheduleEntry[] = extraRaw ? JSON.parse(extraRaw) : []

        // MAGIJA: Filtriramo iz base sve termine koje preneseni predmeti direktno gaze (isti dan, isto vreme početka)
        base = base.filter(b => !extra.some(ex => ex.day === b.day && ex.start === b.start))

        const merged = [...base]
        for (const item of extra) {
          const exists = merged.some(e =>
            e.subject === item.subject &&
            e.day === item.day &&
            e.start === item.start &&
            e.type_short === item.type_short &&
            e.room === item.room
          )
          if (!exists) merged.push(item)
        }

        setEntries(merged)
      })
  }, [isHydrated, meta.group, meta.year, router])
  function toggleTheme() {
    const root = document.documentElement
    const willBeDark = !root.classList.contains('dark')
    root.classList.toggle('dark', willBeDark)
    localStorage.setItem('fon_theme', willBeDark ? 'dark' : 'light')
  }

  const colorMap = useSubjectColors(entries)
  function downloadPNG() {
    const canvas = document.createElement('canvas')
    const dpr = 2
    const colW = 160
    const rowH = 80
    const headerH = 32
    const timeW = 56
    const padding = 16

    canvas.width = (timeW + colW * 5 + padding * 2) * dpr
    canvas.height = (headerH + rowH * SLOTS.length + padding * 2) * dpr

    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    // Pozadina
    ctx.fillStyle = '#f9fafb'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Grid area bela
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(padding + timeW, padding, colW * 5, headerH + rowH * SLOTS.length)

    // Dan headeri
    const dayNames = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet']
    dayNames.forEach((d, i) => {
      ctx.fillStyle = '#6b7280'
      ctx.font = '500 11px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(d, padding + timeW + colW * i + colW / 2, padding + 20)
    })

    // Grid linije
    ctx.strokeStyle = '#f3f4f6'
    ctx.lineWidth = 1

    SLOTS.forEach((_, si) => {
      const y = padding + headerH + rowH * si
      ctx.beginPath()
      ctx.moveTo(padding + timeW, y)
      ctx.lineTo(padding + timeW + colW * 5, y)
      ctx.stroke()
    })

    dayNames.forEach((_, di) => {
      const x = padding + timeW + colW * di
      ctx.beginPath()
      ctx.moveTo(x, padding + headerH)
      ctx.lineTo(x, padding + headerH + rowH * SLOTS.length)
      ctx.stroke()
    })

    // Vreme i blokovi
    SLOTS.forEach((slot, si) => {
      const y = padding + headerH + rowH * si

      // Vreme label
      ctx.fillStyle = '#9ca3af'
      ctx.font = '11px system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(slot, padding + timeW - 6, y + 16)

      DAYS.forEach((day, di) => {
        const x = padding + timeW + colW * di
        const cell = entries.filter(e => e.day === day && e.start === slot)

        if (!cell.length) return

        const blockH = (rowH - 8) / cell.length

        cell.forEach((e, bi) => {
          const c = COLORS[colorMap[e.subject]]
          const bx = x + 3
          const by = y + 4 + blockH * bi
          const bw = colW - 6
          const bh = blockH - 3

          // Blok pozadina
          ctx.fillStyle = c.bg
          ctx.beginPath()
          ctx.roundRect(bx, by, bw, bh, 6)
          ctx.fill()

          // Naziv predmeta
          ctx.fillStyle = c.text
          ctx.font = '500 10px system-ui, sans-serif'
          ctx.textAlign = 'left'

          // Wrap tekst
          const words = e.subject.split(' ')
          let line = ''
          let lineY = by + 13
          for (const word of words) {
            const test = line + word + ' '
            if (ctx.measureText(test).width > bw - 8 && line) {
              ctx.fillText(line.trim(), bx + 5, lineY)
              line = word + ' '
              lineY += 12
              if (lineY > by + bh - 8) break
            } else {
              line = test
            }
          }
          if (line) ctx.fillText(line.trim(), bx + 5, lineY)

          // Tip i sala
          ctx.fillStyle = c.text
          ctx.globalAlpha = 0.7
          ctx.font = '10px system-ui, sans-serif'
          ctx.fillText(`${e.type_short} · ${e.room}`, bx + 5, by + bh - 5)
          ctx.globalAlpha = 1
        })
      })
    })

    // Header info
    ctx.fillStyle = '#111827'
    ctx.font = '500 13px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`${meta.lastName} · Grupa ${meta.group} · ${meta.semester}`, padding + timeW, padding - 4)

    const link = document.createElement('a')
    link.download = `raspored-${meta.group}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    setShowDownloadToast(true)
    setTimeout(() => setShowDownloadToast(false), 3000)
  }

  function downloadICS() {
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FON Raspored//SR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ]

    // Datum prvog ponedeljka tekuće sedmice
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))

    const DAY_OFFSET: Record<DayOfWeek, number> = {
      Ponedeljak: 0, Utorak: 1, Sreda: 2, Četvrtak: 3, Petak: 4
    }

    entries.forEach(e => {
      const offset = DAY_OFFSET[e.day]
      const date = new Date(monday)
      date.setDate(monday.getDate() + offset)

      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')

      const [startH, startM] = e.start.split(':')
      const [endH, endM] = e.end.split(':')

      const dtstart = `${dateStr}T${startH}${startM}00`
      const dtend = `${dateStr}T${endH}${endM}00`

      const uid = `${dateStr}-${e.subject.replace(/\s/g, '')}-${e.type_short}@fonraspored`

      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${uid}`)
      lines.push(`DTSTART;TZID=Europe/Belgrade:${dtstart}`)
      lines.push(`DTEND;TZID=Europe/Belgrade:${dtend}`)
      lines.push(`SUMMARY:${e.subject} [${e.type_short}]`)
      lines.push(`LOCATION:Sala ${e.room}`)
      lines.push(`DESCRIPTION:Grupa ${meta.group}`)
      const now = new Date()
      const isLetnji = now.getMonth() >= 1 && now.getMonth() <= 7
      const endDate = isLetnji
        ? `${now.getFullYear()}0630T235959Z`
        : `${now.getFullYear()}0131T235959Z`

      lines.push(`RRULE:FREQ=WEEKLY;UNTIL=${endDate}`)
      lines.push('END:VEVENT')
    })

    lines.push('END:VCALENDAR')

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
    const link = document.createElement('a')
    link.download = `raspored-${meta.group}.ics`
    link.href = URL.createObjectURL(blob)
    link.click()
   
    
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs">
              <Link 
                href="/" 
                className="font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                1. Podaci
              </Link>
              <span className="text-gray-300 dark:text-gray-700">→</span>
              <Link 
                href="/izborni" 
                className="font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                2. Predmeti
              </Link>
              <span className="text-gray-300 dark:text-gray-700">→</span>
              <span className="font-semibold text-[#024c7d] dark:text-[#60c3ad]">
                3. Raspored
              </span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Grupa {meta.group}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {meta.program && `${meta.program} · `}{meta.semester}
            </p>
          </div>

          {/* Mobile controls */}
          <div className="grid w-full grid-cols-2 gap-2 sm:hidden">
            <button
              onClick={() => setManualView('list')}
              className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-medium transition-colors
              ${view === 'list'
                  ? 'bg-[#024c7d] text-white dark:bg-[#60c3ad] dark:text-[#024c7d]'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-800'}`}
            >
              Lista
            </button>

            <button
              onClick={toggleTheme}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500
              bg-white dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700
              hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              aria-label="Promeni temu"
            >
              <span className="dark:hidden">🌙</span>
              <span className="hidden dark:inline">🔅</span>
            </button>

            <button
              onClick={downloadPNG}
              className="col-span-2 inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500
              bg-white dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700
              hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Slika      ↓
            </button>

            <button
              onClick={() => { downloadICS(); setShowIcsHelp(true) }}
              className="col-span-2 inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500
              bg-white dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700
              hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Izvezi u kalendar      ↗
            </button>

            <button
              onClick={() => router.push('/preneseni')}
              className="col-span-2 inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500
              bg-white dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700
              hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Izmeni / Dodaj termine        +
            </button>

            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500
              bg-white dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700
              hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              ← Nazad
            </button>

            <a
              href="https://oas.fon.bg.ac.rs/raspored-nastave/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-blue-200 dark:border-blue-900 px-3 py-2 text-xs font-medium
              text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/40
              hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              FON →
            </a>
          </div>

          {/* Desktop controls */}
          <div className="hidden sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
            <div className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setManualView('grid')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors
        ${view === 'grid'
                    ? 'bg-[#024c7d] text-white dark:bg-[#60c3ad] dark:text-[#024c7d]'
                    : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'}`}
              >
                Sedmica
              </button>
              <button
                onClick={() => setManualView('list')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors
        ${view === 'list'
                    ? 'bg-[#024c7d] text-white dark:bg-[#60c3ad] dark:text-[#024c7d]'
                    : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'}`}
              >
                Lista
              </button>
            </div>

            <button
              onClick={toggleTheme}
              className="inline-flex items-center justify-center px-3 py-1.5 text-xs text-gray-500 border border-gray-300
             rounded-lg bg-white dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700
             hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              aria-label="Promeni temu"
            >
              <span className="dark:hidden">🌙</span>
              <span className="hidden dark:inline">🔅</span>
            </button>

            <div className="w-px h-5 bg-gray-300 dark:bg-gray-700" />

            <button
              onClick={downloadPNG}
              className="inline-flex items-center justify-center px-3 py-1.5 text-xs text-gray-500 border border-gray-300
               rounded-lg bg-white dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700
               hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              ↓ Slika
            </button>

            <button
              onClick={() => { downloadICS(); setShowIcsHelp(true) }}
              className="inline-flex items-center justify-center px-3 py-1.5 text-xs text-gray-500 border border-gray-300
             rounded-lg bg-white dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700
             hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              ↗ Izvezi u kalendar
            </button>

            <div className="w-px h-5 bg-gray-300 dark:bg-gray-700" />

            <button
              onClick={() => router.push('/preneseni')}
              className="px-3 py-1.5 text-xs text-gray-500 border border-gray-300
             rounded-lg bg-white dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700
             hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              + Izmeni / Dodaj termine
            </button>
            {/* FON i Nazad — novi red */}
            <div className="w-full flex justify-end gap-2">
              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center justify-center px-3 py-1.5 text-xs text-gray-500 border border-gray-300
                 rounded-lg bg-white dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700
                 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                ← Nazad
              </button>
              <a
                href="https://oas.fon.bg.ac.rs/raspored-nastave/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium
               text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900
               rounded-lg bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50
               transition-colors"
              >
                FON →
              </a>

            </div>
          </div>
        </div>

        {/* Grid view - samo na sm+ */}
        {view === 'grid' && (
          <div className="hidden sm:block">
            <div className="overflow-x-auto">
              <div id="raspored-grid" className="min-w-[640px]">

                {/* Day headers */}
                <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: '56px repeat(5, 1fr)' }}>
                  <div />
                  {DAYS.map(d => (
                    <div key={d} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1">
                      {DAY_SHORT[d]}
                    </div>
                  ))}
                </div>

                {/* Slots */}
                {SLOTS.map(slot => (
                  <div
                    key={slot}
                    className="grid gap-1 mb-1"
                    style={{ gridTemplateColumns: '56px repeat(5, 1fr)' }}
                  >
                    <div className="text-right pr-2 pt-1.5 text-xs text-gray-400 dark:text-gray-500 leading-tight">
                      {slot}
                    </div>
                    {DAYS.map(day => {
                      const cell = entries.filter(e => e.day === day && e.start === slot)
                      if (!cell.length) {
                        return <div key={day} className="min-h-[64px] rounded-lg bg-gray-100/60 dark:bg-gray-800/60 border border-gray-200 dark:border-0 outline-none" />
                      }
                      return (
                        <div key={day} className="flex flex-col gap-1">
                          {cell.map((e, i) => {
                            const c = COLORS[colorMap[e.subject]]
                            return (
                              <div key={i} style={{ background: isDark ? c.darkBg : c.bg }} className="flex-1 rounded-lg p-2 min-h-[64px]">
                                <p style={{ color: isDark ? c.darkText : c.text }} className="text-xs font-medium leading-snug line-clamp-2">
                                  {e.subject}
                                </p>
                                <p style={{ color: isDark ? c.darkText : c.text }} className="text-xs mt-1 opacity-70">
                                  {e.type_short} · {e.room}
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                ))}

              </div>
            </div>
          </div>
        )}

        {/* Lista - uvek dostupna, default na mobilnom */}
        {view === 'list' && (
          <div className="space-y-6">
            {DAYS.map(day => {
              const dayEntries = entries
                .filter(e => e.day === day)
                .sort((a, b) => a.start.localeCompare(b.start))

              if (!dayEntries.length) return null

              return (
                <div key={day}>
                  <h2 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider
                                 mb-2 pb-2 border-b border-gray-200 dark:border-gray-800">
                    {day}
                  </h2>
                  <div className="space-y-1">
                    {dayEntries.map((e, i) => {
                      const c = COLORS[colorMap[e.subject]]
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-gray-800"
                        >
                          <span className="text-xs text-gray-400 dark:text-gray-500 w-24 flex-shrink-0">
                            {SLOT_LABEL[e.start]}
                          </span>
                          <div className={`w-1 self-stretch rounded-full`} style={{ background: c.bar }} />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-900 dark:text-gray-100 block truncate">
                              {e.subject}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {e.room}
                            </span>
                          </div>
                          <span style={{ background: isDark ? c.darkBg : c.bg, color: isDark ? c.darkText : c.text }} className="text-xs font-medium px-2 py-0.5 rounded-md flex-shrink-0">
                            {e.type_short}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
      {/* ICS tutorial modal */}
      {showIcsHelp && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center
               justify-center z-50 px-4 pb-4 sm:pb-0"
          onClick={() => setShowIcsHelp(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Kako dodati u kalendar
            </h2>

            <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs
                           flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <p>Fajl <strong className="text-gray-900 dark:text-gray-100">raspored.ics</strong> je upravo preuzet na tvoj uređaj.</p>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs
                           flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <p>Otvori <strong className="text-gray-900 dark:text-gray-100">Google Calendar</strong> na računaru ili telefonu.</p>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs
                           flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <p>Na računaru: klikni <strong className="text-gray-900 dark:text-gray-100">Podešavanja → Uvoz i izvoz</strong> i odaberi preuzeti fajl.</p>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs
                           flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                <p>Na telefonu: pronađi fajl u Downloads i klikni na njega — kalendar će se otvoriti automatski.</p>
              </div>
            </div>

            <button
              onClick={() => setShowIcsHelp(false)}
              className="mt-6 w-full py-2.5 rounded-lg text-sm font-medium transition-all active:scale-[0.97]
                   bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d]
                   dark:hover:bg-[#4db3a0] transition-colors"
            >
              Razumeo
            </button>
          </div>
        </div>
      )}

      {showDownloadToast && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[100] animate-bounce">
          <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium">
            <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 dark:bg-green-500/20 dark:text-green-600 flex items-center justify-center flex-shrink-0">
              ✓
            </span>
            Slika rasporeda je uspešno preuzeta!
          </div>
        </div>
      )}
    </main>
  )
}
