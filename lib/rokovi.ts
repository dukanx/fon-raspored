// lib/rokovi.ts
//
// Logika strane Rokovi: ispiti i kolokvijumi u jednom prikazu, sa filterom po
// vrsti. Bez React-a, pa je i strana kraća i ovo se testira (rokovi.test.ts).

import type { RokData, RokEntry } from './types'
import { app, byGroup } from './storage'

export type Vrsta = RokData['tip']
export type Filter = 'sve' | 'ispiti' | 'kolokvijumi'

// Termin u prikazu nosi vrstu svog roka (za .ics i sliku); sopstveni događaj
// je nema.
export type Termin = RokEntry & { tip?: Vrsta }

export const FILTER_NAZIV: Record<Filter, string> = {
  sve: 'Ispiti i kolokvijumi',
  ispiti: 'Ispiti',
  kolokvijumi: 'Kolokvijumi',
}

// Boje po predmetu: podloga, tekst, traka, pa isto za tamnu temu.
export const COLORS = [
  { bg: '#d6f0ec', text: '#1a5e52', bar: '#60c3ad', darkBg: '#0f3530', darkText: '#8ed8ca' },
  { bg: '#cce0f0', text: '#012f4e', bar: '#024c7d', darkBg: '#051e30', darkText: '#7ab5d8' },
  { bg: '#fff4d6', text: '#7a5a00', bar: '#ffcd67', darkBg: '#3d3200', darkText: '#ffd97a' },
  { bg: '#e8e7f5', text: '#44408a', bar: '#9a95c9', darkBg: '#1e1b3d', darkText: '#b8b4e0' },
  { bg: '#fde6e5', text: '#892d2a', bar: '#f48580', darkBg: '#3d1512', darkText: '#f4a09c' },
  { bg: '#f0d9ec', text: '#7a2e5a', bar: '#d264a7', darkBg: '#3d1a30', darkText: '#e8a8d0' },
]

export function buildColorMap(entries: RokEntry[]): Record<string, number> {
  const map: Record<string, number> = {}
  let i = 0
  for (const e of entries) {
    if (!(e.subject in map)) { map[e.subject] = i % COLORS.length; i++ }
  }
  return map
}

export function rokEntryKey(e: RokEntry): string {
  return `${e.date}|${e.start}|${e.subject}|${e.type ?? ''}`
}

export const eventTypeLabel = (t: string) => (t === 'P' ? 'Pismeni' : t === 'U' ? 'Usmeni' : t)

// Šta je termin, za prikaz: "Kolokvijum", "Pismeni ispit"...; za sopstveni
// događaj njegov tip, a prazno kad se ne zna.
export function opisVrste(e: Termin): string {
  if (e.tip === 'kolokvijum') return 'Kolokvijum'
  if (e.tip === 'ispit') return e.type === 'P' ? 'Pismeni ispit' : e.type === 'U' ? 'Usmeni ispit' : 'Ispit'
  return e.type ? eventTypeLabel(e.type) : ''
}

export const poDatumu = (a: RokEntry, b: RokEntry) =>
  a.date.localeCompare(b.date) || a.start.localeCompare(b.start)

export const odgovaraFilteru = (tip: Vrsta, filter: Filter) =>
  filter === 'sve' || (filter === 'ispiti') === (tip === 'ispit')

// Rokovi sa bar jednim terminom od danas, po prvom sledećem terminu: u "Sve"
// se ispiti i kolokvijumi ređaju onako kako dolaze.
export function aktivniRokovi(svi: RokData[], filter: Filter, danas: string): RokData[] {
  const prvi = (r: RokData) => r.entries.map(e => e.date).filter(d => d >= danas).sort()[0]
  return svi
    .filter(r => odgovaraFilteru(r.tip, filter) && prvi(r))
    .sort((a, b) => prvi(a).localeCompare(prvi(b)))
}

// Predmeti koje student sluša: čekirani, dodati termini, preneseni, predmeti
// drugog semestra i istorija izbora (za septembarski i oktobarski rok, koji
// mešaju oba semestra). null = još nije birao predmete, pa se vidi sve.
export function predmetiStudenta(group: string): Set<string> | null {
  const checked = byGroup.subjects(group).get()
  if (Object.keys(checked).length === 0) return null
  const out = new Set(Object.entries(checked).filter(([, v]) => v !== false).map(([k]) => k))
  for (const e of byGroup.extra(group).get()) out.add(e.subject)
  for (const e of byGroup.prevSubjects(group).get()) out.add(e.subject)
  for (const s of byGroup.otherSem(group).get()) out.add(s)
  for (const arr of Object.values(app.subjectsHistory.get())) for (const s of arr) out.add(s)
  return out
}

// Skriveni termini grupe, bez prošlih (njih više nema šta da se krije, pa bi
// se inače gomilali). Stare liste po tabu se ovde jednom spoje u jednu.
export function skriveniTermini(group: string, danas: string): RokEntry[] {
  const sad = byGroup.rokHidden(group)
  const stari = byGroup.rokHiddenStaro(group)
  const pre = sad.get()
  const sve = [...pre, ...stari.flatMap(s => s.get())].filter(e => e.date >= danas)
  const posle = [...new Map(sve.map(e => [rokEntryKey(e), e])).values()]
  if (posle.length !== pre.length || stari.some(s => s.get().length > 0)) {
    sad.set(posle)
    stari.forEach(s => s.remove())
  }
  return posle
}

const escapeICS = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

const VRSTA_NAZIV: Record<Vrsta, string> = { ispit: 'Ispit', kolokvijum: 'Kolokvijum' }

// .ics za uvoz u kalendar telefona, sa podsetnikom dan ranije.
export function napraviICS(termini: Termin[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FON Raspored//SR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  for (const e of [...termini].sort(poDatumu)) {
    const dan = e.date.replace(/-/g, '')
    const [sh, sm] = e.start.split(':')
    const [eh, em] = e.end.split(':')
    const tip = e.type ? eventTypeLabel(e.type) : ''
    const opis = [e.tip ? VRSTA_NAZIV[e.tip] : '', e.note].filter(Boolean).join(' · ')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${dan}-${sh}${sm}-${e.subject.replace(/\s/g, '')}-${e.type ?? ''}@fonraspored`,
      `DTSTART;TZID=Europe/Belgrade:${dan}T${sh}${sm}00`,
      `DTEND;TZID=Europe/Belgrade:${dan}T${eh}${em}00`,
      `SUMMARY:${escapeICS(e.subject + (tip ? ` [${tip}]` : ''))}`,
    )
    if (e.rooms.length) lines.push(`LOCATION:${escapeICS(e.rooms.join(', '))}`)
    if (opis) lines.push(`DESCRIPTION:${escapeICS(opis)}`)
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Podsetnik', 'TRIGGER:-P1D', 'END:VALARM', 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
