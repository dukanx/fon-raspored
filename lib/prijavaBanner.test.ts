import { describe, it, expect } from 'vitest'
import { pickPrijavaPovod, srDatumUISO, isoMinusDana } from './prijavaBanner'

// Prijava traje 25.06 - 28.06.2026. "uskoro" (najavaDana=1, podrazumevano) pada
// na 27.06 — dan pred istek (28.06), ne pre početka.
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

  it('ćuti dan pre početka', () => {
    expect(povod('2026-06-24')).toBeNull()
  })

  it('javi se na dan početka prijave', () => {
    expect(povod('2026-06-25')).toBe('pocinje')
  })

  it('ćuti usred trajanja prijave', () => {
    expect(povod('2026-06-26')).toBeNull()
  })

  it('javi se dan pred istek prijave ("sutra")', () => {
    expect(povod('2026-06-27')).toBe('uskoro')
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

  it('poštuje podešen broj dana najave (računa se od kraja)', () => {
    // kraj (28.06) - 5 dana = 23.06
    expect(pickPrijavaPovod({ prijavaDatumi: PRIJAVA, todayStr: '2026-06-23', jeNov: false, najavaDana: 5 })).toBe('uskoro')
  })

  // Konkretno pitanje: dvodnevna prijava — da li mogu DVA povoda da se poklope
  // istog dana i prikažu se oba (novo+počinje, ili počinje+uskoro)? Ne mogu:
  // funkcija uvek vraća najviše jedan, po prioritetu iz SVI_POVODI.
  it('dvodnevna prijava: "dan pred istek" pada na dan početka — pocinje pobeđuje', () => {
    const dvodnevna = ['25.06.2026.', '26.06.2026.']
    // 25.06: i "pocinje" i "uskoro" (26.06 - 1 dan) su tačni za ovaj dan — samo jedan se vraća.
    expect(pickPrijavaPovod({ prijavaDatumi: dvodnevna, todayStr: '2026-06-25', jeNov: false })).toBe('pocinje')
    // 26.06: poslednji dan.
    expect(pickPrijavaPovod({ prijavaDatumi: dvodnevna, todayStr: '2026-06-26', jeNov: false })).toBe('poslednji')
    // Kroz ceo dvodnevni period korisnik vidi TAČNO dve poruke, ne tri.
  })
})
