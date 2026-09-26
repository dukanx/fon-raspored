import { describe, it, expect } from 'vitest'
import { isNewAcademicYear } from './semester'

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
