import { describe, it, expect } from 'vitest'
import { pendingSemester, expectedSemester, parseSemester, formatSemester, todayLocalIso } from './season'

describe('parseSemester / formatSemester', () => {
  it('čita i vraća isti string', () => {
    const s = parseSemester('Letnji 2025/26')
    expect(s).toEqual({ kind: 'Letnji', startYear: 2025 })
    expect(formatSemester(s!)).toBe('Letnji 2025/26')
  })

  it('dopunjava vodeću nulu na prelazu veka', () => {
    expect(formatSemester({ kind: 'Zimski', startYear: 2099 })).toBe('Zimski 2099/00')
  })

  it('vraća null za nepoznat format', () => {
    expect(parseSemester('')).toBeNull()
    expect(parseSemester('Jesenji 2025/26')).toBeNull()
  })
})

describe('expectedSemester', () => {
  it('od 1. septembra je zimski nove školske godine', () => {
    expect(formatSemester(expectedSemester('2026-09-01'))).toBe('Zimski 2026/27')
    expect(formatSemester(expectedSemester('2026-12-31'))).toBe('Zimski 2026/27')
  })

  it('januar i početak februara su i dalje zimski', () => {
    expect(formatSemester(expectedSemester('2027-01-20'))).toBe('Zimski 2026/27')
    expect(formatSemester(expectedSemester('2027-02-14'))).toBe('Zimski 2026/27')
  })

  it('od 15. februara do kraja avgusta je letnji', () => {
    expect(formatSemester(expectedSemester('2027-02-15'))).toBe('Letnji 2026/27')
    expect(formatSemester(expectedSemester('2027-08-31'))).toBe('Letnji 2026/27')
  })
})

describe('pendingSemester', () => {
  it('kraj septembra, a objavljen je letnji -> čekamo zimski (nova školska godina)', () => {
    expect(pendingSemester('Letnji 2025/26', '2026-09-25')).toEqual({
      label: 'Zimski 2026/27',
      newAcademicYear: true,
    })
  })

  it('leti je letnji i dalje aktuelan', () => {
    expect(pendingSemester('Letnji 2025/26', '2026-07-10')).toBeNull()
    expect(pendingSemester('Letnji 2025/26', '2026-08-31')).toBeNull()
  })

  it('kad izađe zimski, poruka nestaje', () => {
    expect(pendingSemester('Zimski 2026/27', '2026-09-28')).toBeNull()
  })

  it('krajem februara, a objavljen je zimski -> čekamo letnji (ista školska godina)', () => {
    expect(pendingSemester('Zimski 2026/27', '2027-02-20')).toEqual({
      label: 'Letnji 2026/27',
      newAcademicYear: false,
    })
  })

  it('raspored objavljen unapred (pre granice) se ne smatra zastarelim', () => {
    expect(pendingSemester('Zimski 2026/27', '2026-08-25')).toBeNull()
  })

  it('nepoznat format -> null', () => {
    expect(pendingSemester('', '2026-09-25')).toBeNull()
  })
})

describe('todayLocalIso', () => {
  it('formatira lokalni datum', () => {
    expect(todayLocalIso(new Date(2026, 8, 5, 23, 59))).toBe('2026-09-05')
  })
})
