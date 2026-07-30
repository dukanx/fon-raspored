import { describe, it, expect } from 'vitest'
import { programToTrack, defaultChecked } from './subjects'

describe('programToTrack', () => {
  it('mapira ISiT/MiO (prva godina)', () => {
    expect(programToTrack('ISiT')).toBe('IST')
    expect(programToTrack('MiO')).toBe('MiO')
  })

  it('mapira fine IST module (2-4. god)', () => {
    for (const p of [
      'Informacioni sistemi',
      'Informacione tehnologije',
      'Softversko inženjerstvo',
      'Tehnologije elektronskog poslovanja',
      'Poslovna analitika',
      'Informaciono inženjerstvo',
    ]) {
      expect(programToTrack(p)).toBe('IST')
    }
  })

  it('mapira fine MiO module (2-4. god)', () => {
    for (const p of [
      'Finansijski menadžment',
      'Lin organizacija poslovanja',
      'Menadžment kvaliteta i standardizacija',
      'Marketing menadžment i komunikacije',
      'Operacioni menadžment',
      'Projektni menadžment',
    ]) {
      expect(programToTrack(p)).toBe('MiO')
    }
  })

  it('nepoznat program pada na IST (default)', () => {
    expect(programToTrack('')).toBe('IST')
    expect(programToTrack('Nešto novo')).toBe('IST')
  })
})

describe('defaultChecked', () => {
  it('prost status: obavezan -> true, izborni -> false', () => {
    expect(defaultChecked('Obavezan predmet', 'IST')).toBe(true)
    expect(defaultChecked('Izborni predmet', 'IST')).toBe(false)
  })

  it('modul-zavisan status se razreši za odgovarajući smer', () => {
    const s = 'IST - Obavezan predmet, MiO - Izborni predmet'
    expect(defaultChecked(s, 'IST')).toBe(true)
    expect(defaultChecked(s, 'MiO')).toBe(false)
  })

  it('dvosmislen (obavezan/izborni) -> true (bezbedno)', () => {
    expect(defaultChecked('Obavezan predmet/Izborni predmet', 'IST')).toBe(true)
    const s = 'IST - Obavezan predmet, MiO - Obavezan predmet/Izborni predmet'
    expect(defaultChecked(s, 'MiO')).toBe(true)
  })

  it('smer nije u modul-splitu -> true (bezbedno)', () => {
    expect(defaultChecked('IST - Izborni predmet', 'MiO')).toBe(true)
  })

  it('nepoznat/prazan status -> true', () => {
    expect(defaultChecked(null, 'IST')).toBe(true)
    expect(defaultChecked(undefined, 'IST')).toBe(true)
    expect(defaultChecked('', 'MiO')).toBe(true)
  })

  it('robustno na skraćene parse oblike', () => {
    expect(defaultChecked('Izborni', 'IST')).toBe(false)
    expect(defaultChecked('Obavezni', 'IST')).toBe(true)
  })
})
