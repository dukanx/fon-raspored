import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { aktivniRokovi, napraviICS, odgovaraFilteru, opisVrste, skriveniTermini, type Termin } from './rokovi'
import { byGroup } from './storage'
import { postaviMemStorage, ukloniStorage } from './testStorage'
import type { RokData, RokEntry } from './types'

const T = (subject: string, date: string, start = '10:00'): RokEntry => ({
  subject, date, start, end: '11:40', rooms: ['308'], note: '',
})

const DANAS = '2026-11-01'
const ROKOVI: RokData[] = [
  { rok: 'Novembarski', tip: 'ispit', entries: [T('Matematika 2', '2026-11-20')] },
  { rok: 'Prva kolokvijumska nedelja', tip: 'kolokvijum', entries: [T('Ekonomija', '2026-11-16')] },
  { rok: 'Oktobarski', tip: 'ispit', entries: [T('Statistika', '2026-10-05')] },
]

describe('aktivniRokovi', () => {
  it('Sve: samo rokovi sa budućim terminima, po prvom sledećem terminu', () => {
    expect(aktivniRokovi(ROKOVI, 'sve', DANAS).map(r => r.rok)).toEqual(['Prva kolokvijumska nedelja', 'Novembarski'])
  })

  it('filter po vrsti', () => {
    expect(aktivniRokovi(ROKOVI, 'ispiti', DANAS).map(r => r.rok)).toEqual(['Novembarski'])
    expect(aktivniRokovi(ROKOVI, 'kolokvijumi', DANAS).map(r => r.rok)).toEqual(['Prva kolokvijumska nedelja'])
  })

  it('odgovaraFilteru', () => {
    expect(odgovaraFilteru('ispit', 'sve')).toBe(true)
    expect(odgovaraFilteru('kolokvijum', 'ispiti')).toBe(false)
  })
})

describe('opisVrste', () => {
  it('vrsta roka, kod ispita i pismeni ili usmeni, a sopstveni događaj po tipu', () => {
    expect(opisVrste({ ...T('Ekonomija', '2026-11-16'), tip: 'kolokvijum' })).toBe('Kolokvijum')
    expect(opisVrste({ ...T('Matematika 2', '2026-11-20'), type: 'U', tip: 'ispit' })).toBe('Usmeni ispit')
    expect(opisVrste({ ...T('Matematika 2', '2026-11-20'), tip: 'ispit' })).toBe('Ispit')
    expect(opisVrste({ ...T('OIKT', '2026-11-18'), type: 'Ostalo' })).toBe('Ostalo')
    expect(opisVrste(T('OIKT', '2026-11-18'))).toBe('')
  })
})

describe('napraviICS', () => {
  it('termini po datumu, opis po vrsti roka, sopstveni događaj bez vrste', () => {
    const termini: Termin[] = [
      { ...T('Matematika 2', '2026-11-20'), type: 'P', tip: 'ispit' },
      { ...T('Ekonomija', '2026-11-16'), tip: 'kolokvijum' },
      { ...T('Konsultacije, OIKT', '2026-11-18'), note: 'dogovor mejlom' },
    ]
    const ics = napraviICS(termini)
    const naslovi = ics.split('\r\n').filter(l => l.startsWith('SUMMARY:'))
    expect(naslovi).toEqual(['SUMMARY:Ekonomija', 'SUMMARY:Konsultacije\\, OIKT', 'SUMMARY:Matematika 2 [Pismeni]'])
    expect(ics).toContain('DESCRIPTION:Kolokvijum')
    expect(ics).toContain('DESCRIPTION:dogovor mejlom')
    expect(ics).toContain('DESCRIPTION:Ispit')
  })
})

describe('skriveniTermini', () => {
  beforeEach(postaviMemStorage)
  afterEach(ukloniStorage)

  it('spaja stare liste po tabu u jednu, bez duplikata i prošlih, i briše stare', () => {
    const [ispiti, kolokvijumi] = byGroup.rokHiddenStaro('C13')
    ispiti.set([T('Matematika 2', '2026-11-20'), T('Statistika', '2026-10-05')])
    kolokvijumi.set([T('Ekonomija', '2026-11-16'), T('Matematika 2', '2026-11-20')])

    expect(skriveniTermini('C13', DANAS).map(e => e.subject)).toEqual(['Matematika 2', 'Ekonomija'])
    expect(byGroup.rokHidden('C13').get()).toHaveLength(2)
    expect(ispiti.get()).toEqual([])
    expect(kolokvijumi.get()).toEqual([])
  })

  it('bez starih lista samo izbacuje prošle', () => {
    byGroup.rokHidden('C13').set([T('Ekonomija', '2026-11-16'), T('Statistika', '2026-10-05')])
    expect(skriveniTermini('C13', DANAS).map(e => e.subject)).toEqual(['Ekonomija'])
    expect(byGroup.rokHidden('C13').get()).toHaveLength(1)
  })
})
