// Single place for "switch network" so the header switch, the launch buttons and any other control
// behave identically. Mainnet uses real USDC, so the first switch per session needs an explicit confirm.
const ACK_KEY = 'agentboard.mainnetAck'

export function mainnetAcknowledged() {
  try { return sessionStorage.getItem(ACK_KEY) === '1' } catch { return false }
}

/** Resolves true when the network was changed (or already selected). `confirmMainnet` is async so the UI can show its own dialog. */
export async function selectNetwork(next, current, setNetwork, confirmMainnet) {
  if (next === current) return true
  if (next === 'mainnet' && !mainnetAcknowledged()) {
    const ok = await confirmMainnet()
    if (!ok) return false
    try { sessionStorage.setItem(ACK_KEY, '1') } catch { /* ignore */ }
  }
  setNetwork(next)
  return true
}
