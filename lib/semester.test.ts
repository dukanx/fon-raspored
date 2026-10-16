import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isNewAcademicYear, reconcileSemester } from './semester'
import { saved, byGroup } from './storage'
import { postaviMemStorage, ukloniStorage } from './testStorage'

describe('isNewAcademicYear', () => {
  it('letnji -> zimski sledeće godine je nova školska godina', () => {
    expect(isNewAcademicYear('Letnji 2025/26', 'Zimski 2026/27')).toBe(true)
  })

  it('zimski -> letnji iste godine nije', () => {
    expect(isNewAcademicYear('Zimski 2026/27', 'Letnji 2026/27')).toBe(false)
  })

  it('isti semestar (ponovna objava) nije', () => {
    expect(isNewAcademicYear('Zimski 2026/27', 'Zimski 2026/27')).toBe(false)
  })

  it('bez sačuvanog semestra ili nepoznat format -> false', () => {
    expect(isNewAcademicYear(null, 'Zimski 2026/27')).toBe(false)
    expect(isNewAcademicYear('', 'Zimski 2026/27')).toBe(false)
    expect(isNewAcademicYear('Letnji 2025/26', '')).toBe(false)
  })
})

describe('reconcileSemester', () => {
  beforeEach(postaviMemStorage)
  afterEach(ukloniStorage)

  const pick = () => byGroup.subjects('G1').set({ OIKT: true })
  const picked = () => byGroup.subjects('G1').get()

  it('noviji semestar briše izbor predmeta', () => {
    saved.semester.set('Zimski 2026/27')
    pick()
    expect(reconcileSemester('Letnji 2026/27', 'G1')).toBe(true)
    expect(picked()).toEqual({})
    expect(saved.semester.get()).toBe('Letnji 2026/27')
  })

  it('stariji semestar (zastareo god.json iz keša) ne dira ništa', () => {
    saved.semester.set('Letnji 2026/27')
    pick()
    expect(reconcileSemester('Zimski 2026/27', 'G1')).toBe(false)
    expect(picked()).toEqual({ OIKT: true })
    expect(saved.semester.get()).toBe('Letnji 2026/27')
  })

  it('napred, pa zastareo nazad, pa opet napred: izbor posle prvog prelaza ostaje', () => {
    saved.semester.set('Zimski 2026/27')
    expect(reconcileSemester('Letnji 2026/27', 'G1')).toBe(true)
    pick()
    expect(reconcileSemester('Zimski 2026/27', 'G1')).toBe(false)
    expect(reconcileSemester('Letnji 2026/27', 'G1')).toBe(false)
    expect(picked()).toEqual({ OIKT: true })
  })

  it('nepoznat format i dalje radi kao ranije (svaka razlika je prelaz)', () => {
    saved.semester.set('nešto staro')
    pick()
    expect(reconcileSemester('Zimski 2026/27', 'G1')).toBe(true)
    expect(picked()).toEqual({})
  })
})
