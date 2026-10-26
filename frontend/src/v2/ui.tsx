import { useEffect, useState, type ReactNode } from 'react'
import { explainError } from '../protocol/errors'
import { formatRemaining } from '../protocol/state'
import { formatUsdc, requiresTypedConfirm } from '../protocol/units'
import { useToast } from '../components/Toast'
import { NETWORKS } from '../lib/networks'
import { useWallet } from '../hooks/useWallet'

export interface WalletLike { account: string | null; wrongChain: boolean; openPicker: () => void; switchChain: () => Promise<boolean> }
/** Browser-wallet account only. Mainnet V2 never uses the Circle agent wallet. */
export const useV2Wallet = () => useWallet() as unknown as WalletLike

export const explorerTx = (h: string) => `${NETWORKS.mainnet.explorer}/tx/${h}`
export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

export function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

export function RealFundsBanner() {
  return (
    <div role="note" style={{ padding: '10px 14px', borderRadius: 'var(--r-sm)', background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,0.3)', fontSize: 13, color: 'var(--text-1)', marginBottom: 16 }}>
      <strong>Real USDC.</strong> This is Arc Mainnet. Transactions move real money, are final within a second, and cannot be reversed.
      The contracts have not had an independent security review.
    </div>
  )
}

export function Countdown({ label, endsAt, now, minor }: { label: string; endsAt: number; now: number; minor?: boolean }) {
  const over = endsAt <= now
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: minor ? 12 : 13, color: minor ? 'var(--text-3)' : 'var(--text-2)', padding: '4px 0' }}>
      <span>{label}</span>
      <span title={new Date(endsAt * 1000).toLocaleString()} style={{ fontFamily: 'var(--font-mono)', color: over ? 'var(--amber)' : 'var(--text-1)' }}>
        {over ? 'ended' : `in ${formatRemaining(endsAt, now)}`}
      </span>
    </div>
  )
}

/** Runs one wallet action with busy state, plain-language errors and a receipt link. */
export function useAction(onDone?: () => void) {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hash, setHash] = useState<string | null>(null)
  async function run(id: string, fn: () => Promise<{ hash: string } | void>) {
    setBusy(id); setError(null); setHash(null)
    try {
      const res = await fn()
      if (res && 'hash' in res) { setHash(res.hash); toast('Confirmed on Arc.', 'success') }
      onDone?.()
    } catch (e) {
      const m = explainError(e)
      setError(m)
      if (!(e instanceof Error && e.name === 'AppError')) console.error(e)
    } finally { setBusy(null) }
  }
  return { busy, error, hash, run, clear: () => { setError(null); setHash(null) } }
}

export function TxStatus({ error, hash }: { error: string | null; hash: string | null }) {
  if (!error && !hash) return null
  return (
    <div role={error ? 'alert' : 'status'} style={{ marginTop: 10, fontSize: 13, padding: '8px 12px', borderRadius: 'var(--r-sm)', background: error ? 'var(--red-dim)' : 'var(--green-dim)', color: error ? 'var(--red)' : 'var(--green)' }}>
      {error ?? <>Confirmed. <a href={`/receipt/${hash}`} style={{ color: 'inherit', textDecoration: 'underline' }}>View receipt</a></>}
    </div>
  )
}

/** Confirmation step for money-moving actions. At or above the threshold the amount must be typed. */
export function ConfirmDialog({ title, amount, lines, confirmLabel, onConfirm, onCancel }: {
  title: string; amount?: bigint; lines: ReactNode[]; confirmLabel: string; onConfirm: () => void; onCancel: () => void
}) {
  const [typed, setTyped] = useState('')
  const needsTyping = amount !== undefined && requiresTypedConfirm(amount)
  const expected = amount !== undefined ? formatUsdc(amount) : ''
  const ok = !needsTyping || typed.trim() === expected || typed.trim() === expected.replace(/,/g, '')
  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'fixed', inset: 0, background: 'rgba(26,16,64,0.45)', display: 'grid', placeItems: 'center', zIndex: 200, padding: 16 }}>
      <div className="card" style={{ maxWidth: 440, width: '100%', padding: 24 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 12 }}>{title}</h3>
        <ul style={{ paddingLeft: 18, margin: '0 0 14px', fontSize: 14, lineHeight: 1.6, color: 'var(--text-2)' }}>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
        {needsTyping && (
          <label style={{ display: 'block', fontSize: 13, marginBottom: 14 }}>
            Type <strong>{expected}</strong> to confirm this large amount.
            <input autoFocus value={typed} onChange={e => setTyped(e.target.value)} inputMode="decimal" style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid var(--border)' }} />
          </label>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" disabled={!ok} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)', fontSize: 14 }}>{children}</div>
}
export function Loading({ what }: { what: string }) {
  return <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }} aria-busy="true">Loading {what}…</div>
}
export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="card" role="alert" style={{ padding: 24, color: 'var(--red)', fontSize: 14 }}>
      {explainError(error)} {retry && <button className="btn btn-secondary btn-xs" onClick={retry} style={{ marginLeft: 8 }}>Retry</button>}
    </div>
  )
}
export const Page = ({ children, narrow }: { children: ReactNode; narrow?: boolean }) => (
  <main style={{ maxWidth: narrow ? 720 : 1040, margin: '0 auto', padding: '96px 20px 64px' }}>{children}</main>
)
