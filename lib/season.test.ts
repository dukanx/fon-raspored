import { describe, it, expect } from 'vitest'
import { waitingForSchedule, parseSemester, formatSemester, todayLocalIso } from './season'
import type { RokData, RokEntry } from './types'

const entry = (date: string): RokEntry => ({
  subject: 'Matematika 2', date, start: '10:00', end: '11:40', rooms: ['308'], note: '',
})
const rok = (name: string, first: string, last: string): RokData => ({
  rok: name, tip: 'ispit', entries: [entry(first), entry(last)],
})

// Stanje iz rokovi.json krajem septembra 2026.
const JESEN: RokData[] = [
  rok('Septembarski', '2026-08-24', '2026-09-05'),
  rok('Oktobarski', '2026-09-07', '2026-09-19'),
]

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

describe('waitingForSchedule', () => {
  it('oktobarski se završio, a objavljen je letnji -> čekamo zimski (nova školska godina)', () => {
    expect(waitingForSchedule('Letnji 2025/26', JESEN, '2026-09-25')).toEqual({
      label: 'Zimski 2026/27',
      newAcademicYear: true,
    })
  })

  it('dok rok traje ne čeka se', () => {
    expect(waitingForSchedule('Letnji 2025/26', JESEN, '2026-09-19')).toBeNull()
    expect(waitingForSchedule('Letnji 2025/26', JESEN, '2026-09-01')).toBeNull()
  })

  it('kad izađe zimski, ekran nestaje', () => {
    expect(waitingForSchedule('Zimski 2026/27', JESEN, '2026-09-28')).toBeNull()
  })

  it('posle februarskog, a objavljen je zimski -> čekamo letnji (ista školska godina)', () => {
    const zima = [rok('Januarski', '2027-01-18', '2027-01-30'), rok('Februarski', '2027-02-01', '2027-02-13')]
    expect(waitingForSchedule('Zimski 2026/27', zima, '2027-02-20')).toEqual({
      label: 'Letnji 2026/27',
      newAcademicYear: false,
    })
  })

  it('posle junskog nema čekanja (leto)', () => {
    const jun = [rok('Junski', '2027-06-14', '2027-06-26')]
    expect(waitingForSchedule('Letnji 2026/27', jun, '2027-07-05')).toBeNull()
  })

  it('rok objavljen unapred se ne računa kao poslednji', () => {
    const saJanuarskim = [...JESEN, rok('Januarski', '2027-01-18', '2027-01-30')]
    expect(waitingForSchedule('Letnji 2025/26', saJanuarskim, '2026-09-25')?.label).toBe('Zimski 2026/27')
  })

  it('prazan rokovi.json -> ne čeka se', () => {
    expect(waitingForSchedule('Letnji 2025/26', [], '2026-09-25')).toBeNull()
  })

  it('kolokvijumi se ne računaju', () => {
    const kol: RokData[] = [{ ...rok('Kolokvijumi', '2026-09-07', '2026-09-19'), tip: 'kolokvijum' }]
    expect(waitingForSchedule('Letnji 2025/26', kol, '2026-09-25')).toBeNull()
  })

  it('nepoznat format -> null', () => {
    expect(waitingForSchedule('', JESEN, '2026-09-25')).toBeNull()
  })
})

describe('todayLocalIso', () => {
  it('formatira lokalni datum', () => {
    expect(todayLocalIso(new Date(2026, 8, 5, 23, 59))).toBe('2026-09-05')
  })
})
