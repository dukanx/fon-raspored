import { describe, it, expect } from 'vitest'
import { otisak, promene, opisPromene, izmenjeneGrupe, odlukaOIzmeni } from './izmene'
import type { DayOfWeek, ScheduleEntry, SemesterData } from './types'

const T = (subject: string, type_short: 'P' | 'V', day: DayOfWeek, start: string, room: string): ScheduleEntry => ({
  subject, type_short, day, start, room, end: '', groups: ['A1'],
  type: type_short === 'P' ? 'Predavanje' : 'Vežbe',
})
const svi = () => true

describe('promene', () => {
  const stari = otisak([
    T('Matematika 1', 'P', 'Ponedeljak', '08:15', 'Amfiteatar 3'),
    T('Matematika 1', 'V', 'Utorak', '10:15', '13'),
    T('Ekonomija', 'P', 'Sreda', '12:15', 'Amfiteatar 1'),
  ])

  it('isti raspored nema promena', () => {
    expect(promene(stari, stari, svi)).toEqual([])
  })

  it('promenjena sala', () => {
    const novi = otisak([
      T('Matematika 1', 'P', 'Ponedeljak', '08:15', 'Amfiteatar 1'),
      T('Matematika 1', 'V', 'Utorak', '10:15', '13'),
      T('Ekonomija', 'P', 'Sreda', '12:15', 'Amfiteatar 1'),
    ])
    const p = promene(stari, novi, svi)
    expect(p.map(opisPromene)).toEqual(['Matematika 1 (P): Pon 08:15, Amfiteatar 3 → Pon 08:15, Amfiteatar 1'])
  })

  it('pomereno vreme, i samo za predmete koje student prati', () => {
    const novi = otisak([
      T('Matematika 1', 'P', 'Ponedeljak', '08:15', 'Amfiteatar 3'),
      T('Matematika 1', 'V', 'Utorak', '14:15', '13'),
      T('Ekonomija', 'P', 'Četvrtak', '12:15', 'Amfiteatar 1'),
    ])
    expect(promene(stari, novi, s => s === 'Matematika 1').map(opisPromene))
      .toEqual(['Matematika 1 (V): Uto 10:15, 13 → Uto 14:15, 13'])
  })

  it('ista vežba u više sala je jedan termin', () => {
    const a = otisak([T('Baze', 'V', 'Petak', '10:15', '06'), T('Baze', 'V', 'Petak', '10:15', '07')])
    const b = otisak([T('Baze', 'V', 'Petak', '10:15', '07'), T('Baze', 'V', 'Petak', '10:15', '06')])
    expect(promene(a, b, svi)).toEqual([])
    const c = otisak([T('Baze', 'V', 'Petak', '10:15', '06')])
    expect(promene(a, c, svi).map(opisPromene)).toEqual(['Baze (V): Pet 10:15, 06, 07 → Pet 10:15, 06'])
  })

  it('nov predmet se preskače (za njega postoji popup), nestao se prijavljuje', () => {
    const novi = otisak([
      T('Matematika 1', 'P', 'Ponedeljak', '08:15', 'Amfiteatar 3'),
      T('Matematika 1', 'V', 'Utorak', '10:15', '13'),
      T('Finansijsko izveštavanje', 'P', 'Utorak', '10:15', '12'),
    ])
    expect(promene(stari, novi, svi).map(opisPromene))
      .toEqual(['Ekonomija (P): više nije u rasporedu (Sre 12:15, Amfiteatar 1)'])
  })
})

describe('izmenjeneGrupe', () => {
  const sa = (entries: ScheduleEntry[]): SemesterData => ({ semester: 'Zimski 2026/27', year: 3, groups: {}, entries })
  const grupe = (e: ScheduleEntry, ...groups: string[]) => ({ ...e, groups })
  const mat = T('Matematika 1', 'P', 'Ponedeljak', '08:15', 'Amfiteatar 3')
  const eko = T('Ekonomija', 'P', 'Sreda', '12:15', 'Amfiteatar 1')
  const stari = sa([grupe(mat, 'A1', 'A2'), grupe(eko, 'A3')])

  it('bez promena nema grupa', () => {
    expect(izmenjeneGrupe(stari, stari)).toEqual([])
  })

  it('promenjena sala pogađa samo grupe tog termina', () => {
    const novi = sa([grupe({ ...mat, room: 'Amfiteatar 1' }, 'A1', 'A2'), grupe(eko, 'A3')])
    expect(izmenjeneGrupe(stari, novi)).toEqual(['A1', 'A2'])
  })

  it('termin prebačen drugoj grupi menja obe', () => {
    const novi = sa([grupe(mat, 'A1'), grupe(eko, 'A3'), grupe(mat, 'A3')])
    expect(izmenjeneGrupe(stari, novi)).toEqual(['A2', 'A3'])
  })

  it('isti termini drugim redom nisu promena', () => {
    expect(izmenjeneGrupe(stari, sa([...stari.entries].reverse()))).toEqual([])
  })
})

describe('odlukaOIzmeni', () => {
  const ZIMSKI = 'Zimski 2026/27'
  const mat = T('Matematika 1', 'P', 'Ponedeljak', '08:15', 'Amfiteatar 3')
  const eko = T('Ekonomija', 'P', 'Sreda', '12:15', 'Amfiteatar 1')
  const videno = { semester: ZIMSKI, otisak: otisak([mat, eko]) }
  const sviPredmeti = () => true
  const samoMatematika = (p: string) => p === 'Matematika 1'

  it('nov korisnik (ništa zapamćeno): samo zapamti, bez banera', () => {
    expect(odlukaOIzmeni(null, videno, sviPredmeti)).toEqual({ tip: 'zapamti' })
  })

  it('nov semestar: samo zapamti, bez banera', () => {
    const letnji = { semester: 'Letnji 2026/27', otisak: otisak([eko]) }
    expect(odlukaOIzmeni(videno, letnji, sviPredmeti)).toEqual({ tip: 'zapamti' })
  })

  it('isti raspored: ništa', () => {
    expect(odlukaOIzmeni(videno, { ...videno }, sviPredmeti)).toEqual({ tip: 'nista' })
  })

  it('izmena u predmetu koji prati: baner sa tačnom promenom', () => {
    const sada = { semester: ZIMSKI, otisak: otisak([{ ...mat, room: 'Amfiteatar 1' }, eko]) }
    const odluka = odlukaOIzmeni(videno, sada, samoMatematika)
    expect(odluka.tip).toBe('baner')
    if (odluka.tip === 'baner') expect(odluka.promene.map(p => p.predmet)).toEqual(['Matematika 1'])
  })

  it('izmena samo u predmetu koji ne prati: zapamti tiho', () => {
    const sada = { semester: ZIMSKI, otisak: otisak([mat, { ...eko, start: '14:15' }]) }
    expect(odlukaOIzmeni(videno, sada, samoMatematika)).toEqual({ tip: 'zapamti' })
  })
})
