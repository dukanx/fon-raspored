// lib/izmene.ts
//
// Šta se promenilo u rasporedu grupe od kad ga je student poslednji put video.
// Raspored pamti otisak rasporeda GRUPE (ne samo čekiranih predmeta, da čekiranje
// ne bi izgledalo kao izmena), pa kad FON promeni sale ili termine, baner na
// Rasporedu pokaže tačne promene za predmete koje student prati. Bez ovoga je
// izmena tiha za sve bez notifikacija. Notifikacija ide samo grupama kojima se
// raspored promenio (`izmenjeneGrupe`, v. notify-nastava.yml).

import type { ScheduleEntry, SemesterData } from './types'
import { DAY_SHORT, getScheduleForGroup } from './schedule'

// Jedan termin kao string; sala je deo otiska, jer je i ona izmena.
export function otisak(entries: ScheduleEntry[]): string[] {
  return [...new Set(entries.map(e => [e.subject, e.type_short, e.day, e.start, e.room].join('|')))].sort()
}

// Grupe kojima se raspored promenio između dve objave, za ciljane notifikacije.
// Grupa koja je dodata ili nestala računa se kao promenjena.
export function izmenjeneGrupe(stari: SemesterData, novi: SemesterData): string[] {
  const grupe = new Set([...stari.entries, ...novi.entries].flatMap(e => e.groups))
  const isti = (g: string) =>
    otisak(getScheduleForGroup(stari, g)).join('\n') === otisak(getScheduleForGroup(novi, g)).join('\n')
  return [...grupe].filter(g => !isti(g)).sort()
}

export interface Promena {
  predmet: string
  tip: 'P' | 'V'
  bilo: string[] // termini kojih više nema ("Pon 08:15, Amfiteatar 3")
  sada: string[] // novi termini
}

// Termin bez sale kao ključ, sale spojene (ista vežba u više sala je jedan termin).
function terminiPoPredmetu(otisak: string[]): Map<string, Map<string, string[]>> {
  const out = new Map<string, Map<string, string[]>>()
  for (const s of otisak) {
    const [predmet, tip, day, start, room] = s.split('|')
    const pt = `${predmet}|${tip}`
    if (!out.has(pt)) out.set(pt, new Map())
    const slot = `${DAY_SHORT[day as keyof typeof DAY_SHORT] ?? day} ${start}`
    const sale = out.get(pt)!
    sale.set(slot, [...(sale.get(slot) ?? []), room].sort())
  }
  return out
}

// Promene za predmete iz `prati`. Predmet kog ranije nije bilo se preskače: za
// njega već postoji popup "Dodati su novi predmeti".
export function promene(stari: string[], novi: string[], prati: (predmet: string) => boolean): Promena[] {
  const pre = terminiPoPredmetu(stari)
  const posle = terminiPoPredmetu(novi)
  const out: Promena[] = []
  for (const [pt, bilo] of pre) {
    const [predmet, tip] = pt.split('|') as [string, 'P' | 'V']
    if (!prati(predmet)) continue
    const sada = posle.get(pt) ?? new Map<string, string[]>()
    const opis = (m: Map<string, string[]>, slot: string) => `${slot}, ${m.get(slot)!.join(', ')}`
    const isto = (slot: string) => sada.get(slot)?.join() === bilo.get(slot)?.join()
    const nestalo = [...bilo.keys()].filter(s => !isto(s)).map(s => opis(bilo, s))
    const stiglo = [...sada.keys()].filter(s => !isto(s)).map(s => opis(sada, s))
    if (nestalo.length || stiglo.length) out.push({ predmet, tip, bilo: nestalo, sada: stiglo })
  }
  return out.sort((a, b) => a.predmet.localeCompare(b.predmet, 'sr') || a.tip.localeCompare(b.tip))
}

// "Matematika 1 (P): Pon 08:15, Amfiteatar 3 → Pon 08:15, Amfiteatar 1"
export function opisPromene(p: Promena): string {
  const naziv = `${p.predmet} (${p.tip})`
  if (!p.sada.length) return `${naziv}: više nije u rasporedu (${p.bilo.join('; ')})`
  if (!p.bilo.length) return `${naziv}: nov termin ${p.sada.join('; ')}`
  return `${naziv}: ${p.bilo.join('; ')} → ${p.sada.join('; ')}`
}
