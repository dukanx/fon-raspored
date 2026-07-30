import { describe, it, expect } from 'vitest'
import { formatDateSr } from './date'

describe('formatDateSr', () => {
  it('ISO datum -> kratak srpski oblik', () => {
    expect(formatDateSr('2026-06-05')).toBe('5. jun')
    expect(formatDateSr('2026-01-31')).toBe('31. jan')
    expect(formatDateSr('2026-12-01')).toBe('1. dec')
  })
})
