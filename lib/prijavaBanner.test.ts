import { describe, it, expect } from 'vitest'
import { pickPrijavaPovod, srDatumUISO, isoMinusDana } from './prijavaBanner'

// Prijava traje 25.06 - 28.06.2026.
const PRIJAVA = ['25.06.2026.', '28.06.2026.']

function povod(todayStr: string, jeNov = false) {
  return pickPrijavaPovod({ prijavaDatumi: PRIJAVA, todayStr, jeNov })
}

describe('srDatumUISO', () => {
  it('pretvara srpski datum sa tačkom na kraju', () => {
    expect(srDatumUISO('25.06.2026.')).toBe('2026-06-25')
  })

  it('dopunjava vodeću nulu', () => {
    expect(srDatumUISO('4.9.2026.')).toBe('2026-09-04')
  })

  it('vraća null za smeće', () => {
    expect(srDatumUISO('')).toBeNull()
    expect(srDatumUISO('nema datuma')).toBeNull()
  })
})

describe('isoMinusDana', () => {
  it('prelazi preko granice meseca', () => {
    expect(isoMinusDana('2026-07-01', 2)).toBe('2026-06-29')
  })

  it('prelazi preko granice godine', () => {
    expect(isoMinusDana('2026-01-01', 1)).toBe('2025-12-31')
  })
})

describe('pickPrijavaPovod - baner se javlja samo na ključne dane', () => {
  it('ćuti dok je prijava daleko', () => {
    expect(povod('2026-06-10')).toBeNull()
    expect(povod('2026-06-22')).toBeNull()
  })

  it('javi se dva dana pre početka', () => {
    expect(povod('2026-06-23')).toBe('uskoro')
  })

  it('ćuti dan pre početka (samo jedna najava)', () => {
    expect(povod('2026-06-24')).toBeNull()
  })

  it('javi se na dan početka prijave', () => {
    expect(povod('2026-06-25')).toBe('pocinje')
  })

  it('ćuti usred trajanja prijave', () => {
    expect(povod('2026-06-26')).toBeNull()
    expect(povod('2026-06-27')).toBeNull()
  })

  it('javi se poslednjeg dana prijave', () => {
    expect(povod('2026-06-28')).toBe('poslednji')
  })

  it('nestaje kad prijava prođe', () => {
    expect(povod('2026-06-29')).toBeNull()
    expect(povod('2026-09-01')).toBeNull()
  })
})

describe('pickPrijavaPovod - nov rok', () => {
  it('nov rok se javi i kad nije nijedan datum prijave', () => {
    expect(povod('2026-06-10', true)).toBe('novo')
  })

  it('nov rok ne oživljava baner posle isteka prijave', () => {
    expect(povod('2026-06-29', true)).toBeNull()
  })

  it('"novo" ima prednost nad poklapanjem sa datumom prijave', () => {
    expect(povod('2026-06-25', true)).toBe('novo')
  })
})

describe('pickPrijavaPovod - ivični slučajevi', () => {
  it('bez datuma prijave nema banera', () => {
    expect(pickPrijavaPovod({ prijavaDatumi: undefined, todayStr: '2026-06-25', jeNov: true })).toBeNull()
    expect(pickPrijavaPovod({ prijavaDatumi: [], todayStr: '2026-06-25', jeNov: true })).toBeNull()
  })

  it('jedan datum znači i početak i kraj', () => {
    const jedan = ['25.06.2026.']
    expect(pickPrijavaPovod({ prijavaDatumi: jedan, todayStr: '2026-06-25', jeNov: false })).toBe('pocinje')
    expect(pickPrijavaPovod({ prijavaDatumi: jedan, todayStr: '2026-06-26', jeNov: false })).toBeNull()
  })

  it('poštuje podešen broj dana najave', () => {
    expect(pickPrijavaPovod({ prijavaDatumi: PRIJAVA, todayStr: '2026-06-20', jeNov: false, najavaDana: 5 })).toBe('uskoro')
  })
})
