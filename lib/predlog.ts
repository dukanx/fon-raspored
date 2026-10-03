// lib/predlog.ts
//
// Predlog termina za predmet koji se dodaje u raspored (Izmena tab). Pravila su
// ista kao ona koja je ranije dobijao AI, samo što ih ovde računa kod - tačno,
// odmah i bez troška:
//   1. slobodan termin pre termina koji gazi postojeći
//   2. ako se mora gaziti, bolje predavanje nego vežbe
//   3. što manje pauza i novih dolazaka na fakultet: jedna pauza (jedan prazan
//      termin) je bolja od posebnog dolaska, dve i više su gore
//   4. bolje vreme: 10:15, 12:15, 08:15, 14:15, 16:15, 18:15
// Predavanje i vežbe nikad u istom terminu.

import type { DayOfWeek, ScheduleEntry } from './types'
import { DAY_U } from './schedule'

// Pravilo 3: poseban dolazak na fakultet vredi kao 1.5 prazna termina, pa je
// između jedne i dve pauze.
const NOVI_DAN = 1.5

// Pravilo 4: sredina dana pre ranog jutra i večeri.
const TIME_RANK: Record<string, number> = {
  '10:15': 0, '12:15': 1, '08:15': 2, '14:15': 3, '16:15': 4, '18:15': 5,
}

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Redni broj dvočasovnog bloka (08:15 -> 0, 10:15 -> 1...). Radi i za
// neobičan početak, zaokruživanjem na najbliži blok.
function slotIndex(start: string): number {
  return Math.round((toMin(start) - toMin('08:15')) / 120)
}

function sameSlot(a: ScheduleEntry, b: ScheduleEntry): boolean {
  return a.day === b.day && a.start === b.start
}

// Postojeći termin istog predmeta i tipa se ionako zamenjuje novim (tako radi
// i "Dodaj"), pa se ne računa kao zauzeto mesto.
function occupied(raspored: ScheduleEntry[], e: ScheduleEntry): ScheduleEntry[] {
  return raspored.filter(r => !(r.subject === e.subject && r.type_short === e.type_short))
}

// Prazni blokovi između prve i poslednje nastave u danu.
function idle(slots: number[]): number {
  if (slots.length === 0) return 0
  const set = new Set(slots)
  return Math.max(...set) - Math.min(...set) + 1 - set.size
}

export interface Cinjenice {
  menja: ScheduleEntry | null // postojeći termin koji se gazi
  pre: ScheduleEntry | null // nastava odmah pre, istog dana
  posle: ScheduleEntry | null // nastava odmah posle, istog dana
  noviDan: boolean // tog dana nema druge nastave
  pauzaBlokova: number // prazni blokovi koje termin dodaje tom danu
}

export function cinjenice(e: ScheduleEntry, raspored: ScheduleEntry[]): Cinjenice {
  const ostalo = occupied(raspored, e)
  const dan = ostalo.filter(r => r.day === e.day)
  const i = slotIndex(e.start)
  const before = dan.map(r => slotIndex(r.start))
  return {
    menja: dan.find(r => sameSlot(r, e)) ?? null,
    pre: dan.find(r => slotIndex(r.start) === i - 1) ?? null,
    posle: dan.find(r => slotIndex(r.start) === i + 1) ?? null,
    noviDan: dan.length === 0,
    pauzaBlokova: idle([...before, i]) - idle(before),
  }
}

// Ocena para, manje je bolje; poredi se redom (leksikografski).
function ocena(raspored: ScheduleEntry[], picks: ScheduleEntry[]): number[] {
  const ostalo = picks.reduce((acc, p) => occupied(acc, p), raspored)
  const menjaju = picks.map(p => ostalo.find(r => sameSlot(r, p)) ?? null)
  const days = new Set<DayOfWeek>(picks.map(p => p.day))
  let cenaDana = 0
  for (const day of days) {
    const before = ostalo.filter(r => r.day === day).map(r => slotIndex(r.start))
    const after = [...before, ...picks.filter(p => p.day === day).map(p => slotIndex(p.start))]
    cenaDana += idle(after) - idle(before) + (before.length === 0 ? NOVI_DAN : 0)
  }
  return [
    menjaju.filter(Boolean).length,
    menjaju.filter(m => m?.type_short === 'V').length,
    cenaDana,
    picks.reduce((s, p) => s + (TIME_RANK[p.start] ?? 6), 0),
  ]
}

function manje(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]
  return false
}

export interface Par {
  p: ScheduleEntry | null
  v: ScheduleEntry | null
}

export function najboljiPar(raspored: ScheduleEntry[], predavanja: ScheduleEntry[], vezbe: ScheduleEntry[]): Par {
  const ps: (ScheduleEntry | null)[] = predavanja.length ? predavanja : [null]
  const vs: (ScheduleEntry | null)[] = vezbe.length ? vezbe : [null]
  let best: Par = { p: null, v: null }
  let bestScore: number[] | null = null
  for (const p of ps) {
    for (const v of vs) {
      if (p && v && sameSlot(p, v)) continue
      const score = ocena(raspored, [p, v].filter((e): e is ScheduleEntry => !!e))
      if (!bestScore || manje(score, bestScore)) {
        best = { p, v }
        bestScore = score
      }
    }
  }
  return best
}

// Ocena bilo kog para, za poređenje u eval-u (scripts/eval-predlog.ts).
export function ocenaPara(raspored: ScheduleEntry[], par: Par): number[] {
  return ocena(raspored, [par.p, par.v].filter((e): e is ScheduleEntry => !!e))
}

// Kratak opis termina za ljude i za AI kao činjenica. Naziv predmeta ide uz
// "predmet(a)" i pod navodnicima, jer se sam naziv ne menja po padežima.
const q = (e: ScheduleEntry) => `„${e.subject}“`
export function opisSuseda(c: Cinjenice): string | null {
  if (c.pre && c.posle) return `između predmeta ${q(c.pre)} i ${q(c.posle)}`
  if (c.pre) return `odmah posle predmeta ${q(c.pre)}`
  if (c.posle) return `odmah pre predmeta ${q(c.posle)}`
  if (c.noviDan) return 'jedini čas tog dana'
  if (c.pauzaBlokova > 0) return `dodaje pauzu od ${c.pauzaBlokova * 2} h`
  return null
}

export function opisCinjenica(c: Cinjenice): string {
  const status = c.menja ? `menja predmet ${q(c.menja)} [${c.menja.type_short}]` : 'slobodno'
  return [status, opisSuseda(c)].filter(Boolean).join(', ')
}

// Razlog po šablonu: po rečenica za predavanje i vežbe, iz izračunatih činjenica.
// Vidi se odmah (i offline), a služi i kao činjenice AI-ju koji ga prepriča.
export function razlogPoSablonu(raspored: ScheduleEntry[], par: Par): string {
  const recenica = (e: ScheduleEntry) =>
    `${e.type_short === 'P' ? 'Predavanje' : 'Vežbe'} u ${DAY_U[e.day]} ${e.start}: ${opisCinjenica(cinjenice(e, raspored))}.`
  return [par.p, par.v].filter((e): e is ScheduleEntry => !!e).map(recenica).join(' ')
}
