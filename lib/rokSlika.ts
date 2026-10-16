// lib/rokSlika.ts
//
// Rokovi kao PNG slika (dugme "Slika" na Rokovima). Jedan mesec: veliki
// kalendar levo + agenda desno; ceo rok: svi meseci kao kolone.

import type { RokEntry } from './types'
import { COLORS, eventTypeLabel, poDatumu } from './rokovi'
import { subjectInitials } from './schedule'
import { SR_MONTHS, SR_DAYS_SHORT, cap } from './date'

export type IzborSlike = 'all' | { year: number; month: number }

type Mesec = { year: number; month: number; exams: RokEntry[] }

const DPR = 2
const DAY_NAMES = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned']

// Meseci u kojima ima termina, hronološki (za izbor meseca pre preuzimanja).
export function meseciSaTerminima(termini: RokEntry[]): { year: number; month: number }[] {
  const m = new Map<string, { year: number; month: number }>()
  for (const e of termini) {
    const d = new Date(e.date + 'T00:00:00')
    m.set(`${d.getFullYear()}-${d.getMonth()}`, { year: d.getFullYear(), month: d.getMonth() })
  }
  return [...m.values()].sort((a, b) => a.year - b.year || a.month - b.month)
}

const monthWeeks = (mo: { year: number; month: number }) => {
  const firstOffset = (new Date(mo.year, mo.month, 1).getDay() + 6) % 7
  return Math.ceil((firstOffset + new Date(mo.year, mo.month + 1, 0).getDate()) / 7)
}

// Visina agende: red po ispitu + 6px razmak/crta između različitih dana.
const listHeight = (exams: RokEntry[], rowH: number) =>
  exams.length * rowH + (new Set(exams.map(e => e.date)).size - 1) * 6

