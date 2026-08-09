// Kad se prikazuje baner o prijavi ispita/kolokvijuma.
//
// Ranije je stajao ceo period prijave, pa je iskakao pri svakom otvaranju
// aplikacije i postao šum. Sad se javlja samo na četiri povoda, a van njih ćuti:
//
//   novo      — rok je tek osvanuo (prvi put viđen kod korisnika)
//   uskoro    — PRIJAVA_NAJAVA_DANA pre početka prijave
//   pocinje   — na dan kad prijava počinje
//   poslednji — na poslednji dan prijave
//
// Posle isteka prijave baner nestaje, kao i pre.

export type PrijavaPovod = 'novo' | 'uskoro' | 'pocinje' | 'poslednji'

export const SVI_POVODI: PrijavaPovod[] = ['novo', 'uskoro', 'pocinje', 'poslednji']
export const PRIJAVA_NAJAVA_DANA = 2

export const POVOD_NASLOV: Record<PrijavaPovod, string> = {
  novo: 'Objavljen je nov rok',
  uskoro: `Prijava počinje za ${PRIJAVA_NAJAVA_DANA} dana`,
  pocinje: 'Prijava počinje danas',
  poslednji: 'Danas je poslednji dan prijave',
}

// "25.06.2026." -> "2026-06-25". Radimo sa ISO stringovima jer je njihovo
// poređenje nezavisno od vremenske zone, za razliku od new Date(...) nad
// lokalnim datumima.
export function srDatumUISO(s: string): string | null {
  const [d, m, y] = s.replace(/\.$/, '').split('.')
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

// Čisto UTC računanje — setDate() nad lokalnim datumom ume da pomeri dan.
export function isoMinusDana(iso: string, dana: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - dana)
  return dt.toISOString().split('T')[0]
}

export function pickPrijavaPovod(opts: {
  prijavaDatumi: string[] | undefined
  todayStr: string
  /** Rok se prvi put pojavio kod ovog korisnika. */
  jeNov: boolean
  najavaDana?: number
}): PrijavaPovod | null {
  const { prijavaDatumi, todayStr, jeNov } = opts
  const najavaDana = opts.najavaDana ?? PRIJAVA_NAJAVA_DANA
  if (!prijavaDatumi?.length) return null

  const pocetak = srDatumUISO(prijavaDatumi[0])
  const kraj = srDatumUISO(prijavaDatumi[prijavaDatumi.length - 1])
  if (!pocetak || !kraj) return null

  // Prijava prošla — baner nestaje.
  if (todayStr > kraj) return null

  // "Novo" ima prednost: na dan kad rok osvane to je najvažnija vest, čak i ako
  // se tog dana slučajno poklopi sa nekim od datuma prijave.
  if (jeNov) return 'novo'
  if (todayStr === isoMinusDana(pocetak, najavaDana)) return 'uskoro'
  if (todayStr === pocetak) return 'pocinje'
  if (todayStr === kraj) return 'poslednji'
  return null
}
