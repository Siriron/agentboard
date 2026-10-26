// Arc drops any transaction whose maxFeePerGas is below the 20 Gwei base-fee floor, with no
// receipt and no error. Always set fee fields explicitly and never below the floor.

export const MIN_MAX_FEE_PER_GAS = 20_000_000_000n // 20 Gwei
const TIP = 1_000_000_000n // 1 Gwei, accepted and helps in busy periods

export async function feeOverrides(publicClient: { getGasPrice: () => Promise<bigint> }): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  let base = MIN_MAX_FEE_PER_GAS
  try {
    const gp = await publicClient.getGasPrice()
    if (gp > base) base = gp
  } catch { /* use the floor */ }
  // Headroom for base-fee movement between estimate and inclusion (EIP-1559 with smoothing).
  const maxFeePerGas = (base * 3n) / 2n > MIN_MAX_FEE_PER_GAS ? (base * 3n) / 2n : MIN_MAX_FEE_PER_GAS
  return { maxFeePerGas, maxPriorityFeePerGas: TIP }
}

/** Estimated fee in USD for display. Native USDC has 18 decimals: wei-style units / 1e18 = USD. */
export function feeUsd(gas: bigint | number, maxFeePerGas: bigint | number): string {
  const wei = BigInt(gas) * BigInt(maxFeePerGas) // 18-decimal USDC
  const micro = wei / 10n ** 12n // to 6 decimals for display only
  const usd = Number(micro) / 1e6
  if (usd === 0) return '< $0.000001'
  return usd < 0.01 ? `~$${usd.toFixed(4)}` : `~$${usd.toFixed(2)}`
}
