import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { explainError } from '../protocol/errors'
import { formatRemaining } from '../protocol/state'
import { formatUsdc, requiresTypedConfirm } from '../protocol/units'
import { useToast } from '../components/Toast'
import { NETWORKS } from '../lib/networks'
import { useWallet } from '../hooks/useWallet'
import MascotAvatar from '../mascot/MascotAvatar'
import { STATUS_LABEL } from '../protocol/state'

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
    <div role="note" className="notice notice-main">
      <span className="tag-main">Real USDC</span>
      <span>This is Arc Mainnet. Transactions move real money, are final within a second, and cannot be reversed. The contracts have not had an independent security review.</span>
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
  const inFlight = useRef(false)
  async function run(id: string, fn: () => Promise<{ hash: string } | void>) {
    if (inFlight.current) return // double-submit guard: a second tap while a wallet action is pending is ignored
    inFlight.current = true
    setBusy(id); setError(null); setHash(null)
    try {
      const res = await fn()
      if (res && 'hash' in res) { setHash(res.hash); toast('Confirmed on Arc.', 'success') }
      onDone?.()
    } catch (e) {
      const m = explainError(e)
      setError(m)
      if (!(e instanceof Error && e.name === 'AppError')) console.error(e)
    } finally { inFlight.current = false; setBusy(null) }
  }
  return { busy, error, hash, run, clear: () => { setError(null); setHash(null) } }
}

export function TxStatus({ error, hash }: { error: string | null; hash: string | null }) {
  if (!error && !hash) return null
  // The avatar only reflects real state: success once a hash was returned, alert on a real error.
  return (
    <div role={error ? 'alert' : 'status'} className={`txstatus ${error ? 'is-error' : 'is-ok'}`}>
      <MascotAvatar expression={error ? 'alert' : 'success'} size={40} />
      <span>{error ?? <>Confirmed on Arc. <Link to={`/receipt/${hash}`}>View receipt</Link></>}</span>
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  return (
    <div className="mc-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="mc-dialog" style={{ width: 'min(460px, 100%)' }}>
        <h3 style={{ fontSize: 22 }}>{title}</h3>
        <ul style={{ paddingLeft: 18, margin: '0 0 6px', fontSize: 14.5, lineHeight: 1.6, color: 'var(--text-2)' }}>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
        {needsTyping && (
          <label style={{ display: 'block', fontSize: 14 }}>
            Type <strong className="num">{expected}</strong> to confirm this large amount.
            <input autoFocus value={typed} onChange={e => setTyped(e.target.value)} inputMode="decimal" autoComplete="off" spellCheck={false} className="input" style={{ marginTop: 6 }} />
          </label>
        )}
        <div className="mc-actions" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" disabled={!ok} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

export function Empty({ children, title, expression = 'curious' }: { children: ReactNode; title?: string; expression?: 'idle' | 'curious' | 'prompt' | 'happy' }) {
  return (
    <div className="empty">
      <MascotAvatar expression={expression} size={88} />
      <div>{title && <h3 style={{ fontSize: 20, marginBottom: 4 }}>{title}</h3>}<div style={{ color: 'var(--text-2)' }}>{children}</div></div>
    </div>
  )
}
export function Loading({ what }: { what: string }) {
  return (
    <div className="empty" aria-busy="true" role="status">
      <MascotAvatar expression="working" size={64} />
      <div style={{ color: 'var(--text-2)' }}>Loading {what}…</div>
    </div>
  )
}
export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="empty is-error" role="alert">
      <MascotAvatar expression="alert" size={64} />
      <div>{explainError(error)} {retry && <button className="btn btn-secondary btn-xs" onClick={retry} style={{ marginLeft: 8 }}>Try again</button>}</div>
    </div>
  )
}
export const Page = ({ children, narrow }: { children: ReactNode; narrow?: boolean }) => (
  <div className={`page${narrow ? ' page-narrow' : ''}`}>{children}</div>
)

/** Page title block shared by every app route. */
export function PageHead({ title, lede, children }: { title: string; lede?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div><h1>{title}</h1>{lede && <p>{lede}</p>}</div>
      {children && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{children}</div>}
    </div>
  )
}

/** Escrow progress for a job, driven only by the job's real onchain status (1 awaiting funding ... 7 split). */
export function EscrowPath({ status }: { status: number }) {
  const active = status <= 1 ? -1 : status === 2 ? 0 : status === 3 ? 1 : 2
  const steps = ['Funded', 'Work submitted', status >= 4 ? STATUS_LABEL[status] : 'Settled']
  const face = status === 4 ? 'success' : status === 3 ? 'curious' : status === 2 ? 'working' : 'idle'
  return (
    <div className="escrow-path" role="group" aria-label={`Escrow progress: ${STATUS_LABEL[status] ?? 'unknown'}`}>
      <MascotAvatar expression={face} size={52} />
      <ol>
        {steps.map((t, i) => <li key={t} className={i < active ? 'done' : i === active ? 'now' : ''} aria-current={i === active ? 'step' : undefined}><span className="dot" aria-hidden />{t}</li>)}
      </ol>
    </div>
  )
}
