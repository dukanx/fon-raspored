'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { SemesterData, ScheduleEntry, DayOfWeek } from '@/lib/types'
import { getScheduleForGroup } from '@/lib/schedule'


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
  { bg: '#ede9fe', text: '#5b21b6', bar: '#a78bfa' },
  { bg: '#ccfbf1', text: '#065f46', bar: '#2dd4bf' },
  { bg: '#dbeafe', text: '#1e40af', bar: '#60a5fa' },
  { bg: '#dcfce7', text: '#166534', bar: '#4ade80' },
  { bg: '#fef9c3', text: '#854d0e', bar: '#facc15' },
  { bg: '#ffe4e6', text: '#9f1239', bar: '#fb7185' },
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
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) return 'list'
    return 'grid'
  })
  const [meta, setMeta] = useState({ group: '', lastName: '', semester: '', program: '' })

  useEffect(() => {
    const group    = sessionStorage.getItem('fon_group')
    const year     = sessionStorage.getItem('fon_year')
    const lastName = sessionStorage.getItem('fon_lastName') ?? ''
    const semester = sessionStorage.getItem('fon_semester') ?? ''
    const program  = sessionStorage.getItem('fon_program')  ?? ''

    if (!group || !year) {
      router.replace('/')
      return
    }

    setMeta({ group, lastName, semester, program })

fetch(`/data/${year}god.json`)
  .then(r => r.json())
  .then((data: SemesterData) => {
    const all = getScheduleForGroup(data, group)
    const saved = localStorage.getItem(`fon_subjects_${group}`)
    if (saved) {
      const checked: Record<string, boolean> = JSON.parse(saved)
      setEntries(all.filter(e => checked[e.subject] !== false))
    } else {
      setEntries(all)
    }
  })
  .finally(() => setLoading(false))
  }, [router])

  const colorMap = useSubjectColors(entries)
function downloadPNG() {
  const canvas = document.createElement('canvas')
  const dpr = 2
  const colW = 160
  const rowH = 80
  const headerH = 32
  const timeW = 56
  const padding = 16

  canvas.width  = (timeW + colW * 5 + padding * 2) * dpr
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
}

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{meta.lastName}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {meta.program && `${meta.program} · `}
              Grupa {meta.group} · {meta.semester}
            </p>
          </div>

          {/* Dugmad gore desno */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* View toggle */}
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setView('grid')}
                className={`hidden sm:block px-3 py-1.5 text-xs font-medium transition-colors
                  ${view === 'grid'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Sedmica
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors
                  ${view === 'list'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Lista
              </button>
            </div>

            {/* Download */}
            <button
              onClick={downloadPNG}
              className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200
                         rounded-lg bg-white hover:bg-gray-50 transition-colors"
            >
              ↓ Preuzmi
            </button>

            {/* Nazad */}
            <button
              onClick={() => router.push('/')}
              className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200
                         rounded-lg bg-white hover:bg-gray-50 transition-colors"
            >
              ← Nazad
            </button>

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
                    <div key={d} className="text-center text-xs font-medium text-gray-500 py-1">
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
                    <div className="text-right pr-2 pt-1.5 text-xs text-gray-400 leading-tight">
                      {slot}
                    </div>
                    {DAYS.map(day => {
                      const cell = entries.filter(e => e.day === day && e.start === slot)
                      if (!cell.length) {
                        return <div key={day} className="min-h-[64px] rounded-lg bg-gray-100/60 border-0 outline-none" />
                      }
                      return (
                        <div key={day} className="flex flex-col gap-1">
                          {cell.map((e, i) => {
                            const c = COLORS[colorMap[e.subject]]
                            return (
                             <div key={i} style={{ background: c.bg }} className="flex-1 rounded-lg p-2 min-h-[64px]">
  <p style={{ color: c.text }} className="text-xs font-medium leading-snug line-clamp-2">
    {e.subject}
  </p>
  <p style={{ color: c.text }} className="text-xs mt-1 opacity-70">
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
                  <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider
                                 mb-2 pb-2 border-b border-gray-200">
                    {day}
                  </h2>
                  <div className="space-y-1">
                    {dayEntries.map((e, i) => {
                      const c = COLORS[colorMap[e.subject]]
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 py-2.5 border-b border-gray-100"
                        >
                          <span className="text-xs text-gray-400 w-24 flex-shrink-0">
                            {SLOT_LABEL[e.start]}
                          </span>
                          <div style={{ background: c.bar }} className="w-1 self-stretch rounded-full" />
<span style={{ background: c.bg, color: c.text }} className="text-xs font-medium px-2 py-0.5 rounded-md flex-shrink-0">
                            {e.subject}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-md flex-shrink-0 ${c.bg} ${c.text}`}>
                            {e.type_short}
                          </span>
                          <span className="text-xs text-gray-400 w-20 text-right flex-shrink-0">
                            Sala {e.room}
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
    </main>
  )
}