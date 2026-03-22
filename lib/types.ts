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