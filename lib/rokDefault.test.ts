import { describe, it, expect } from 'vitest'
import { pickDefaultTab } from './rokDefault'
import type { RokData, RokEntry } from './types'

const entry = (date: string): RokEntry => ({
  subject: 'Matematika 2', date, start: '10:00', end: '11:40', rooms: ['308'], note: '',
})

// Realni raspored (avgust 2026): julski -> septembarski -> oktobarski, sa
// nedeljama pauze između — treba da se spoje u jedan "ispitni period".
const LETNJA_SEZONA: RokData[] = [
  { rok: 'Julski', tip: 'ispit', entries: [entry('2026-06-29'), entry('2026-07-11')] },
  { rok: 'Septembarski', tip: 'ispit', entries: [entry('2026-08-24'), entry('2026-09-05')] },
  { rok: 'Oktobarski', tip: 'ispit', entries: [entry('2026-09-07'), entry('2026-09-19')] },
]

describe('pickDefaultTab — spajanje susednih rokova u sezonu', () => {
  it('u pauzi između julskog i septembarskog (i dalje ista sezona) -> rokovi', () => {
    expect(pickDefaultTab(LETNJA_SEZONA, '2026-08-01')).toBe('/rokovi')
  })

  it('par dana pre julskog (bafer) -> rokovi', () => {
    expect(pickDefaultTab(LETNJA_SEZONA, '2026-06-20')).toBe('/rokovi')
  })

  it('dan posle poslednjeg datuma oktobarskog -> raspored', () => {
    expect(pickDefaultTab(LETNJA_SEZONA, '2026-09-20')).toBe('/raspored')
  })

  it('davno pre sezone (aktivna nastava) -> raspored', () => {
    expect(pickDefaultTab(LETNJA_SEZONA, '2026-05-01')).toBe('/raspored')
  })
})

describe('pickDefaultTab — razdvojeni rokovi (velika pauza, nastava između)', () => {
  const ZIMSKA_PA_LETNJA: RokData[] = [
    { rok: 'Februarski', tip: 'ispit', entries: [entry('2026-01-26'), entry('2026-02-13')] },
    { rok: 'Junski', tip: 'ispit', entries: [entry('2026-06-15'), entry('2026-06-27')] },
  ]

  it('u pauzi između februarskog i junskog (aktivna nastava, ~4 meseca) -> raspored', () => {
    expect(pickDefaultTab(ZIMSKA_PA_LETNJA, '2026-04-01')).toBe('/raspored')
  })

  it('unutar februarskog -> rokovi, unutar junskog -> rokovi', () => {
    expect(pickDefaultTab(ZIMSKA_PA_LETNJA, '2026-02-01')).toBe('/rokovi')
    expect(pickDefaultTab(ZIMSKA_PA_LETNJA, '2026-06-20')).toBe('/rokovi')
  })
})

describe('pickDefaultTab — ivični slučajevi', () => {
  it('kolokvijumi se ignorišu (dešavaju se usred semestra)', () => {
    const samoKolokvijum: RokData[] = [
      { rok: 'Aprilski kolokvijum', tip: 'kolokvijum', entries: [entry('2026-04-15')] },
    ]
    expect(pickDefaultTab(samoKolokvijum, '2026-04-15')).toBe('/raspored')
  })

  it('prazna lista rokova -> raspored', () => {
    expect(pickDefaultTab([], '2026-08-30')).toBe('/raspored')
  })

  it('rok bez entries se preskače bez pucanja', () => {
    const withEmpty: RokData[] = [{ rok: 'Prazan', tip: 'ispit', entries: [] }, ...LETNJA_SEZONA]
    expect(pickDefaultTab(withEmpty, '2026-08-01')).toBe('/rokovi')
  })

  it('prilagodljivi leadDays/mergeGapDays', () => {
    expect(pickDefaultTab(LETNJA_SEZONA, '2026-08-01', { mergeGapDays: 10 })).toBe('/raspored')
    expect(pickDefaultTab(LETNJA_SEZONA, '2026-06-20', { leadDays: 3 })).toBe('/raspored')
  })
})
