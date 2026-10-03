// src/lib/schedule.ts

import type { SemesterData, ScheduleEntry, DayOfWeek } from './types'

export const DAYS: DayOfWeek[] = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak']
export const DAY_SHORT: Record<DayOfWeek, string> = {
  Ponedeljak: 'Pon', Utorak: 'Uto', Sreda: 'Sre', Četvrtak: 'Čet', Petak: 'Pet'
}
// Oblik posle "u" ("u sredu 12:15").
export const DAY_U: Record<DayOfWeek, string> = {
  Ponedeljak: 'ponedeljak', Utorak: 'utorak', Sreda: 'sredu', Četvrtak: 'četvrtak', Petak: 'petak'
}
// Početci termina na FON-u (blokovi od 2 sata).
export const SLOTS = ['08:15', '10:15', '12:15', '14:15', '16:15', '18:15']

// Logički termin: isti predmet, dan, vreme i tip (sala ne ulazi - ista vežba u
// više sala je jedan termin). Po ovom ključu se termini i skrivaju.
export function entryKey(e: ScheduleEntry): string {
  return `${e.day}|${e.start}|${e.subject}|${e.type_short}`
}

// Inicijali predmeta: "Upravljanje projektima" -> "UP", "Matematika 2" -> "M2".
// Preskače vezničke reči (za, na, i…).
const INITIALS_STOP = new Set(['i', 'za', 'na', 'u', 'o', 'sa', 'od', 'do', 'iz'])
export function subjectInitials(subject: string): string {
  const words = subject.split(/\s+/).filter(Boolean)
  const meaningful = words.filter(w => !INITIALS_STOP.has(w.toLowerCase()))
  const src = meaningful.length ? meaningful : words
  return src.map(w => w[0]).join('').toUpperCase().slice(0, 3)
}

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
  // "Do" sa crtom na kraju ("I-", "Lj-", "Š-") znači sva prezimena koja počinju
  // time, pa se poredi samo početak prezimena iste dužine.
  const beforeTo = to.endsWith('-')
    ? normalizeName(lastName).slice(0, normalizeName(to.slice(0, -1)).length) <= normalizeName(to.slice(0, -1))
    : compareNames(lastName, to) <= 0

  return afterFrom && beforeTo
}


// ISiT moduli. Student ga bira pri upisu 2. godine, ali FON u zimskim
// semestrima 2. i 3. godine ima grupe samo za "ISiT", bez modula, jer tada svi
// moduli slušaju iste predmete. U letnjem su grupe po modulima.
export const ISIT_MODULES = [
  'Informacione tehnologije',
  'Informacioni sistemi',
  'Informaciono inženjerstvo',
  'Poslovna analitika',
  'Softversko inženjerstvo',
  'Tehnologije elektronskog poslovanja',
]

// Program kako ga piše grupa u ovom semestru: sam modul, ili "ISiT" kad
// semestar nema grupe po modulima.
export function groupProgramFor(data: SemesterData, program: string): string {
  const hasModuleGroups = Object.values(data.groups).some(g => g.program === program)
  return !hasModuleGroups && ISIT_MODULES.includes(program) ? 'ISiT' : program
}

// Sve grupe čiji opseg obuhvata tačno ovo pisanje prezimena. Više od jedne
// ima kad se FON-ovi opsezi preklapaju (npr. D2 "A- - N-" i D3 "M- - Š-").
function groupsContaining(data: SemesterData, lastName: string, program: string | null): string[] {
  const groupProgram = program === null ? null : groupProgramFor(data, program)
  return Object.entries(data.groups)
    .filter(([, g]) => (groupProgram === null || g.program === groupProgram) && nameInRange(lastName, g.range))
    .map(([id]) => id)
}

