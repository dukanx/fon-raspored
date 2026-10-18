// lib/izmene.ts
//
// Šta se promenilo u rasporedu grupe od kad ga je student poslednji put video.
// Raspored pamti otisak rasporeda GRUPE (ne samo čekiranih predmeta, da čekiranje
// ne bi izgledalo kao izmena), pa kad FON promeni sale ili termine, baner na
// Rasporedu pokaže tačne promene za predmete koje student prati. Bez ovoga je
// izmena tiha za sve bez notifikacija. Notifikacija ide samo studentima kojima
// se promenio predmet koji prate (`izmeneGrupa`, v. notify-nastava.yml).

import type { ScheduleEntry, SemesterData } from './types'
import { DAY_SHORT, getScheduleForGroup } from './schedule'

// Jedan termin kao string; sala je deo otiska, jer je i ona izmena.
export function otisak(entries: ScheduleEntry[]): string[] {
  return [...new Set(entries.map(e => [e.subject, e.type_short, e.day, e.start, e.room].join('|')))].sort()
}

// Šta se promenilo grupi između dve objave, za ciljane notifikacije:
// `promene` su "predmet|P" ili "predmet|V" čiji su termini pomereni ili
// uklonjeni (ili im je promenjena sala), `novi` su predmeti kojih ranije nije bilo.
export interface IzmenaGrupe {
  promene: string[]
  novi: string[]
}

// Samo grupe kojima se nešto promenilo. Grupa koja je dodata ili nestala računa
// se kao promenjena (svi predmeti su joj novi, odnosno uklonjeni).
export function izmeneGrupa(stari: SemesterData, novi: SemesterData): Record<string, IzmenaGrupe> {
  const grupe = [...new Set([...stari.entries, ...novi.entries].flatMap(e => e.groups))].sort()
  const out: Record<string, IzmenaGrupe> = {}
  for (const g of grupe) {
    const pre = getScheduleForGroup(stari, g)
    const posle = getScheduleForGroup(novi, g)
    const ranije = new Set(pre.map(e => e.subject))
    const izmena = {
      promene: promene(otisak(pre), otisak(posle), () => true).map(p => `${p.predmet}|${p.tip}`),
      novi: [...new Set(posle.map(e => e.subject))].filter(s => !ranije.has(s)).sort(),
    }
    if (izmena.promene.length || izmena.novi.length) out[g] = izmena
  }
  return out
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

export type VidenRaspored = { semester: string; otisak: string[] }

export type OdlukaOIzmeni =
  | { tip: 'nista' }
  | { tip: 'zapamti' }
  | { tip: 'baner'; promene: Promena[] }

// Šta Raspored radi kad ga student otvori, poredeći sa onim što je video:
// - prvi put, ili nov semestar: samo zapamti (nema šta da se poredi)
// - isti raspored: ništa
// - promene u predmetima koje prati: baner (pamti se tek kad ga zatvori)
// - promene samo u predmetima koje ne prati: zapamti tiho
export function odlukaOIzmeni(
  ranije: VidenRaspored | null,
  sada: VidenRaspored,
  prati: (predmet: string) => boolean
): OdlukaOIzmeni {
  if (!ranije || ranije.semester !== sada.semester) return { tip: 'zapamti' }
  if (ranije.otisak.join('\n') === sada.otisak.join('\n')) return { tip: 'nista' }
  const p = promene(ranije.otisak, sada.otisak, prati)
  return p.length > 0 ? { tip: 'baner', promene: p } : { tip: 'zapamti' }
}

// "Matematika 1 (P): Pon 08:15, Amfiteatar 3 → Pon 08:15, Amfiteatar 1"
export function opisPromene(p: Promena): string {
  const naziv = `${p.predmet} (${p.tip})`
  if (!p.sada.length) return `${naziv}: više nije u rasporedu (${p.bilo.join('; ')})`
  if (!p.bilo.length) return `${naziv}: nov termin ${p.sada.join('; ')}`
  return `${naziv}: ${p.bilo.join('; ')} → ${p.sada.join('; ')}`
}
