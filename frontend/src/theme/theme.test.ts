import { describe, expect, it } from 'vitest'
import { msToNextBoundary, resolveAuto } from './theme'

const at = (h: number, m = 0) => new Date(2026, 9, 29, h, m, 0, 0)

describe('auto theme boundaries (local time)', () => {
  it('is light from 06:00 to 17:59 and dark otherwise', () => {
    expect(resolveAuto(at(5, 59))).toBe('dark')
    expect(resolveAuto(at(6))).toBe('light')
    expect(resolveAuto(at(12))).toBe('light')
    expect(resolveAuto(at(17, 59))).toBe('light')
    expect(resolveAuto(at(18))).toBe('dark')
    expect(resolveAuto(at(0))).toBe('dark')
  })
  it('schedules the next flip at the right boundary', () => {
    expect(msToNextBoundary(at(5, 0))).toBe(60 * 60 * 1000)
    expect(msToNextBoundary(at(17, 30))).toBe(30 * 60 * 1000)
    expect(msToNextBoundary(at(23, 0))).toBe(7 * 60 * 60 * 1000)
  })
})
