import { describe, it, expect } from 'vitest'
import { najboljiPar, cinjenice, razlogPoSablonu } from './predlog'
import type { DayOfWeek, ScheduleEntry } from './types'

const T = (day: DayOfWeek, start: string, subject: string, type_short: 'P' | 'V' = 'P'): ScheduleEntry => ({
  day, start, end: '', subject, type_short,
  type: type_short === 'P' ? 'Predavanje' : 'Vežbe', groups: [], room: '1',
})

describe('najboljiPar', () => {
  const raspored = [T('Ponedeljak', '10:15', 'Matematika'), T('Utorak', '12:15', 'Ekonomija', 'V')]

  it('slobodan termin pre termina koji gazi postojeći', () => {
    const p = [T('Ponedeljak', '10:15', 'X'), T('Ponedeljak', '12:15', 'X')]
    expect(najboljiPar(raspored, p, []).p).toBe(p[1])
  })

  it('kad mora da gazi, bolje predavanje nego vežbe', () => {
    const p = [T('Utorak', '12:15', 'X'), T('Ponedeljak', '10:15', 'X')]
    expect(najboljiPar(raspored, p, []).p).toBe(p[1]) // gazi Matematiku [P], ne Ekonomiju [V]
  })

  it('bez pauze pre termina sa pauzom', () => {
    const p = [T('Ponedeljak', '14:15', 'X'), T('Ponedeljak', '12:15', 'X')]
    expect(najboljiPar(raspored, p, []).p).toBe(p[1])
  })

  it('jedna pauza je bolja od novog dana', () => {
    const p = [T('Sreda', '10:15', 'X'), T('Ponedeljak', '14:15', 'X')] // pon: 10:15, prazno 12:15, 14:15
    expect(najboljiPar(raspored, p, []).p).toBe(p[1])
  })

  it('dve pauze su gore od novog dana', () => {
    const p = [T('Ponedeljak', '16:15', 'X'), T('Sreda', '10:15', 'X')] // pon: 10:15, prazno 12:15 i 14:15, 16:15
    expect(najboljiPar(raspored, p, []).p).toBe(p[1])
  })

  it('dan koji već ima nastavu pre novog dolaska', () => {
    const p = [T('Sreda', '10:15', 'X'), T('Ponedeljak', '08:15', 'X')]
    expect(najboljiPar(raspored, p, []).p).toBe(p[1])
  })

  it('pri svemu ostalom istom, bolje vreme (10:15 pre 08:15)', () => {
    const p = [T('Sreda', '08:15', 'X'), T('Sreda', '10:15', 'X')]
    expect(najboljiPar([], p, []).p).toBe(p[1])
  })

  it('predavanje i vežbe nikad u istom terminu', () => {
    const p = [T('Ponedeljak', '12:15', 'X')]
    const v = [T('Ponedeljak', '12:15', 'X', 'V'), T('Utorak', '14:15', 'X', 'V')]
    const par = najboljiPar(raspored, p, v)
    expect(par.p).toBe(p[0])
    expect(par.v).toBe(v[1])
  })

  it('postojeći termin istog predmeta se ne računa kao zauzet (zamenjuje se)', () => {
    const r = [...raspored, T('Sreda', '10:15', 'X')]
    const p = [T('Sreda', '10:15', 'X'), T('Četvrtak', '18:15', 'X')]
    expect(najboljiPar(r, p, []).p).toBe(p[0])
  })

  it('prazna lista daje null za taj tip', () => {
    expect(najboljiPar(raspored, [], [T('Petak', '10:15', 'X', 'V')]).p).toBeNull()
  })
})

describe('cinjenice i razlog', () => {
  const raspored = [T('Ponedeljak', '10:15', 'Matematika'), T('Ponedeljak', '14:15', 'Ekonomija')]

  it('vidi nastavu pre i posle i šta gazi', () => {
    const c = cinjenice(T('Ponedeljak', '12:15', 'X'), raspored)
    expect(c.pre?.subject).toBe('Matematika')
    expect(c.posle?.subject).toBe('Ekonomija')
    expect(c.menja).toBeNull()
    expect(cinjenice(T('Ponedeljak', '10:15', 'X'), raspored).menja?.subject).toBe('Matematika')
  })

  it('razlog po šablonu', () => {
    expect(razlogPoSablonu(raspored, { p: T('Ponedeljak', '12:15', 'X'), v: T('Utorak', '10:15', 'X', 'V') })).toBe(
      'Predavanje u ponedeljak 12:15: slobodno, između predmeta „Matematika“ i „Ekonomija“. ' +
      'Vežbe u utorak 10:15: slobodno, jedini čas tog dana.'
    )
  })
})