export function findGroup(
  data: SemesterData,
  lastName: string,
  program: string | null
): string | null {
  const groupProgram = program === null ? null : groupProgramFor(data, program)
  const candidates = Object.entries(data.groups).filter(([, g]) => {
    return groupProgram === null || g.program === groupProgram
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

// Ćirilica -> latinica, da prezime otkucano ćirilicom ("Петровић") nađe grupu.
const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'đ', е: 'e', ж: 'ž', з: 'z', и: 'i',
  ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', ћ: 'ć', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'č', џ: 'dž', ш: 'š',
}

export function toLatin(name: string): string {
  return [...name]
    .map(ch => {
      const lat = CYR[ch.toLowerCase()]
      if (lat === undefined) return ch
      return ch === ch.toLowerCase() ? lat : lat[0].toUpperCase() + lat.slice(1)
    })
    .join('')
}

// Sva moguća pisanja prezimena sa kvačicama: c -> č/ć, s -> š, z -> ž. Ko
// kuca bez kvačica ("Sasic") ne sme tiho da dobije grupu nekog drugog, jer je Š
// u azbuci na kraju, a S u sredini (npr. C6 "R- - Stević" i C7 "Stefanović - Š-").
const DIACRITIC_OPTIONS: Record<string, string[]> = {
  c: ['c', 'č', 'ć'], C: ['C', 'Č', 'Ć'],
  s: ['s', 'š'], S: ['S', 'Š'],
  z: ['z', 'ž'], Z: ['Z', 'Ž'],
}
const MAX_VARIANTS = 256

function diacriticVariants(name: string): string[] {
  let out = ['']
  for (const ch of name) {
    const opts = DIACRITIC_OPTIONS[ch] ?? [ch]
    out = out.flatMap(prefix => opts.map(o => prefix + o))
    if (out.length > MAX_VARIANTS) return [name] // predugo, ostaje samo kako je otkucano
  }
  return out
}

export type GroupMatch =
  | { status: 'ok'; group: string; lastName: string }
  // Grupa zavisi od kvačica: `options` su grupe i pisanje prezimena koje ih daje.
  | { status: 'ambiguous'; options: { group: string; lastName: string }[] }
  | { status: 'none' }

// Grupa po prezimenu, bez pogađanja. Prezime otkucano bez kvačica proba se u
// svim pisanjima sa kvačicama: ako sva daju istu grupu, to je ta grupa; ako
// daju različite, vraća izbor. Ko kuca kvačice ("Stošić") piše ih, pa se
// uzima tačno otkucano. Izbor se vraća i kad se FON-ovi opsezi preklapaju.
export function resolveGroup(data: SemesterData, lastName: string, program: string | null): GroupMatch {
  const typed = toLatin(lastName.trim())
  if (!typed) return { status: 'none' }
  // Za svaku grupu pamti se najprirodnije pisanje (najviše kvačica, "-ić" na
  // kraju), jer se ono prikazuje studentu pri izboru: "Šašić", a ne "Šasic".
  const natural = (n: string) => (n.match(/[čćšžđ]/gi)?.length ?? 0) + (/ić$/i.test(n) ? 2 : 0)
  const byGroup = new Map<string, string>()
  const add = (name: string) => {
    for (const g of groupsContaining(data, name, program)) {
      const cur = byGroup.get(g)
      if (cur === undefined || (cur !== typed && natural(name) > natural(cur))) byGroup.set(g, name)
    }
  }
  add(typed)
  const hasDiacritics = /[čćšžđ]/i.test(typed)
  for (const v of hasDiacritics ? [] : diacriticVariants(typed)) add(v)
  // Kao i ranije: "Markovic" -> "Marković", "Djordjevic" -> "Đorđevic".
  if (byGroup.size === 0) add(typed.replace(/c$/i, 'ć').replace(/dj/gi, 'đ'))
  if (byGroup.size === 0) return { status: 'none' }
  if (byGroup.size === 1) {
    const [[group, name]] = [...byGroup]
    return { status: 'ok', group, lastName: name }
  }
  const options = [...byGroup].map(([group, name]) => ({ group, lastName: name }))
  options.sort((a, b) => a.group.localeCompare(b.group, 'sr', { numeric: true }))
  return { status: 'ambiguous', options }
}

// Opseg za prikaz: "Mihajlica - P-" -> "Mihajlica - P", "A- - Vukas" -> "A - Vukas".
// Crta posle slova u FON tabelama znači "sva prezimena na to slovo".
export function formatRange(range: string): string {
  if (range === 'Svi') return 'svi'
  return range.split(' - ').map(p => p.replace(/-$/, '')).join(' - ')
}

// Učitava termine za godinu iz OBA arhiviranih semestra (zimski + letnji), ne
// samo iz trenutno "živog" ${g}god.json - inače predmeti iz semestra koji
// trenutno nije aktivan (npr. zimski dok traje letnji) ne mogu da se nađu ni
// u "Predmeti iz prethodnih godina" ni u "Izmena termina" ručnom pretragom.
export async function fetchYearBothSemesters(g: number): Promise<ScheduleEntry[]> {
  const load = (sem: 'zimski' | 'letnji') =>
    fetch(`/data/${g}god-${sem}.json`)
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null) as Promise<SemesterData | null>

  const [zimski, letnji] = await Promise.all([load('zimski'), load('letnji')])
  return [...(zimski?.entries ?? []), ...(letnji?.entries ?? [])]
}

// Vraća raspored filtriran po grupi
export function getScheduleForGroup(
  data: SemesterData,
  groupId: string
): ScheduleEntry[] {
  return data.entries.filter(e => e.groups.includes(groupId))
}

// Sortirana lista jedinstvenih predmeta grupe. Kanonski poredak koji koriste
// izbor predmeta (/izborni) i deljenje putem linka (lib/share) - obe strane
// moraju da mapiraju iste indekse na iste predmete.
export function uniqueSubjectsForGroup(
  data: SemesterData,
  groupId: string
): string[] {
  return [...new Set(getScheduleForGroup(data, groupId).map(e => e.subject))].sort()
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
  // Od 2. godine ISiT student zna svoj modul, pa bira njega i kad semestar
  // ima grupe samo za "ISiT" (v. ISIT_MODULES). Tako se pri prelasku na
  // letnji, gde su grupe po modulima, grupa nađe sama.
  if (data.year >= 2 && programs.delete('ISiT')) ISIT_MODULES.forEach(m => programs.add(m))
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
