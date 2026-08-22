// Kad se prikazuje baner o prijavi ispita/kolokvijuma.
//
// Ranije je stajao ceo period prijave, pa je iskakao pri svakom otvaranju
// aplikacije i postao šum. Sad se javlja samo na četiri povoda, a van njih ćuti:
//
//   novo      — rok je tek osvanuo (prvi put viđen kod korisnika)
//   pocinje   — na dan kad prijava počinje
//   uskoro    — PRIJAVA_NAJAVA_DANA pre KRAJA prijave (dan pred istek — "sutra")
//   poslednji — na poslednji dan prijave
//
// Funkcija vraća TAČNO JEDAN povod (ili nijedan), nikad više njih odjednom —
// kad se dva poklope istog dana (npr. dvodnevna prijava, gde je "dan pred
// istek" isti datum kao početak), pobeđuje raniji u nizu SVI_POVODI.
//
// Posle isteka prijave baner nestaje, kao i pre.

export type PrijavaPovod = 'novo' | 'uskoro' | 'pocinje' | 'poslednji'

export const SVI_POVODI: PrijavaPovod[] = ['novo', 'uskoro', 'pocinje', 'poslednji']
// Dan pred istek prijave ("sutra ističe"). Bio 2 — vraćeno na 1 na izričit
// zahtev, umesto ranijeg "2 dana pre kraja".
export const PRIJAVA_NAJAVA_DANA = 1

export const POVOD_NASLOV: Record<PrijavaPovod, string> = {
  novo: 'Objavljen je nov rok',
  pocinje: 'Prijava počinje danas',
  // Fiksan tekst, ne templated "za N dana" — sa najavaDana=1 je uvek "sutra",
  // a "za 1 dan" bi bilo gramatički pogrešno (treba "1 dan", ne "1 dana").
  uskoro: 'Sutra je poslednji dan prijave',
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

  // Redosled prioriteta kad se dva povoda poklope istog dana (npr. dvodnevna
  // prijava, gde je "dan pred istek" isti datum kao "prijava počinje"):
  // "novo" > "pocinje" > "uskoro" > "poslednji" — sigurnija/preciznija vest
  // pobeđuje nejasniju najavu.
  if (jeNov) return 'novo'
  if (todayStr === pocetak) return 'pocinje'
  if (todayStr === isoMinusDana(kraj, najavaDana)) return 'uskoro'
  if (todayStr === kraj) return 'poslednji'
  return null
}
