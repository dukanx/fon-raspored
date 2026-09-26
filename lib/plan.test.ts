import { describe, it, expect } from 'vitest'
import { planStatus, semesterKey, hasUnpublishedElectives, type StudyPlan } from './plan'

// Isečak pravog plana (zimski 2026/27).
const PLAN: StudyPlan = {
  'Operacioni menadžment': {
    program: 'MiO',
    godine: {
      '4': {
        zimski: {
          obavezni: ['Modelovanje poslovnih procesa', 'Tehnološko preduzetništvo'],
          izborni: ['Korporativne komunikacije', 'Teorija odlučivanja'],
        },
      },
    },
  },
  'Softversko inženjerstvo': {
    program: 'ISiT',
    godine: {
      '1': { zimski: { obavezni: ['Elektronsko poslovanje', 'Matematika 1'], izborni: ['Menadžment'] } },
      '3': { letnji: { obavezni: ['Napredne Java tehnologije'], izborni: ['Multimediji'] } },
    },
  },
  'Informacione tehnologije': {
    program: 'ISiT',
    godine: {
      '1': { zimski: { obavezni: ['Elektronsko poslovanje', 'Matematika 1'], izborni: ['Menadžment'] } },
      '3': { letnji: { obavezni: ['Multimediji'], izborni: [] } },
    },
  },
}

describe('planStatus', () => {
  it('modul: obavezan i izborni blok', () => {
    expect(planStatus(PLAN, 'Operacioni menadžment', 4, 'zimski', 'Tehnološko preduzetništvo')).toBe('obavezan')
    expect(planStatus(PLAN, 'Operacioni menadžment', 4, 'zimski', 'Teorija odlučivanja')).toBe('izborni')
  })

  it('"(NA)" i velika slova ne smetaju', () => {
    expect(planStatus(PLAN, 'Softversko inženjerstvo', 1, 'zimski', 'Elektronsko poslovanje (NA)')).toBe('obavezan')
  })

  it('program bez modula: obavezno samo ako je obavezno na svakom modulu', () => {
    expect(planStatus(PLAN, 'ISiT', 1, 'zimski', 'Matematika 1')).toBe('obavezan')
    expect(planStatus(PLAN, 'ISiT', 1, 'zimski', 'Menadžment')).toBe('izborni')
    // Obavezan na IT, izborni na SI -> za "ISiT" je izborni.
    expect(planStatus(PLAN, 'ISiT', 3, 'letnji', 'Multimediji')).toBe('izborni')
  })

  it('plan ne zna -> null', () => {
    expect(planStatus(PLAN, 'Operacioni menadžment', 4, 'zimski', 'Nepoznat predmet')).toBeNull()
    expect(planStatus(PLAN, 'Operacioni menadžment', 2, 'zimski', 'Teorija odlučivanja')).toBeNull()
    expect(planStatus(PLAN, 'Nepoznat modul', 4, 'zimski', 'Teorija odlučivanja')).toBeNull()
    expect(planStatus({}, 'ISiT', 1, 'zimski', 'Matematika 1')).toBeNull()
  })
})

describe('semesterKey', () => {
  it('čita semestar iz god.json', () => {
    expect(semesterKey('Zimski 2026/27')).toBe('zimski')
    expect(semesterKey('Letnji 2025/26')).toBe('letnji')
    expect(semesterKey('')).toBeNull()
  })
})

describe('hasUnpublishedElectives', () => {
  const SI: StudyPlan = {
    'Softversko inženjerstvo': {
      program: 'ISiT',
      godine: {
        '4': {
          zimski: {
            obavezni: ['Internet tehnologije'],
            izborni: ['Osnove kvaliteta', 'Menadžment ljudskih resursa', 'Programiranje 3', 'Softverski paterni'],
            blokovi: [['Osnove kvaliteta', 'Menadžment ljudskih resursa'], ['Programiranje 3', 'Softverski paterni']],
          },
        },
      },
    },
  }

  it('blok bez ijednog predmeta u rasporedu -> izborni još nisu objavljeni', () => {
    // Stanje zimskog 2026/27: MiO5 blok je tu, SI 1 nije.
    expect(hasUnpublishedElectives(SI, 'Softversko inženjerstvo', 4, 'zimski', ['Internet tehnologije', 'Osnove kvaliteta'])).toBe(true)
  })

  it('svaki blok ima bar jedan predmet -> sve je objavljeno', () => {
    expect(hasUnpublishedElectives(SI, 'Softversko inženjerstvo', 4, 'zimski', ['Internet tehnologije', 'Osnove kvaliteta', 'Programiranje 3'])).toBe(false)
  })

  it('bez plana ili blokova -> nema upozorenja', () => {
    expect(hasUnpublishedElectives({}, 'Softversko inženjerstvo', 4, 'zimski', [])).toBe(false)
    expect(hasUnpublishedElectives(PLAN, 'Operacioni menadžment', 4, 'zimski', [])).toBe(false)
  })

  it('program bez modula: samo ako blok fali na svakom modulu', () => {
    const two: StudyPlan = {
      A: { program: 'ISiT', godine: { '2': { zimski: { obavezni: [], izborni: ['X'], blokovi: [['X']] } } } },
      B: { program: 'ISiT', godine: { '2': { zimski: { obavezni: [], izborni: ['Y'], blokovi: [['Y']] } } } },
    }
    expect(hasUnpublishedElectives(two, 'ISiT', 2, 'zimski', ['X'])).toBe(false)
    expect(hasUnpublishedElectives(two, 'ISiT', 2, 'zimski', [])).toBe(true)
  })
})
