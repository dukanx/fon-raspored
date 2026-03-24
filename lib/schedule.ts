// src/lib/schedule.ts

import type { SemesterData, ScheduleEntry } from './types'

const SR_MAP: Record<string, string> = {
  'a':'01', 'b':'02', 'v':'03', 'g':'04', 'd':'05',
  'đ':'06', 'dj':'06',
  'e':'07', 'ž':'08', 'zh':'08', 'z':'09', 'i':'10',
  'j':'11', 'k':'12', 'l':'13', 'lj':'14', 'm':'15',
  'n':'16', 'nj':'17', 'o':'18', 'p':'19', 'r':'20',
  's':'21', 't':'22', 'ć':'23', 'cy':'23', 'cj':'23', 'u':'24', 'f':'25',
  'h':'26', 'c':'27', 'č':'28', 'ch':'28', 'dž':'29', 'dz':'29', 'š':'30', 'sh':'30',
}

function normalizeName(name: string): string {
  let result = ''
  let i = 0
  const s = name.toLowerCase()
  while (i < s.length) {
    // Provjeri dvoslovne kombinacije prvo
    const two = s.slice(i, i + 2)
    if (SR_MAP[two]) {
      result += SR_MAP[two]
      i += 2
    } else {
      const one = s[i]
      result += SR_MAP[one] ?? one
      i++
    }
  }
  return result
}
// Poredi dva prezimena po srpskoj latinici
// Vraća negativan broj ako je a < b, pozitivan ako je a > b

function compareNames(a: string, b: string): number {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (na < nb) return -1
  if (na > nb) return 1
  return 0
}



// Proverava da li prezime pada u opseg "od - do"
// range primeri: "Svi", "A- - Lekić", "Lojković - Š-"
function nameInRange(lastName: string, range: string): boolean {
  if (range === 'Svi') return true

  const parts = range.split(' - ')
  if (parts.length !== 2) return false

  const [from, to] = parts

  const afterFrom = from === 'A-' ? true : compareNames(lastName, from) >= 0
  const beforeTo  = to   === 'Š-' ? true : compareNames(lastName, to)   <= 0

  return afterFrom && beforeTo
}


export function findGroup(
  data: SemesterData,
  lastName: string,
  program: string | null
): string | null {
  const candidates = Object.entries(data.groups).filter(([, g]) => {
    return program === null || g.program === program
  })

  const sorted = candidates.sort(([, a], [, b]) => {
    const getFrom = (range: string) => {
      if (range === 'Svi') return ''
      const parts = range.split(' - ')
      return parts[0] === 'A-' ? '' : parts[0]
    }
    return compareNames(getFrom(b.range), getFrom(a.range))
  })

  const search = (name: string) => {
    for (const [groupId, groupInfo] of sorted) {
      if (nameInRange(name, groupInfo.range)) return groupId
    }
    return null
  }

  // Prvo pokušaj sa originalnim imenom
  const result = search(lastName)
  if (result) return result

  // Fallback: zameni c → ć na kraju (npr. Markovic → Marković)
  const withC = lastName.replace(/c$/i, 'ć').replace(/dj/gi, 'đ')
  if (withC !== lastName) return search(withC)

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
