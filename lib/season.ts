// lib/season.ts
//
// "Čekamo raspored": period kad je po kalendaru već novi semestar (npr. kraj
// septembra), a FON još nije objavio raspored — pa je u god.json i dalje stari
// (letnji). Tada ne želimo da korisniku prikažemo stari raspored kao da je
// aktuelan, nego jasno kažemo da novi stiže.
//
// Sve se izvodi iz `semester` stringa u god.json i današnjeg datuma, bez ručnog
// prekidača: čim se merge-uje novi god.json, poruka sama nestaje.

type Kind = 'Zimski' | 'Letnji'

interface Sem {
  kind: Kind
  startYear: number // "Letnji 2025/26" -> 2025 (školska godina 2025/26)
}

// Od kog datuma (mesec, dan) očekujemo raspored za naredni semestar. Zimski
// počinje oko 1. oktobra, letnji krajem februara — granice su namerno malo
// ranije, jer baš tada ljudi počinju da traže raspored.
const ZIMSKI_OD = { month: 9, day: 1 }
const LETNJI_OD = { month: 2, day: 15 }

export function parseSemester(s: string): Sem | null {
  const m = s.trim().match(/^(Zimski|Letnji)\s+(\d{4})\/\d{2}$/i)
  if (!m) return null
  const kind = (m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()) as Kind
  return { kind, startYear: Number(m[2]) }
}

export function formatSemester({ kind, startYear }: Sem): string {
  return `${kind} ${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`
}

// Redni broj semestra, da bi se dva semestra mogla porediti (zimski pa letnji
// iste školske godine).
function order({ kind, startYear }: Sem): number {
  return startYear * 2 + (kind === 'Letnji' ? 1 : 0)
}

// Koji semestar bi po kalendaru trebalo da je aktuelan na dati dan (YYYY-MM-DD).
export function expectedSemester(todayIso: string): Sem {
  const [y, mo, d] = todayIso.split('-').map(Number)
  const onOrAfter = (b: { month: number; day: number }) => mo > b.month || (mo === b.month && d >= b.day)
  if (onOrAfter(ZIMSKI_OD)) return { kind: 'Zimski', startYear: y }
  if (onOrAfter(LETNJI_OD)) return { kind: 'Letnji', startYear: y - 1 }
  return { kind: 'Zimski', startYear: y - 1 }
}

export interface PendingSemester {
  label: string            // "Zimski 2026/27" — semestar koji čekamo
  newAcademicYear: boolean // zimski = nova školska godina (prelazak u višu godinu, nove grupe)
}

// Vraća semestar koji čekamo, ili null ako je objavljeni raspored aktuelan.
// Nepoznat format stringa -> null (radije ne prikaži ništa nego pogrešnu poruku).
export function pendingSemester(currentSemester: string, todayIso: string): PendingSemester | null {
  const current = parseSemester(currentSemester)
  if (!current) return null
  const expected = expectedSemester(todayIso)
  if (order(expected) <= order(current)) return null
  return { label: formatSemester(expected), newAcademicYear: expected.kind === 'Zimski' }
}

// Današnji datum (YYYY-MM-DD) po lokalnom vremenu uređaja — toISOString bi dao
// UTC, pa bi posle ponoći po našem vremenu još bio "juče".
export function todayLocalIso(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}
