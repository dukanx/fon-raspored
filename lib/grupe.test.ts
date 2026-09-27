// Granični slučajevi dodele grupe na pravim FON grupama (zimski 2026/27, iz
// golden fixture-a parsera, pa test ne zavisi od trenutnog public/data).
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import type { SemesterData } from './types'
import { resolveGroup, formatRange } from './schedule'

const FIXTURES = path.join(__dirname, '..', 'scripts', 'tests', 'fixtures', 'nastava_docx')
const YEARS = [1, 2, 3, 4]

function load(y: number): SemesterData {
  const g = JSON.parse(fs.readFileSync(path.join(FIXTURES, `${y}god_zimski_2026.expected.json`), 'utf8'))
  return { semester: 'Zimski 2026/27', year: y, ...g } as SemesterData
}

// Kako bi student otkucao prezime bez kvačica.
const strip = (s: string) =>
  s.replace(/[čć]/g, 'c').replace(/[ČĆ]/g, 'C').replace(/š/g, 's').replace(/Š/g, 'S')
    .replace(/ž/g, 'z').replace(/Ž/g, 'Z').replace(/đ/g, 'dj').replace(/Đ/g, 'Dj')

const isMarker = (s: string) => s.endsWith('-')

describe('granice grupa na pravim FON podacima', () => {
  for (const y of YEARS) {
    const data = load(y)
    const groups = Object.entries(data.groups).filter(([, g]) => g.range !== 'Svi')

    it(`${y}. godina: svaka granica iz tabele daje svoju grupu`, () => {
      for (const [gid, g] of groups) {
        for (const bound of g.range.split(' - ').filter(b => !isMarker(b))) {
          const m = resolveGroup(data, bound, g.program)
          // Prezime bez ijedne kvačice ("Mesarek") može biti i "Mešarek", pa je
          // izbor ispravan ishod, dok god je tačna grupa ponuđena baš uz to pisanje.
          if (m.status === 'ok') expect(m, `${bound} (${g.program})`).toEqual({ status: 'ok', group: gid, lastName: bound })
          else expect(m.status === 'ambiguous' && m.options.some(o => o.group === gid && o.lastName === bound), bound).toBe(true)
        }
      }
    })

    it(`${y}. godina: granica otkucana bez kvačica nikad ne daje tuđu grupu`, () => {
      for (const [gid, g] of groups) {
        for (const bound of g.range.split(' - ').filter(b => !isMarker(b))) {
          const m = resolveGroup(data, strip(bound), g.program)
          if (m.status === 'ok') expect(m.group, `${strip(bound)} (${g.program})`).toBe(gid)
          else expect(m.status === 'ambiguous' && m.options.some(o => o.group === gid), strip(bound)).toBe(true)
        }
      }
    })

    it(`${y}. godina: oznaka slova obuhvata prvo i poslednje prezime na to slovo`, () => {
      for (const [gid, g] of groups) {
        const [from, to] = g.range.split(' - ')
        // "od X-": najmanje moguće prezime na X; "do X-": najveće (posle X
        // dolazi samo Š, poslednje slovo azbuke).
        const offers = (name: string) => {
          const m = resolveGroup(data, name, g.program)
          return m.status === 'ok' ? m.group === gid : m.status === 'ambiguous' && m.options.some(o => o.group === gid)
        }
        if (isMarker(from)) expect(offers(from.slice(0, -1) + 'a'), `${from} ${gid}`).toBe(true)
        if (isMarker(to)) expect(offers(to.slice(0, -1) + 'šššš'), `${to} ${gid}`).toBe(true)
      }
    })
  }
})

describe('prezime bez kvačica, ćirilica, prikaz', () => {
  const treca = load(3)
  const prva = load(1)

  it('"Sasic" može biti Sasić (C6) ili Šašić (C7): nudi izbor, ne pogađa', () => {
    const m = resolveGroup(treca, 'Sasic', 'Softversko inženjerstvo')
    expect(m.status).toBe('ambiguous')
    if (m.status === 'ambiguous') {
      expect(m.options.map(o => o.group)).toEqual(['C6', 'C7'])
      expect(m.options.find(o => o.group === 'C7')?.lastName).toMatch(/^Š/)
    }
  })

  it('"Saric" u 1. godini: A9 ili A10', () => {
    const m = resolveGroup(prva, 'Saric', 'ISiT')
    expect(m.status === 'ambiguous' && m.options.map(o => o.group)).toEqual(['A9', 'A10'])
  })

  it('bez kvačica, a grupa je ista u svim pisanjima: odmah grupa', () => {
    expect(resolveGroup(treca, 'Zivkovic', 'ISiT')).toMatchObject({ status: 'ok', group: 'C2' })
  })

  it('otkucano sa kvačicama se uzima tačno kako piše', () => {
    expect(resolveGroup(treca, 'Šašić', 'ISiT')).toMatchObject({ status: 'ok', group: 'C7', lastName: 'Šašić' })
  })

  it('ćirilica se prevodi u latinicu', () => {
    expect(resolveGroup(treca, 'Петровић', 'ISiT')).toMatchObject({ status: 'ok', group: 'C5', lastName: 'Petrović' })
  })

  it('preklapanje FON opsega (D2 "A- - N-", D3 "M- - Š-"): nudi obe grupe', () => {
    const m = resolveGroup(load(4), 'Nikolić', 'Informacione tehnologije')
    expect(m.status === 'ambiguous' && m.options.map(o => o.group)).toEqual(['D2', 'D3'])
    expect(resolveGroup(load(4), 'Anić', 'Informacione tehnologije')).toMatchObject({ status: 'ok', group: 'D2' })
  })

  it('nepoznato -> none', () => {
    expect(resolveGroup(treca, '   ', 'ISiT')).toEqual({ status: 'none' })
  })

  it('opseg za prikaz bez crte posle slova', () => {
    expect(formatRange('Mihajlica - P-')).toBe('Mihajlica - P')
    expect(formatRange('A- - Vukas')).toBe('A - Vukas')
    expect(formatRange('Stefanović - Š-')).toBe('Stefanović - Š')
    expect(formatRange('Svi')).toBe('svi')
  })
})
