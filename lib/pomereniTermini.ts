// lib/pomereniTermini.ts
//
// Termini koje je student sam pomerio, npr. kad profesor na Teams-u javi da
// su vežbe od sada u drugom terminu ili sali. Pamti se FON-ov termin (`od`) i
// novi dan, vreme i sala. Kad FON pomeri taj termin, ručno pomeranje se briše:
// FON-ovi podaci su tada noviji, a baner o izmeni kaže šta se promenilo.

import type { DayOfWeek, ScheduleEntry } from './types'
import { entryKey } from './schedule'

export interface PomerenTermin {
  od: ScheduleEntry
  day: DayOfWeek
  start: string
  end: string
  room: string
}

// Termin kakav se prikazuje posle pomeranja.
export const novTermin = (p: PomerenTermin): ScheduleEntry =>
  ({ ...p.od, day: p.day, start: p.start, end: p.end, room: p.room })

// Važe samo pomeranja čiji FON-ov termin još postoji. `fon` su svi termini
// grupe i dodati termini, bez filtera po izabranim predmetima, da odčekiran
// predmet ne obriše pomeranje.
export function vazeciPomereni(pomereni: PomerenTermin[], fon: ScheduleEntry[]): PomerenTermin[] {
  const kljucevi = new Set(fon.map(entryKey))
  return pomereni.filter(p => kljucevi.has(entryKey(p.od)))
}

export function primeniPomerene(entries: ScheduleEntry[], pomereni: PomerenTermin[]): ScheduleEntry[] {
  if (pomereni.length === 0) return entries
  const po = new Map(pomereni.map(p => [entryKey(p.od), p]))
  return entries.map(e => {
    const p = po.get(entryKey(e))
    return p ? novTermin(p) : e
  })
}

// Dodati termini koji su ostali na svom bloku. Samo oni gaze FON-ov termin po
// vremenu: pomeren je otišao sa tog bloka, a na novom stoji pored postojećih.
export function nepomereni<T extends ScheduleEntry>(dodati: T[], pomereni: PomerenTermin[]): T[] {
  const kljucevi = new Set(pomereni.map(p => entryKey(p.od)))
  return dodati.filter(t => !kljucevi.has(entryKey(t)))
}

// Upisuje pomeranje termina `e` (FON-ovog ili već pomerenog). Vraćanje na
// FON-ov dan, vreme i salu briše pomeranje.
export function pomeri(
  pomereni: PomerenTermin[],
  e: ScheduleEntry,
  novo: Pick<PomerenTermin, 'day' | 'start' | 'end' | 'room'>,
): PomerenTermin[] {
  const kljuc = entryKey(e)
  const postojeci = pomereni.find(p => entryKey(novTermin(p)) === kljuc)
  const od = postojeci?.od ?? e
  const ostali = pomereni.filter(p => p !== postojeci)
  const isto = od.day === novo.day && od.start === novo.start && od.room === novo.room
  return isto ? ostali : [...ostali, { od, ...novo }]
}
