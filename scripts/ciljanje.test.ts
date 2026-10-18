import { describe, it, expect } from 'vitest'
import { porukaOIzmeni } from './ciljanje.mjs'

const izmene = {
  '3:C13': { promene: ['Matematika 1|V', 'Ekonomija|P'], novi: [] },
  '1:A17': { promene: ['Menadžment|V'], novi: [] },
  '3:C14': { promene: [], novi: ['Novi izborni'] },
}
const sub = (o: object) => ({ godina: '3', grupa: 'C13', ...o })

describe('porukaOIzmeni', () => {
  it('pretplata bez grupe dobija opštu poruku', () => {
    expect(porukaOIzmeni(izmene, {})).toMatch(/^Proveri svoje termine/)
  })

  it('bez izbora predmeta ide po grupi, kao ranije', () => {
    expect(porukaOIzmeni(izmene, sub({}))).toMatch(/^Promenjen je raspored grupe C13/)
    expect(porukaOIzmeni(izmene, sub({ grupa: 'C15' }))).toBeNull()
  })

  it('samo predmeti koje student prati, sa nazivom u poruci', () => {
    expect(porukaOIzmeni(izmene, sub({ predmeti: ['Matematika 1'] }))).toBe('Izmenjen termin: Matematika 1 (V).')
    expect(porukaOIzmeni(izmene, sub({ predmeti: ['Marketing'] }))).toBeNull()
  })

  it('više izmena se nabraja', () => {
    expect(porukaOIzmeni(izmene, sub({ predmeti: ['Matematika 1', 'Ekonomija'] })))
      .toBe('Izmenjeni termini: Ekonomija (P), Matematika 1 (V).')
  })

  it('dodat termin iz druge grupe i godine', () => {
    const dodati = [{ godina: 1, grupe: ['A17'], predmet: 'Menadžment', tip: 'V' }]
    expect(porukaOIzmeni(izmene, sub({ grupa: 'C15', predmeti: [], dodati }))).toBe('Izmenjen termin: Menadžment (V).')
  })

  it('izmena u svojoj grupi ne važi kad je za taj predmet i P/V dodat drugi termin', () => {
    const dodati = [{ godina: 1, grupe: ['A1'], predmet: 'Matematika 1', tip: 'V' }]
    expect(porukaOIzmeni(izmene, sub({ predmeti: ['Matematika 1'], dodati }))).toBeNull()
  })

  it('novi predmet u grupi javlja se i bez izmena u praćenim predmetima', () => {
    expect(porukaOIzmeni(izmene, sub({ grupa: 'C14', predmeti: ['Marketing'] })))
      .toBe('Dodati su novi predmeti, čekiraj one koje slušaš.')
  })

  it('posle tri navedena piše koliko ih je još', () => {
    const mnogo = { '3:C13': { promene: ['A|P', 'B|P', 'C|P', 'D|P', 'E|V'], novi: [] } }
    expect(porukaOIzmeni(mnogo, sub({ predmeti: ['A', 'B', 'C', 'D', 'E'] })))
      .toBe('Izmenjeni termini: A (P), B (P), C (P) i još 2.')
  })
})
