import { describe, it, expect } from 'vitest'
import { uskladiDodate } from './dodatiTermini'
import { opisPromene } from './izmene'
import type { DayOfWeek, DodatTermin, ScheduleEntry } from './types'

const T = (subject: string, type_short: 'P' | 'V', day: DayOfWeek, start: string, room: string, groups = ['C10']): ScheduleEntry => ({
  subject, type_short, day, start, room, end: '', groups,
  type: type_short === 'P' ? 'Predavanje' : 'Vežbe',
})
const sa = (t: ScheduleEntry, godina: number): DodatTermin => ({ ...t, godina })

const vezbe = T('Matematika 1', 'V', 'Utorak', '10:15', '13')

describe('uskladiDodate', () => {
  it('nepromenjen termin ostaje, bez upisa', () => {
    const r = uskladiDodate([sa(vezbe, 1)], { 1: [vezbe] })
    expect(r).toEqual({ dodati: [sa(vezbe, 1)], promene: [], izmenjeno: false })
  })

  it('pomeren termin se ažurira i ide u baner', () => {
    const novo = T('Matematika 1', 'V', 'Utorak', '14:15', '15')
    const r = uskladiDodate([sa(vezbe, 1)], { 1: [novo] })
    expect(r.dodati).toEqual([sa(novo, 1)])
    expect(r.izmenjeno).toBe(true)
    expect(r.promene.map(opisPromene)).toEqual(['Matematika 1 (V): Uto 10:15, 13 → Uto 14:15, 15'])
  })

  it('termin kog više nema se uklanja i to piše u baneru', () => {
    const r = uskladiDodate([sa(vezbe, 1)], { 1: [T('Matematika 1', 'V', 'Utorak', '10:15', '13', ['C11'])] })
    expect(r.dodati).toEqual([])
    expect(r.promene.map(opisPromene)).toEqual(['Matematika 1 (V): više nije u rasporedu (Uto 10:15, 13)'])
  })

  it('kad grupa ima dva takva termina, bira se onaj istog dana', () => {
    const uto = T('Matematika 1', 'V', 'Utorak', '16:15', '13')
    const cet = T('Matematika 1', 'V', 'Četvrtak', '10:15', '13')
    expect(uskladiDodate([sa(vezbe, 1)], { 1: [cet, uto] }).dodati).toEqual([sa(uto, 1)])
  })

  it('dva dodata termina istog predmeta ne preuzmu isti novi termin', () => {
    const a = T('Matematika 1', 'V', 'Utorak', '10:15', '13')
    const b = T('Matematika 1', 'V', 'Četvrtak', '10:15', '13')
    const a2 = T('Matematika 1', 'V', 'Utorak', '12:15', '13')
    const r = uskladiDodate([sa(a, 1), sa(b, 1)], { 1: [a2, b] })
    expect(r.dodati).toEqual([sa(a2, 1), sa(b, 1)])
  })

  it('starom zapisu bez godine godina se nađe u podacima', () => {
    const r = uskladiDodate([vezbe], { 1: [vezbe], 2: [] })
    expect(r).toEqual({ dodati: [sa(vezbe, 1)], promene: [], izmenjeno: true })
  })

  it('stari zapis bez godine, a pomeren: godina je ona u kojoj predmet postoji', () => {
    const novo = T('Matematika 1', 'V', 'Petak', '08:15', '13')
    expect(uskladiDodate([vezbe], { 1: [novo], 2: [] }).dodati).toEqual([sa(novo, 1)])
  })

  it('bez podataka te godine (offline) termin ostaje kakav je', () => {
    expect(uskladiDodate([sa(vezbe, 1)], { 2: [] })).toEqual({ dodati: [sa(vezbe, 1)], promene: [], izmenjeno: false })
  })
})
