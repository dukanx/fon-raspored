// lib/dodatiTermini.ts
//
// Termini koje je student dodao u Izmeni (iz druge grupe ili godine). Čuva se
// ceo termin, pa bi bez ovoga posle FON-ove izmene ostali stari dan, vreme i
// sala: pri svakom otvaranju Rasporeda dodati termini se porede sa svežim
// podacima svoje godine, ažuriraju se, a promene idu u baner o izmeni.

import type { DodatTermin, ScheduleEntry } from './types'
import { fetchYearBothSemesters } from './schedule'
import { otisak, promene, type Promena } from './izmene'
import { byGroup } from './storage'

const GODINE = [1, 2, 3, 4]

const isteGrupe = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join()

// Isti termin i posle FON-ove izmene: dan, vreme i sala mogu da se promene,
// a predmet, P/V i grupe ne.
const istiTermin = (a: ScheduleEntry, b: ScheduleEntry) =>
  a.subject === b.subject && a.type_short === b.type_short && isteGrupe(a.groups, b.groups)

const jedina = <T,>(niz: T[]) => (niz.length === 1 ? niz[0] : undefined)

const nepromenjen = (a: ScheduleEntry, b: ScheduleEntry) =>
  istiTermin(a, b) && a.day === b.day && a.start === b.start && a.end === b.end && a.room === b.room

export interface UskladjeniDodati {
  dodati: DodatTermin[]
  promene: Promena[]
  // Treba upisati: nešto je pomereno ili nestalo, ili je starom zapisu nađena godina.
  izmenjeno: boolean
}

// `podaci`: termini po godini (oba semestra), samo za godine koje su učitane.
// Termin čija godina nije učitana (offline) ostaje kakav je.
export function uskladiDodate(dodati: DodatTermin[], podaci: Partial<Record<number, ScheduleEntry[]>>): UskladjeniDodati {
  const out: DodatTermin[] = []
  const bilo: ScheduleEntry[] = []
  const sada: ScheduleEntry[] = []
  const zauzeti = new Set<ScheduleEntry>()
  let izmenjeno = false

  for (const t of dodati) {
    const godine = t.godina ? [t.godina] : GODINE
    const g = godine.find(g => podaci[g]?.some(e => nepromenjen(e, t)))
    if (g !== undefined) {
      if (t.godina !== g) izmenjeno = true
      out.push({ ...t, godina: g })
      continue
    }
    // Stari zapis bez godine: godina je ona (jedina) u kojoj takav termin postoji.
    const godina = t.godina ?? jedina(GODINE.filter(g => podaci[g]?.some(e => istiTermin(e, t))))
    const sveze = godina ? podaci[godina] : undefined
    if (!sveze) {
      out.push(t)
      continue
    }
    // Pomeren: isti predmet, P/V i grupe, a novi dan, vreme ili sala. Ako grupa
    // ima više takvih termina, prednost ima onaj istog dana.
    const kandidati = sveze.filter(e => istiTermin(e, t) && !zauzeti.has(e) && !dodati.some(d => nepromenjen(d, e)))
    const novi = kandidati.find(e => e.day === t.day) ?? kandidati[0]
    izmenjeno = true
    bilo.push(t)
    if (novi) {
      zauzeti.add(novi)
      out.push({ ...novi, godina })
      sada.push(novi)
    }
  }

  return { dodati: out, promene: promene(otisak(bilo), otisak(sada), () => true), izmenjeno }
}

// Usklađuje dodate termine grupe sa svežim podacima i upisuje ih ako treba.
export async function osveziDodate(grupa: string): Promise<UskladjeniDodati> {
  const dodati: DodatTermin[] = byGroup.extra(grupa).get()
  if (dodati.length === 0) return { dodati, promene: [], izmenjeno: false }

  const potrebne = [...new Set(dodati.flatMap(t => (t.godina ? [t.godina] : GODINE)))]
  const podaci: Partial<Record<number, ScheduleEntry[]>> = {}
  await Promise.all(potrebne.map(async g => {
    const entries = await fetchYearBothSemesters(g)
    // Prazno znači da podaci nisu stigli (offline), ne da godina nema termina.
    if (entries.length > 0) podaci[g] = entries
  }))

  const r = uskladiDodate(dodati, podaci)
  if (r.izmenjeno) byGroup.extra(grupa).set(r.dodati)
  return r
}
