// Tekst notifikacije o novim rokovima (send_push.mjs new). Čista logika bez
// mreže, da bi se testirala (scripts/poruke.test.ts).
//
// Rokovi istog tipa iz jednog prolaza scraper-a idu u jednu notifikaciju, a
// tekst kaže kad je prijava: FON zna da objavi više rokova odjednom (prvi i
// drugi kolokvijum), a "novi" bi zvučalo pogrešno kad se rok uhvati kasnije.

const VRSTA = { ispit: 'ispita', kolokvijum: 'kolokvijuma' }

// "05.11.2026." -> [5, 11]
const danMesec = s => s.split('.').slice(0, 2).map(Number)

// ["05.11.2026.", "08.11.2026."] -> "5-8. 11.", a preko meseca "30. 11. - 2. 12."
export function opsegPrijave(datumi) {
  const [d1, m1] = danMesec(datumi[0])
  const [d2, m2] = danMesec(datumi[datumi.length - 1])
  if (datumi.length === 1 || (d1 === d2 && m1 === m2)) return `${d1}. ${m1}.`
  return m1 === m2 ? `${d1}-${d2}. ${m1}.` : `${d1}. ${m1}. - ${d2}. ${m2}.`
}

// ["Prvi zimski kolokvijum 2026/27", "Drugi zimski kolokvijum 2026/27"]
//   -> "Prvi i drugi zimski kolokvijum 2026/27"
// Zajednički kraj naziva se piše jednom; bez zajedničkog kraja nazivi se nabrajaju.
export function spojiNazive(nazivi) {
  if (nazivi.length === 1) return nazivi[0]
  const reci = nazivi.map(n => n.split(' '))
  let kraj = 0
  while (reci.every(r => r.length > kraj + 1 && r[r.length - 1 - kraj] === reci[0][reci[0].length - 1 - kraj])) kraj++
  const pocetci = reci.map((r, i) => {
    const p = r.slice(0, r.length - kraj).join(' ')
    return i === 0 ? p : p.charAt(0).toLowerCase() + p.slice(1)
  })
  const nabrojano = `${pocetci.slice(0, -1).join(', ')} i ${pocetci[pocetci.length - 1]}`
  return kraj > 0 ? `${nabrojano} ${reci[0].slice(-kraj).join(' ')}` : nabrojano
}

// `novi`: [{ rok, tip }] iz pending_notify.json; `rokovi`: rokovi.json (datumi prijave).
export function porukeONovimRokovima(novi, rokovi) {
  const poTipu = new Map()
  for (const r of novi) poTipu.set(r.tip, [...(poTipu.get(r.tip) ?? []), r.rok])

  return [...poTipu].map(([tip, nazivi]) => {
    const kind = VRSTA[tip] ?? 'kolokvijuma'
    const delovi = [`${spojiNazive(nazivi)}.`]
    // Prijava roka kome je najranija (prva koja studentu stiže).
    const sPrijavom = nazivi
      .map(rok => ({ rok, datumi: rokovi.find(x => x.rok === rok)?.prijava_datumi ?? [] }))
      .filter(x => x.datumi.length > 0)
      .sort((a, b) => a.datumi[0].split('.').reverse().join('').localeCompare(b.datumi[0].split('.').reverse().join('')))
    if (sPrijavom.length > 0) {
      const { rok, datumi } = sPrijavom[0]
      // "Prijava za prvi:" samo kad ih ima više; reč koja ih razlikuje je prva u nazivu.
      const za = nazivi.length > 1 ? ` za ${rok.split(' ')[0].toLowerCase()}` : ''
      delovi.push(`Prijava${za}: ${opsegPrijave(datumi)}`)
    }
    return {
      title: `Raspored ${kind}`,
      body: delovi.join(' '),
      url: '/rokovi',
      tag: `rok-${nazivi.join('-')}`,
    }
  })
}
