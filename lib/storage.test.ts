import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { session, saved, app, byGroup, note, resetSubjectsForNewSemester } from './storage'

// In-memory Storage mock (node env nema DOM). Guard u storage.ts gleda `window`.
class MemStorage {
  private m = new Map<string, string>()
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
  removeItem(k: string) { this.m.delete(k) }
  clear() { this.m.clear() }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  get length() { return this.m.size }
}

// Postavi/ukloni globalni `window` bez sudaranja sa DOM `Window` tipom.
function setWindow(v: { localStorage: Storage; sessionStorage: Storage } | undefined) {
  ;(globalThis as Record<string, unknown>).window = v
}

beforeEach(() => {
  setWindow({
    localStorage: new MemStorage() as unknown as Storage,
    sessionStorage: new MemStorage() as unknown as Storage,
  })
})

afterEach(() => {
  setWindow(undefined)
})

describe('str accessor (session)', () => {
  it('get/set/remove', () => {
    expect(session.group.get()).toBeNull()
    session.group.set('C1')
    expect(session.group.get()).toBe('C1')
    session.group.remove()
    expect(session.group.get()).toBeNull()
  })

  it('local i session su odvojeni', () => {
    session.group.set('C1')
    expect(saved.group.get()).toBeNull() // saved je localStorage
  })
})

describe('flag accessor (dismissedPrijava)', () => {
  it('true tek kad je postavljen', () => {
    const feb = session.dismissedPrijava('Februarski')
    expect(feb.get()).toBe(false)
    feb.set()
    expect(feb.get()).toBe(true)
    expect(session.dismissedPrijava('Junski').get()).toBe(false) // različit rok
  })
})

describe('json accessor', () => {
  it('vraća fallback kad ključ ne postoji', () => {
    expect(app.subjectsHistory.get()).toEqual({})
    expect(byGroup.extra('C1').get()).toEqual([])
  })

  it('roundtrip strukturisane vrednosti', () => {
    byGroup.subjects('C1').set({ Matematika: true, Fizika: false })
    expect(byGroup.subjects('C1').get()).toEqual({ Matematika: true, Fizika: false })
  })

  it('pokvaren JSON -> fallback (ne baca)', () => {
    globalThis.window!.localStorage.setItem('fon_subjects_C1', '{ ne-json')
    expect(byGroup.subjects('C1').get()).toEqual({})
  })
})

describe('byGroup izolacija po grupi', () => {
  it('različite grupe ne kolidiraju', () => {
    byGroup.subjects('C1').set({ A: true })
    byGroup.subjects('C2').set({ B: false })
    expect(byGroup.subjects('C1').get()).toEqual({ A: true })
    expect(byGroup.subjects('C2').get()).toEqual({ B: false })
  })
})

describe('resetSubjectsForNewSemester', () => {
  it('briše subjects + other_sem grupe, ostavlja saved i note', () => {
    byGroup.subjects('C1').set({ A: true })
    byGroup.otherSem('C1').set(['X'])
    saved.group.set('C1')
    note('Matematika').set('beleška')

    resetSubjectsForNewSemester('C1')

    expect(byGroup.subjects('C1').get()).toEqual({})
    expect(byGroup.otherSem('C1').get()).toEqual([])
    expect(saved.group.get()).toBe('C1')          // kredencijali ostaju
    expect(note('Matematika').get()).toBe('beleška') // beleška ostaje
  })
})

describe('SSR-safe (window undefined)', () => {
  it('get vraća fallback, set je no-op bez bacanja', () => {
    setWindow(undefined)
    expect(session.group.get()).toBeNull()
    expect(byGroup.extra('C1').get()).toEqual([])
    expect(() => byGroup.subjects('C1').set({ A: true })).not.toThrow()
  })
})
