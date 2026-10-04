import { describe, it, expect } from 'vitest'
import { otisak, promene, opisPromene } from './izmene'
import type { DayOfWeek, ScheduleEntry } from './types'

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
