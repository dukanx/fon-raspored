import { describe, it, expect } from 'vitest'
import { porukeONovimRokovima, opsegPrijave, spojiNazive } from './poruke.mjs'

const rokovi = [
  { rok: 'Prvi zimski kolokvijum 2026/27', prijava_datumi: ['05.11.2026.', '08.11.2026.'] },
  { rok: 'Drugi zimski kolokvijum 2026/27', prijava_datumi: ['17.12.2026.', '20.12.2026.'] },
  { rok: 'Januarski ispitni rok', prijava_datumi: ['30.12.2026.', '02.01.2027.'] },
]

describe('porukeONovimRokovima', () => {
  it('dva kolokvijuma odjednom: jedna notifikacija, sa prijavom za prvi', () => {
    const novi = [
      { rok: 'Prvi zimski kolokvijum 2026/27', tip: 'kolokvijum' },
      { rok: 'Drugi zimski kolokvijum 2026/27', tip: 'kolokvijum' },
    ]
    expect(porukeONovimRokovima(novi, rokovi)).toEqual([{
      title: 'Raspored kolokvijuma',
      body: 'Prvi i drugi zimski kolokvijum 2026/27. Prijava za prvi: 5-8. 11.',
      url: '/rokovi',
      tag: 'rok-Prvi zimski kolokvijum 2026/27-Drugi zimski kolokvijum 2026/27',
    }])
  })

  it('jedan rok, prijava preko meseca', () => {
    const [p] = porukeONovimRokovima([{ rok: 'Januarski ispitni rok', tip: 'ispit' }], rokovi)
    expect([p.title, p.body]).toEqual(['Raspored ispita', 'Januarski ispitni rok. Prijava: 30. 12. - 2. 1.'])
  })

  it('bez datuma prijave samo naziv', () => {
    expect(porukeONovimRokovima([{ rok: 'Mart', tip: 'ispit' }], rokovi)[0].body).toBe('Mart.')
  })
})

describe('pomoćne', () => {
  it('opseg prijave', () => {
    expect(opsegPrijave(['05.11.2026.'])).toBe('5. 11.')
    expect(opsegPrijave(['05.11.2026.', '08.11.2026.'])).toBe('5-8. 11.')
  })
  it('nazivi bez zajedničkog kraja se nabrajaju', () => {
    expect(spojiNazive(['Junski', 'Julski'])).toBe('Junski i julski')
  })
})