function setup(w: number, h: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w * DPR
  canvas.height = h * DPR
  const ctx = canvas.getContext('2d')!
  ctx.scale(DPR, DPR)
  ctx.fillStyle = '#f9fafb'
  ctx.fillRect(0, 0, w, h)
  return { canvas, ctx }
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

// Crtanje deli mapu boja sa prikazom na strani, pa predmet ima istu boju.
function crtac(ctx: CanvasRenderingContext2D, colorMap: Record<string, number>) {
  // Kalendar jednog meseca na (ox, oy). Vraća visinu (header + mreža).
  const drawGrid = (
    ox: number, oy: number, mo: Mesec,
    cw: number, ch: number, numSize: number, daySize: number, initialsSize: number
  ) => {
    const firstOffset = (new Date(mo.year, mo.month, 1).getDay() + 6) % 7
    const daysInMonth = new Date(mo.year, mo.month + 1, 0).getDate()
    ctx.textAlign = 'center'
    ctx.font = `500 ${daySize}px system-ui, sans-serif`
    ctx.fillStyle = '#9ca3af'
    DAY_NAMES.forEach((d, i) => ctx.fillText(d, ox + cw * i + cw / 2, oy + daySize))
    const top = oy + daySize + 10
    const cornerSize = Math.max(8, daySize - 2)
    for (let day = 1; day <= daysInMonth; day++) {
      const idx = firstOffset + (day - 1)
      const cx = ox + (idx % 7) * cw
      const cy = top + Math.floor(idx / 7) * ch
      const dayExams = mo.exams.filter(e => new Date(e.date + 'T00:00:00').getDate() === day)
      if (dayExams.length) {
        const c = COLORS[colorMap[dayExams[0].subject] ?? 0]
        ctx.fillStyle = c.bg
        ctx.beginPath(); ctx.roundRect(cx + 2, cy + 2, cw - 4, ch - 4, 8); ctx.fill()
        // broj dana u gornjem levom ćošku
        ctx.fillStyle = c.text
        ctx.globalAlpha = 0.7
        ctx.font = `600 ${cornerSize}px system-ui, sans-serif`
        ctx.textAlign = 'left'
        ctx.fillText(String(day), cx + 6, cy + cornerSize + 5)
        ctx.globalAlpha = 1
        // inicijali svih predmeta tog dana (zarezom), uz auto-smanjenje da stanu
        const label = [...new Set(dayExams.map(e => subjectInitials(e.subject)))].join(', ')
        const maxW = cw - 10
        let size = initialsSize
        ctx.font = `700 ${size}px system-ui, sans-serif`
        while (size > 7 && ctx.measureText(label).width > maxW) {
          size -= 1
          ctx.font = `700 ${size}px system-ui, sans-serif`
        }
        ctx.fillStyle = c.text
        ctx.textAlign = 'center'
        ctx.fillText(truncate(ctx, label, maxW), cx + cw / 2, cy + ch / 2 + size / 2 + 3)
      } else {
        ctx.fillStyle = '#9ca3af'
        ctx.font = `${numSize}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(String(day), cx + cw / 2, cy + ch / 2 + numSize / 3)
      }
    }
    return daySize + 10 + monthWeeks(mo) * ch
  }

  // Agenda, grupisana po danu: datum levo (jednom), ispiti desno, crta
  // razdvaja različite dane (isti dan → bez crte, vizuelno zajedno).
  const drawList = (
    ox: number, oy: number, width: number, exams: RokEntry[],
    rowH: number, dateSize: number, subjSize: number, detailSize: number, dateColW: number
  ) => {
    const groups: RokEntry[][] = []
    for (const e of exams) {
      const last = groups[groups.length - 1]
      if (last && last[0].date === e.date) last.push(e)
      else groups.push([e])
    }
    const textW = width - dateColW - 14
    let ly = oy
    groups.forEach((grp, gi) => {
      if (gi > 0) {
        ly += 6
        ctx.strokeStyle = '#e5e7eb'
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(ox, ly - 3); ctx.lineTo(ox + width, ly - 3); ctx.stroke()
      }
      const d = new Date(grp[0].date + 'T00:00:00')
      ctx.textAlign = 'left'
      ctx.fillStyle = '#111827'
      ctx.font = `600 ${dateSize}px system-ui, sans-serif`
      ctx.fillText(`${SR_DAYS_SHORT[(d.getDay() + 6) % 7]} ${d.getDate()}.`, ox, ly + 10)
      grp.forEach(e => {
        const c = COLORS[colorMap[e.subject] ?? 0]
        const rx = ox + dateColW
        ctx.fillStyle = c.bar
        ctx.beginPath(); ctx.arc(rx + 4, ly + 6, 3.5, 0, Math.PI * 2); ctx.fill()
        ctx.textAlign = 'left'
        ctx.fillStyle = '#1f2937'
        ctx.font = `600 ${subjSize}px system-ui, sans-serif`
        ctx.fillText(truncate(ctx, e.subject, textW), rx + 14, ly + 10)
        const typeLabel = e.type ? eventTypeLabel(e.type).toLowerCase() : ''
        const details = [e.start, e.rooms.join(', '), typeLabel].filter(Boolean).join(' · ')
        ctx.fillStyle = '#6b7280'
        ctx.font = `${detailSize}px system-ui, sans-serif`
        ctx.fillText(truncate(ctx, details, textW), rx + 14, ly + 10 + detailSize + 5)
        ly += rowH
      })
    })
  }

  return { drawGrid, drawList }
}

// Crta sliku; null ako u izboru nema termina. `ime` je deo imena fajla
// ("ceo-rok" ili "novembar-2026").
export function slikaRokova(
  termini: RokEntry[],
  izbor: IzborSlike,
  { naslov, ident, colorMap }: { naslov: string; ident: string; colorMap: Record<string, number> }
): { canvas: HTMLCanvasElement; ime: string } | null {
  const monthsMap = new Map<string, Mesec>()
  for (const e of [...termini].sort(poDatumu)) {
    const d = new Date(e.date + 'T00:00:00')
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (!monthsMap.has(key)) monthsMap.set(key, { year: d.getFullYear(), month: d.getMonth(), exams: [] })
    monthsMap.get(key)!.exams.push(e)
  }
  const allMonths = [...monthsMap.values()]
  const selected = izbor === 'all' ? allMonths : allMonths.filter(m => m.year === izbor.year && m.month === izbor.month)
  if (!selected.length) return null

  let canvas: HTMLCanvasElement

  if (izbor === 'all' && selected.length > 1) {
    // Svi meseci kao kolone jedan pored drugog.
    const pad = 24
    const cw = 40, ch = 40, gridW = cw * 7
    const daySize = 11, numSize = 13, initialsSize = 10
    const rowH = 32, dateSize = 11, subjSize = 12, detailSize = 11, dateColW = 44
    const gap = 30
    const colTop = pad + 34

    const measure = selected.map(mo => {
      const calH = daySize + 10 + monthWeeks(mo) * ch
      return { mo, calH, colH: 24 + calH + 12 + listHeight(mo.exams, rowH) }
    })
    const bodyH = Math.max(...measure.map(m => m.colH))
    const W = pad + selected.length * gridW + (selected.length - 1) * gap + pad
    const H = colTop + bodyH + pad

    const s = setup(W, H)
    canvas = s.canvas
    const ctx = s.ctx
    const { drawGrid, drawList } = crtac(ctx, colorMap)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#111827'
    ctx.font = '600 16px system-ui, sans-serif'
    ctx.fillText(naslov, pad, pad + 16)
    ctx.fillStyle = '#6b7280'
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillText(ident, pad + ctx.measureText(naslov).width + 10, pad + 16)

    measure.forEach(({ mo, calH }, i) => {
      const ox = pad + i * (gridW + gap)
      ctx.fillStyle = '#111827'
      ctx.font = '600 14px system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`${cap(SR_MONTHS[mo.month])} ${mo.year}`, ox, colTop + 12)
      const gy = colTop + 24
      drawGrid(ox, gy, mo, cw, ch, numSize, daySize, initialsSize)
      drawList(ox, gy + calH + 12, gridW, mo.exams, rowH, dateSize, subjSize, detailSize, dateColW)
    })
  } else {
    // Jedan mesec: veliki kalendar levo + agenda desno.
    const mo = selected[0]
    const pad = 26
    const cw = 54, ch = 48, gridW = cw * 7
    const daySize = 12, numSize = 15, initialsSize = 13
    const agendaW = 320, gap = 32
    const rowH = 40, dateSize = 13, subjSize = 13, detailSize = 12, dateColW = 58
    const titleH = 50

    const calH = daySize + 10 + monthWeeks(mo) * ch
    const bodyH = Math.max(calH, listHeight(mo.exams, rowH))
    const W = pad + gridW + gap + agendaW + pad
    const H = pad + titleH + bodyH + pad

    const s = setup(W, H)
    canvas = s.canvas
    const ctx = s.ctx
    const { drawGrid, drawList } = crtac(ctx, colorMap)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#111827'
    ctx.font = '600 20px system-ui, sans-serif'
    ctx.fillText(`${cap(SR_MONTHS[mo.month])} ${mo.year}`, pad, pad + 18)
    ctx.fillStyle = '#6b7280'
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillText(`${naslov} · ${ident}`, pad, pad + 40)

    const bodyY = pad + titleH
    drawGrid(pad, bodyY, mo, cw, ch, numSize, daySize, initialsSize)
    drawList(pad + gridW + gap, bodyY, agendaW, mo.exams, rowH, dateSize, subjSize, detailSize, dateColW)
  }

  const ime = izbor === 'all' ? 'ceo-rok' : `${SR_MONTHS[selected[0].month]}-${selected[0].year}`
  return { canvas, ime }
}
