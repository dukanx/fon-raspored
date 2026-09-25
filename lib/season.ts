// lib/season.ts
//
// "Čekamo raspored": period između kraja ispitnog roka i objave rasporeda za
// naredni semestar (oktobarski rok -> zimski, februarski rok -> letnji). Tada
// ne želimo da korisniku prikažemo stari raspored kao da je aktuelan, nego
// jasno kažemo da novi stiže.
//
// Izvor su stvarni datumi rokova iz rokovi.json i `semester` string iz
// god.json, bez ručnog prekidača: čim se merge-uje novi god.json, ekran
// čekanja sam nestaje.

import type { RokData } from './types'
import { ispitClusters } from './rokDefault'

type Kind = 'Zimski' | 'Letnji'

interface Sem {
  kind: Kind
  startYear: number // "Letnji 2025/26" -> 2025 (školska godina 2025/26)
}

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

// Semestar koji počinje posle roka koji se završio datog dana. Rok koji se
// završava u avgustu–decembru (septembarski, oktobarski) vodi u zimski nove
// školske godine, onaj u januaru–martu (januarski, februarski) u letnji. Posle
// junskog/julskog sledi leto, pa nema semestra koji se čeka.
function semesterAfterRok(lastIso: string): Sem | null {
  const [y, mo] = lastIso.split('-').map(Number)
  if (mo >= 8) return { kind: 'Zimski', startYear: y }
  if (mo <= 3) return { kind: 'Letnji', startYear: y - 1 }
  return null
}

export interface PendingSemester {
  label: string            // "Zimski 2026/27" — semestar koji čekamo
  newAcademicYear: boolean // zimski = nova školska godina (prelazak u višu godinu, nove grupe)
}

// Semestar koji počinje posle poslednjeg ispitnog perioda koji je već počeo i
// završio se (rok objavljen unapred ne računa se), ili null ako rok još traje
// ili je posle njega leto. Zavisi samo od datuma i rokovi.json-a, pa se može
// zapamtiti za ceo dan (v. app/page.tsx).
export function awaitedSemester(rokovi: RokData[], todayIso: string): string | null {
  const started = ispitClusters(rokovi).filter(c => c.first <= todayIso)
  const last = started[started.length - 1]
  if (!last || todayIso <= last.last) return null
  const next = semesterAfterRok(last.last)
  return next ? formatSemester(next) : null
}

// Da li se čeka `awaited`, s obzirom na to koji je semestar objavljen u god.json.
// Nepoznat format stringa -> null (radije ne prikaži ništa nego pogrešnu poruku).
export function pendingFor(publishedSemester: string, awaited: string | null): PendingSemester | null {
  const published = parseSemester(publishedSemester)
  const next = awaited ? parseSemester(awaited) : null
  if (!published || !next || order(next) <= order(published)) return null
  return { label: formatSemester(next), newAcademicYear: next.kind === 'Zimski' }
}

// Vraća semestar koji čekamo, ili null ako je objavljeni raspored aktuelan.
export function waitingForSchedule(
  publishedSemester: string,
  rokovi: RokData[],
  todayIso: string
): PendingSemester | null {
  return pendingFor(publishedSemester, awaitedSemester(rokovi, todayIso))
}

// Današnji datum (YYYY-MM-DD) po lokalnom vremenu uređaja — toISOString bi dao
// UTC, pa bi posle ponoći po našem vremenu još bio "juče".
export function todayLocalIso(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}
