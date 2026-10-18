// Kome ide "Raspored nastave je izmenjen" i šta u njoj piše. Čista logika bez
// mreže, da bi se testirala (scripts/ciljanje.test.ts); koristi je send_push.mjs.
//
// `izmene` pravi scripts/izmenjene-grupe.ts:
//   { "3:C13": { "promene": ["Matematika 1|V"], "novi": ["Novi izborni"] } }
// Pretplata (functions/api/push.ts) ima `godina` i `grupa`, a novija i
// `predmeti` (čekirani) i `dodati` (termini iz drugih grupa, v. lib/dodatiTermini).

const OPSTA = 'Proveri svoje termine i sale, a ako su dodati novi predmeti, čekiraj one koje slušaš.'
const NAJVISE_NAVEDENIH = 3

// "Matematika 1|V" -> "Matematika 1 (V)"
const naziv = pt => {
  const i = pt.lastIndexOf('|')
  return `${pt.slice(0, i)} (${pt.slice(i + 1)})`
}

function spisak(predmeti) {
  const navedeni = predmeti.slice(0, NAJVISE_NAVEDENIH).map(naziv).join(', ')
  const ostalo = predmeti.length - NAJVISE_NAVEDENIH
  return ostalo > 0 ? `${navedeni} i još ${ostalo}` : navedeni
}

// Tekst poruke za pretplatu, ili null kad se ništa njeno nije promenilo.
export function porukaOIzmeni(izmene, sub) {
  // Pretplata od pre nego što se pamtila grupa: ne zna se šta prati.
  if (!sub.grupa) return OPSTA
  const moja = izmene[`${sub.godina}:${sub.grupa}`]

  // Bez izbora predmeta (stara aplikacija ili student nije čekirao): po grupi.
  if (!Array.isArray(sub.predmeti)) {
    return moja
      ? `Promenjen je raspored grupe ${sub.grupa}. Proveri termine i sale, a ako su dodati novi predmeti, čekiraj one koje slušaš.`
      : null
  }

  const dodati = Array.isArray(sub.dodati) ? sub.dodati : []
  // Predmet i P/V za koje je dodat termin iz druge grupe ne idu po svojoj grupi.
  const pregazeni = new Set(dodati.map(d => `${d.predmet}|${d.tip}`))
  const pogodjeni = new Set()
  for (const pt of moja?.promene ?? []) {
    if (sub.predmeti.includes(pt.slice(0, pt.lastIndexOf('|'))) && !pregazeni.has(pt)) pogodjeni.add(pt)
  }
  for (const d of dodati) {
    const pt = `${d.predmet}|${d.tip}`
    if (d.grupe.some(g => izmene[`${d.godina}:${g}`]?.promene.includes(pt))) pogodjeni.add(pt)
  }

  const novi = moja?.novi ?? []
  const delovi = []
  if (pogodjeni.size === 1) delovi.push(`Izmenjen termin: ${spisak([...pogodjeni])}.`)
  else if (pogodjeni.size > 1) delovi.push(`Izmenjeni termini: ${spisak([...pogodjeni].sort())}.`)
  if (novi.length > 0) delovi.push('Dodati su novi predmeti, čekiraj one koje slušaš.')
  return delovi.length > 0 ? delovi.join(' ') : null
}
