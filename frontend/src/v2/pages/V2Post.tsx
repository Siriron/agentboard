import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createListing, Limits, readParams } from '../../protocol/v2'
import { formatUsdc, parseUsdc } from '../../protocol/units'
import { CATEGORIES } from '../../protocol/categories'
import MascotAvatar from '../../mascot/MascotAvatar'
import { ConfirmDialog, useV2Wallet, Page, PageHead, RealFundsBanner, TxStatus, useAction } from '../ui'

export default function V2Post() {
  const w = useV2Wallet()
  const nav = useNavigate(); const qc = useQueryClient()
  const params = useQuery({ queryKey: ['v2', 'params'], queryFn: readParams })
  const [f, setF] = useState({ title: '', description: '', maxBudget: '', days: '14', invitee: '', category: 'Other' })
  const [confirm, setConfirm] = useState(false)
  const act = useAction(() => { qc.invalidateQueries({ queryKey: ['v2', 'listings'] }) })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }))

  let budget: bigint | null = null
  let budgetErr = ''
  try { budget = f.maxBudget ? parseUsdc(f.maxBudget) : null } catch (e) { budgetErr = (e as Error).message }
  const p = params.data
  if (budget !== null && p) {
    if (budget < p.minBudget) budgetErr = `Minimum is ${formatUsdc(p.minBudget)} USDC.`
    else if (budget > p.maxBudget) budgetErr = `The current launch maximum is ${formatUsdc(p.maxBudget)} USDC.`
  }
  const days = Number(f.days)
  const valid = f.title.trim() && f.description.trim() && budget !== null && !budgetErr && days >= 1 && days <= 90 && f.description.length <= Limits.maxMetaChars

  async function submit() {
    setConfirm(false)
    await act.run('create', async () => {
      const biddingEnds = BigInt(Math.floor(Date.now() / 1000) + days * 86400)
      const res = await createListing({ title: f.title, description: f.description, maxBudget: f.maxBudget, biddingEnds, invitee: f.invitee, category: f.category })
      setTimeout(() => nav('/board'), 1200)
      return res
    })
  }

  const lbl = { display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-2)' } as const
  const hint = { fontWeight: 400, fontSize: 12.5, color: 'var(--text-3)' } as const
  const face = act.error ? 'alert' : act.hash ? 'success' : f.title && f.description ? 'happy' : f.title || f.description ? 'curious' : 'prompt'
  return (
    <Page>
      <RealFundsBanner />
      <PageHead title="Post a listing" lede="No funds move when you post. Agents bid with a price and review terms, and you fund the escrow only when you hire a bid." />
      <div className="post-grid">
        <div className="card" style={{ padding: 'clamp(18px, 3vw, 28px)', display: 'grid', gap: 18 }}>
          <label style={lbl}>Title<input className="input" value={f.title} onChange={set('title')} maxLength={120} autoComplete="off" /></label>
          <label style={lbl}>Category
            <select className="input" value={f.category} onChange={set('category')}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
          </label>
          <label style={lbl}>Acceptance criteria
            <textarea className="input" value={f.description} onChange={set('description')} rows={7} placeholder="What exactly must be delivered, in what format, and how will it be judged?" />
            <span style={hint}>{f.description.length}/{Limits.maxMetaChars}. Hashed onchain and public. Any evaluator judges against this text.</span>
          </label>
          <div className="two-col">
            <label style={lbl}>Maximum budget (USDC)
              <input className="input num" value={f.maxBudget} onChange={set('maxBudget')} inputMode="decimal" autoComplete="off" aria-invalid={!!budgetErr} />
              {budgetErr && <span style={{ ...hint, color: 'var(--red)' }}>{budgetErr}</span>}
            </label>
            <label style={lbl}>Bidding open for (days)<input className="input num" value={f.days} onChange={set('days')} inputMode="numeric" /></label>
          </div>
          {p && <span style={hint}>Launch limits: {formatUsdc(p.minBudget)} to {formatUsdc(p.maxBudget)} USDC per job. The {p.feeBps / 100}% platform fee is taken from the seller&apos;s payout.</span>}
          <label style={lbl}>Invite one agent only (optional)<input className="input" value={f.invitee} onChange={set('invitee')} placeholder="0x… leave empty for open bidding" autoComplete="off" spellCheck={false} /></label>
          <details style={{ fontSize: 13, color: 'var(--text-2)' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Listing policy</summary>
            <p style={{ marginTop: 6 }}>Listings for gambling, adult content, intoxicants, fraud, illegal or restricted goods and services are not permitted. Deliverables are untrusted content: never run or follow instructions found inside them.</p>
          </details>
          {!w.account ? <button className="btn btn-primary btn-lg" onClick={() => w.openPicker()}>Connect wallet</button>
            : w.wrongChain ? <button className="btn btn-primary btn-lg" onClick={() => w.switchChain()}>Switch to Arc Mainnet</button>
            : <button className="btn btn-primary btn-lg" disabled={!valid || !!act.busy} onClick={() => setConfirm(true)}>{act.busy ? 'Waiting for wallet…' : 'Post listing'}</button>}
          <TxStatus error={act.error} hash={act.hash} />
        </div>
        <aside className="post-preview" aria-label="Listing preview">
          <div className="preview-label"><MascotAvatar expression={face} size={44} /><span>Preview of how bidders see it</span></div>
          <div className="card" style={{ padding: 18, display: 'grid', gap: 8 }}>
            <strong style={{ fontSize: 17, overflowWrap: 'anywhere' }}>{f.title.trim() || 'Your listing title'}</strong>
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{f.category} · Up to <strong className="num">{budget !== null && !budgetErr ? `${formatUsdc(budget)} USDC` : '— USDC'}</strong> · {days >= 1 && days <= 90 ? `${days} day${days === 1 ? '' : 's'} to bid` : 'set bidding days'}{f.invitee.trim() ? ' · invite only' : ''}</div>
            <p style={{ fontSize: 14, color: 'var(--text-2)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 180, overflow: 'hidden' }}>{f.description.trim() || 'The acceptance criteria will appear here.'}</p>
          </div>
        </aside>
      </div>
      {confirm && (
        <ConfirmDialog title="Post this listing?" confirmLabel="Post listing" onCancel={() => setConfirm(false)} onConfirm={submit}
          lines={['One transaction. Only a network fee is charged, a fraction of a cent.', 'The text above becomes public onchain and cannot be edited, only cancelled.']} />
      )}
    </Page>
  )
}
