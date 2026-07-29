// Metapodaci predmeta scrapovani sa oas.fon.bg.ac.rs
// (public/data/subjects-meta.json, generiše scripts/scrape_subjects_meta.py).
export type SubjectMeta = {
  url: string
  espb: string | null
  katedra: string | null
  status: string | null
}

export type Track = 'IST' | 'MiO'

// FON OAS ima dva velika smera: "Informacioni sistemi i tehnologije" (IST) i
// "Menadžment i organizacija" (MiO). U 2–4. godini se granaju na fine module,
// ali status na stranici predmeta je i dalje na nivou IST/MiO. Mapiramo fini
// program (iz onboardinga) na grubi smer.
const MIO_KEYS = [
  'mio', 'menadžment i organ', 'menadzment i organ',
  'finansij', 'lin organ', 'kvalitet', 'marketing',
  'operacioni menadž', 'operacioni menadz', 'projektni',
]

export function programToTrack(program: string): Track {
  const p = program.toLowerCase()
  return MIO_KEYS.some(k => p.includes(k)) ? 'MiO' : 'IST'
}

// Da li predmet treba da bude podrazumevano čekiran za dati smer.
// Status može biti prost ("Obavezan predmet" / "Izborni predmet") ili
// modul-zavisan ("IST - Obavezan predmet, MiO - Izborni predmet").
//   obavezan            -> true  (čekiran)
//   izborni             -> false (student sam čekira ako ga sluša)
//   dvosmislen/nepoznat -> true  (bezbedno: radije prikaži pa nek odčekira)
export function defaultChecked(status: string | null | undefined, track: Track): boolean {
  if (!status) return true
  let clause = status
  const parts = [...status.matchAll(/(IST|MiO)\s*-\s*([^,]+)/gi)]
  if (parts.length) {
    const mine = parts.find(p => p[1].toUpperCase() === track.toUpperCase())
    if (!mine) return true
    clause = mine[2]
  }
  const low = clause.toLowerCase()
  const hasObavezan = low.includes('obavez')
  const hasIzborni = low.includes('izbor')
  if (hasObavezan && hasIzborni) return true // dvosmisleno -> bezbedno
  if (hasIzborni) return false
  return true // obavezan ili neprepoznato
}
