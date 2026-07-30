import { describe, it, expect } from 'vitest'
import type { SemesterData } from './types'
import {
  findGroup,
  getScheduleForGroup,
  getProgramsForYear,
  getElectivesForGroup,
  uniqueSubjectsForGroup,
} from './schedule'

// Sintetički semestar: dva IST opsega + jedna MiO grupa "Svi".
// Opsezi prate FON format "Od - Do" sa ivicama "A-" i "Š-".
const DATA: SemesterData = {
  semester: 'Zimski 2025/26',
  year: 2,
  groups: {
    B1: { program: 'Informacioni sistemi', range: 'A- - Lekić' },
    B2: { program: 'Informacioni sistemi', range: 'Leković - Š-' },
    B9: { program: 'Finansijski menadžment', range: 'Svi' },
  },
  entries: [
    { day: 'Ponedeljak', subject: 'Baze podataka', type: 'Predavanje', type_short: 'P', groups: ['B1', 'B2'], start: '08:15', end: '10:00', room: '101' },
    { day: 'Utorak', subject: 'Numerička analiza', type: 'Vežbe', type_short: 'V', groups: ['B1'], start: '10:15', end: '12:00', room: '102' },
    { day: 'Sreda', subject: 'Finansije', type: 'Predavanje', type_short: 'P', groups: ['B9'], start: '08:15', end: '10:00', room: '201' },
  ],
} as unknown as SemesterData

describe('findGroup — opsezi prezimena', () => {
  it('bira grupu po opsegu (leva/desna ivica)', () => {
    expect(findGroup(DATA, 'Anić', 'Informacioni sistemi')).toBe('B1')
    expect(findGroup(DATA, 'Petrović', 'Informacioni sistemi')).toBe('B2')
  })

  it('koristi SRPSKI (ćirilični) redosled, ne latinični', () => {
    // Ž je u ćiriličnom redosledu rano (ж=08), pa "Žarić" pada u prvi opseg
    // A- - Lekić, a ne u poslednji. Ovo štiti izbor kolacije od regresije.
    expect(findGroup(DATA, 'Žarić', 'Informacioni sistemi')).toBe('B1')
  })

  it('granica opsega je inkluzivna', () => {
    expect(findGroup(DATA, 'Lekić', 'Informacioni sistemi')).toBe('B1')
    expect(findGroup(DATA, 'Leković', 'Informacioni sistemi')).toBe('B2')
  })

  it('c -> ć fallback: "Lekic" (između granica) se razreši kao "Lekić" -> B1', () => {
    // "Lekic" sirovo pada između Lekić i Leković -> nijedan opseg; fallback
    // zameni c->ć pa "Lekić" tačno pogodi gornju granicu B1.
    expect(findGroup(DATA, 'Lekic', 'Informacioni sistemi')).toBe('B1')
  })

  it('program "Svi" opseg uvek pogađa', () => {
    expect(findGroup(DATA, 'BiloKo', 'Finansijski menadžment')).toBe('B9')
  })

  it('bez programa pretražuje sve grupe', () => {
    expect(findGroup(DATA, 'Anić', null)).toBe('B1')
  })

  it('nepostojeći program -> null', () => {
    expect(findGroup(DATA, 'Anić', 'Ne postoji')).toBeNull()
  })
})

describe('getScheduleForGroup', () => {
  it('vraća samo unose te grupe', () => {
    const b1 = getScheduleForGroup(DATA, 'B1')
    expect(b1.map(e => e.subject).sort()).toEqual(['Baze podataka', 'Numerička analiza'])
    const b9 = getScheduleForGroup(DATA, 'B9')
    expect(b9.map(e => e.subject)).toEqual(['Finansije'])
  })
})

describe('getProgramsForYear', () => {
  it('vraća jedinstvene programe, sortirane', () => {
    expect(getProgramsForYear(DATA)).toEqual(['Finansijski menadžment', 'Informacioni sistemi'])
  })
})

describe('uniqueSubjectsForGroup', () => {
  it('vraća sortiranu listu jedinstvenih predmeta grupe', () => {
    expect(uniqueSubjectsForGroup(DATA, 'B1')).toEqual(['Baze podataka', 'Numerička analiza'])
    expect(uniqueSubjectsForGroup(DATA, 'B9')).toEqual(['Finansije'])
  })
})

describe('getElectivesForGroup', () => {
  it('predmet koji nije u svim grupama programa = izborni', () => {
    // Numerička analiza je samo u B1 (ne u B2) unutar "Informacioni sistemi".
    expect(getElectivesForGroup(DATA, 'B1')).toEqual(['Numerička analiza'])
  })

  it('zajednički predmet nije izborni', () => {
    // Baze podataka su u B1 i B2 -> nisu izborni.
    expect(getElectivesForGroup(DATA, 'B1')).not.toContain('Baze podataka')
  })
})
