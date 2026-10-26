// Money math. USDC amounts are integer bigints in 6-decimal units (the ERC-20 view).
// Never mix with native 18-decimal values: the app only reads and moves USDC through
// the ERC-20 interface at 0x3600…0000.

export const USDC_DECIMALS = 6
const UNIT = 10n ** BigInt(USDC_DECIMALS)

/** "12.5" -> 12500000n. Throws on malformed input or more than 6 decimals. */
export function parseUsdc(input: unknown): bigint {
  const s = String(input ?? '').trim()
  if (!/^\d+(\.\d{1,6})?$/.test(s)) throw new Error('Enter an amount with at most 6 decimals, for example 25 or 25.50.')
  const [whole, frac = ''] = s.split('.')
  return BigInt(whole) * UNIT + BigInt(frac.padEnd(USDC_DECIMALS, '0'))
}

/** 12500000n -> "12.50". Keeps up to 6 decimals only when they are non-zero. */
export function formatUsdc(raw: bigint | number | string | null | undefined, { minFrac = 2 }: { minFrac?: number } = {}): string {
  if (raw === undefined || raw === null) return '0.00'
  const v = BigInt(raw)
  const neg = v < 0n
  const abs = neg ? -v : v
  const whole = abs / UNIT
  let frac = (abs % UNIT).toString().padStart(USDC_DECIMALS, '0').replace(/0+$/, '')
  if (frac.length < minFrac) frac = frac.padEnd(minFrac, '0')
  const w = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${neg ? '-' : ''}${w}${frac ? '.' + frac : ''}`
}

/** Same rounding as AgentKernel._splitFee: fee = floor(amount * bps / 10000). */
export function splitFee(amount: bigint | number, bps: number | bigint): { fee: bigint; net: bigint } {
  const a = BigInt(amount)
  const fee = (a * BigInt(bps)) / 10_000n
  return { fee, net: a - fee }
}

/** Provider share for a split, same rounding as the kernel (fee taken from the provider share). */
export function splitPayout(budget: bigint | number, providerBps: number, feeBps: number): { toProvider: bigint; fee: bigint; refund: bigint } {
  const b = BigInt(budget)
  const gross = (b * BigInt(providerBps)) / 10_000n
  const { fee, net } = splitFee(gross, feeBps)
  return { toProvider: net, fee, refund: b - gross }
}

/** Typed-amount confirmation applies at or above this amount (USDC, 6 decimals). */
export const TYPED_CONFIRM_THRESHOLD = 100n * UNIT

export function requiresTypedConfirm(amount: bigint | number): boolean {
  return BigInt(amount) >= TYPED_CONFIRM_THRESHOLD
}

export function sameDecimals(a: number, b: number): void {
  if (a !== b) throw new Error(`Decimal mismatch: ${a} vs ${b}. Refusing to mix native (18) and ERC-20 (6) USDC amounts.`)
}
