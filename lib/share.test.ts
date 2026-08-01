import { describe, it, expect } from 'vitest'
import { encodeShare, decodeShare, type SharePayload } from './share'

const SAMPLE: SharePayload = { v: 1, y: 3, g: 'C1', n: 8, s: [0, 2, 5, 7] }

describe('encode/decode round-trip', () => {
  it('vraća isti payload', () => {
    expect(decodeShare(encodeShare(SAMPLE))).toEqual(SAMPLE)
  })

  it('prazan izbor (s: []) radi', () => {
    const p: SharePayload = { v: 1, y: 1, g: 'A1', n: 6, s: [] }
    expect(decodeShare(encodeShare(p))).toEqual(p)
  })

  it('proizvod je URL-safe (bez +, /, =)', () => {
    const enc = encodeShare({ v: 1, y: 4, g: 'D11', n: 17, s: [1, 3, 5, 9, 11, 13, 16] })
    expect(enc).not.toMatch(/[+/=]/)
  })

  it('opciono x/p/o (preneseni/prethodne godine/drugi semestar) prolaze round-trip', () => {
    const p: SharePayload = {
      v: 1, y: 3, g: 'C1', n: 8, s: [0],
      x: [{ day: 'Ponedeljak', subject: 'Matematika 2', type: 'Predavanje', type_short: 'P', groups: ['C1'], start: '08:15', end: '10:00', room: '308' }],
      p: [{ year: 2, subject: 'Baze podataka' }],
      o: ['Ekonomika poslovanja i planiranje'],
    }
    expect(decodeShare(encodeShare(p))).toEqual(p)
  })

  it('bez x/p/o (samo tekući predmeti) ostaju odsutni posle round-trip-a', () => {
    const p: SharePayload = { v: 1, y: 1, g: 'A1', n: 6, s: [0, 1] }
    const decoded = decodeShare(encodeShare(p))
    expect(decoded).toEqual(p)
    expect(decoded?.x).toBeUndefined()
    expect(decoded?.p).toBeUndefined()
    expect(decoded?.o).toBeUndefined()
  })

  it('nazivi predmeta sa č/ć/š/đ/ž (van Latin1) ne bacaju grešku', () => {
    const p: SharePayload = {
      v: 1, y: 2, g: 'C1', n: 5, s: [0],
      x: [{ day: 'Sreda', subject: 'Računarske mreže i komunikacije', type: 'Vežbe', type_short: 'V', groups: ['C1'], start: '14:15', end: '16:00', room: '308' }],
      o: ['Elektronsko poslovanje i lanci snabdevanja'],
    }
    expect(decodeShare(encodeShare(p))).toEqual(p)
  })
})

describe('decodeShare — odbacivanje smeća', () => {
  it('malformiran base64/JSON -> null', () => {
    expect(decodeShare('nije-base64-!!!')).toBeNull()
    expect(decodeShare('')).toBeNull()
  })

  it('pogrešna/nepoznata verzija -> null', () => {
    const bad = btoa(JSON.stringify({ v: 2, y: 3, g: 'C1', n: 8, s: [0] }))
    expect(decodeShare(bad)).toBeNull()
  })

  it('nedostaju/pogrešni tipovi -> null', () => {
    const enc = (o: unknown) => btoa(JSON.stringify(o))
    expect(decodeShare(enc({ v: 1, y: '3', g: 'C1', n: 8, s: [0] }))).toBeNull()
    expect(decodeShare(enc({ v: 1, y: 3, g: '', n: 8, s: [0] }))).toBeNull()
    expect(decodeShare(enc({ v: 1, y: 3, g: 'C1', n: 8, s: [0, 'x'] }))).toBeNull()
    expect(decodeShare(enc({ v: 1, y: 3, g: 'C1', n: 8, s: [-1] }))).toBeNull()
    expect(decodeShare(enc({ v: 1, y: 3, g: 'C1', n: -1, s: [] }))).toBeNull()
  })
})
