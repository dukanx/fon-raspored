import { describe, it, expect } from 'vitest'
import { pomeri, primeniPomerene, vazeciPomereni, nepomereni, novTermin } from './pomereniTermini'
import type { DayOfWeek, ScheduleEntry } from './types'

const T = (subject: string, type_short: 'P' | 'V', day: DayOfWeek, start: string, room: string): ScheduleEntry => ({
  subject, type_short, day, start, room, end: '', groups: ['C10'],
  type: type_short === 'P' ? 'Predavanje' : 'Vežbe',
})

const vezbe = T('Matematika 1', 'V', 'Utorak', '10:15', '13')
const predavanje = T('Matematika 1', 'P', 'Ponedeljak', '08:15', 'Amfiteatar 1')
const novo = { day: 'Sreda' as const, start: '14:15', end: '16:00', room: '305' }

describe('pomeri', () => {
  it('FON-ov termin dobija novo vreme i salu', () => {
    const p = pomeri([], vezbe, novo)
    expect(p).toEqual([{ od: vezbe, ...novo }])
    expect(primeniPomerene([predavanje, vezbe], p)).toEqual([predavanje, { ...vezbe, ...novo }])
  })

  it('već pomeren termin se pomera dalje, a pamti se FON-ov', () => {
    const prvo = pomeri([], vezbe, novo)
    const drugo = pomeri(prvo, novTermin(prvo[0]), { ...novo, room: '306' })
    expect(drugo).toEqual([{ od: vezbe, ...novo, room: '306' }])
  })

  it('vraćanje na FON-ov termin briše pomeranje', () => {
    const prvo = pomeri([], vezbe, novo)
    expect(pomeri(prvo, novTermin(prvo[0]), { day: 'Utorak', start: '10:15', end: '12:00', room: '13' })).toEqual([])
  })
})

describe('nepomereni', () => {
  it('pomeren dodat termin više ne zauzima svoj blok', () => {
    const p = pomeri([], vezbe, novo)
    expect(nepomereni([vezbe, predavanje], p)).toEqual([predavanje])
  })
})

describe('vazeciPomereni', () => {
  it('pomeranje ostaje dok FON-ov termin postoji, i kad je predmet odčekiran', () => {
    const p = pomeri([], vezbe, novo)
    expect(vazeciPomereni(p, [predavanje, vezbe])).toEqual(p)
  })

  it('kad FON pomeri termin, ručno pomeranje se briše', () => {
    const p = pomeri([], vezbe, novo)
    expect(vazeciPomereni(p, [predavanje, T('Matematika 1', 'V', 'Četvrtak', '12:15', '13')])).toEqual([])
  })

  it('FON-ova promena samo sale ne briše pomeranje', () => {
    const p = pomeri([], vezbe, novo)
    expect(vazeciPomereni(p, [{ ...vezbe, room: '15' }])).toEqual(p)
  })
})
