// src/lib/types.ts

export type DayOfWeek = 
  'Ponedeljak' | 'Utorak' | 'Sreda' | 'Četvrtak' | 'Petak'

export type EntryType = 'Predavanje' | 'Vežbe'

export interface ScheduleEntry {
  day: DayOfWeek
  subject: string
  type: EntryType
  type_short: 'P' | 'V'
  groups: string[]
  start: string   // "08:15"
  end: string     // "10:00"
  room: string
}

export interface GroupInfo {
  program: string
  range: string   // "Svi" | "A- - Lekić" | ...
}

export interface SemesterData {
  semester: string   // "Letnji 2025/26"
  year: number       // 1 | 2 | 3 | 4
  groups: Record<string, GroupInfo>
  entries: ScheduleEntry[]
}

export interface RokEntry {
  subject: string
  type?: string    // "P" (pismeni) | "U" (usmeni) — samo kod ispita
  date: string     // ISO: "2026-03-03"
  start: string    // "15:00"
  end: string      // "16:40"
  rooms: string[]
  note: string
}

export interface RokData {
  rok: string                    // "Februarski 2025/26"
  tip: 'ispit' | 'kolokvijum'
  entries: RokEntry[]
  prijava_datumi?: string[]      // ["05.04.2026.", "06.04.2026."]
  reklamacija_datum?: string     // "07.04.2026."
}

// Korisnikov sopstveni unos u rokovi kalendar (nije sa FON sajta) — npr.
// dogovoreni usmeni sa profesorom koji nije na zvaničnom rasporedu.
// type: 'P' | 'U' (isto kao RokEntry) ili slobodni label 'Kolokvijum' / 'Ostalo' —
// postojeći render kod već ispisuje e.type sirovo kad nije 'P'/'U', pa nema
// potrebe da se dira nijedno mesto koje prikazuje RokEntry.
// tab: fiksira se pri dodavanju na tab u kom si tad bio (Ispiti/Kolokvijumi) —
// NE izvodi se iz `type`, jer bi promena tipa (npr. u "Kolokvijum") inače
// tiho preselila event u drugi tab.
export interface CustomRokEntry extends RokEntry {
  id: string
  custom: true
  tab: 'ispiti' | 'kolokvijumi'
}