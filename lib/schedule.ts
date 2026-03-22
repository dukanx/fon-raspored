// src/lib/schedule.ts

import type { SemesterData, ScheduleEntry } from './types'

// Normalizuje prezime za poređenje: "Šarić" → "saric"
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/š/g, 'sh').replace(/č/g, 'ch').replace(/ć/g, 'cy')
    .replace(/ž/g, 'zh').replace(/đ/g, 'dj').replace(/dž/g, 'dz')
    .replace(/lj/g, 'ly').replace(/nj/g, 'ny')
}

// Poredi dva prezimena po srpskoj latinici
// Vraća negativan broj ako je a < b, pozitivan ako je a > b
function compareNames(a: string, b: string): number {
  return normalizeName(a).localeCompare(normalizeName(b), 'sr-Latn')
}

// Proverava da li prezime pada u opseg "od - do"
// range primeri: "Svi", "A- - Lekić", "Lojković - Š-"
function nameInRange(lastName: string, range: string): boolean {
  if (range === 'Svi') return true

  const parts = range.split(' - ')
  if (parts.length !== 2) return false

  const [from, to] = parts

  // "A-" znači od početka azbuke, "Š-" znači do kraja
  const afterFrom = from === 'A-' ? true : compareNames(lastName, from) >= 0
  const beforeTo = to === 'Š-' ? true : compareNames(lastName, to) <= 0

  return afterFrom && beforeTo
}


export function findGroup(
  data: SemesterData,
  lastName: string,
  program: string | null
): string | null {
  for (const [groupId, groupInfo] of Object.entries(data.groups)) {
    const programMatches =
      program === null || groupInfo.program === program

    if (programMatches && nameInRange(lastName, groupInfo.range)) {
      return groupId
    }
  }
  return null
}

// Vraća raspored filtriran po grupi
export function getScheduleForGroup(
  data: SemesterData,
  groupId: string
): ScheduleEntry[] {
  return data.entries.filter(e => e.groups.includes(groupId))
}

// Vraća listu jedinstvenih programa za datu godinu
// (za dropdown u onboardingu)
export function getProgramsForYear(data: SemesterData): string[] {
  const programs = new Set<string>()
  for (const group of Object.values(data.groups)) {
    if (group.program) {
      // Za prvu godinu program može biti višerečan ali je zapravo jedna reč (ISiT/MiO)
      // Za ostale godine program je pun naziv
      // Razlikujemo po tome da li range sadrži " - " (normalan format)
      const isFirstYear = !group.range.includes(' - ') && group.range !== 'Svi'
      const base = isFirstYear ? group.program.split(' ')[0] : group.program
      programs.add(base)
    }
  }
  return Array.from(programs).sort()
}

// Vraća listu izbornih predmeta za datu grupu
// (predmeti koji nisu zajednički za sve grupe u istom programu)
export function getElectivesForGroup(
  data: SemesterData,
  groupId: string
): string[] {
  const groupProgram = data.groups[groupId]?.program
  if (!groupProgram) return []

  // Nađi sve grupe istog programa
  const sameProgram = Object.entries(data.groups)
    .filter(([, g]) => g.program === groupProgram)
    .map(([id]) => id)

  // Predmeti koji se pojavljuju samo u nekim grupama = izborni
  const subjectGroups: Record<string, Set<string>> = {}
  for (const entry of data.entries) {
    if (!subjectGroups[entry.subject]) {
      subjectGroups[entry.subject] = new Set()
    }
    for (const g of entry.groups) {
      if (sameProgram.includes(g)) {
        subjectGroups[entry.subject].add(g)
      }
    }
  }

  return Object.entries(subjectGroups)
    .filter(([, groups]) =>
      // Nije u svim grupama istog programa = potencijalni izborni
      groups.size > 0 && groups.size < sameProgram.length
    )
    .map(([subject]) => subject)
    .sort()
}
