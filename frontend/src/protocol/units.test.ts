import { describe, expect, it } from 'vitest'
import { formatUsdc, parseUsdc, requiresTypedConfirm, sameDecimals, splitFee, splitPayout } from './units'

describe('units', () => {
  it('parses and formats 6-decimal USDC', () => {
    expect(parseUsdc('25')).toBe(25_000_000n)
    expect(parseUsdc('0.01')).toBe(10_000n)
    expect(formatUsdc(12_500_000n)).toBe('12.50')
    expect(formatUsdc(1_000_000_000n)).toBe('1,000.00')
    expect(formatUsdc(1n)).toBe('0.000001')
  })
  it('rejects bad input and over-precision', () => {
    for (const bad of ['', 'abc', '1.0000001', '-1', '1e3']) expect(() => parseUsdc(bad)).toThrow()
  })
  it('matches kernel fee rounding', () => {
    expect(splitFee(10_000n, 100)).toEqual({ fee: 100n, net: 9_900n })
    expect(splitFee(99n, 100).fee).toBe(0n)
    const p = splitPayout(1_000_000n, 5_000, 100)
    expect(p).toEqual({ toProvider: 495_000n, fee: 5_000n, refund: 500_000n })
  })
  it('typed confirm threshold and decimal guard', () => {
    expect(requiresTypedConfirm(99_999_999n)).toBe(false)
    expect(requiresTypedConfirm(100_000_000n)).toBe(true)
    expect(() => sameDecimals(6, 18)).toThrow()
  })
})
