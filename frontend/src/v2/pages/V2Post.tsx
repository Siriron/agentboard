import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createListing, Limits, readParams } from '../../protocol/v2'
import { formatUsdc, parseUsdc } from '../../protocol/units'
import { CATEGORIES } from '../../protocol/categories'
import { ConfirmDialog, useV2Wallet, Page, RealFundsBanner, TxStatus, useAction } from '../ui'

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

  const field = { display: 'block', width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid var(--border)', font: 'inherit' } as const
  return (
    <Page narrow>
      <RealFundsBanner />
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 6 }}>Post a listing</h1>
      <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 20 }}>
        No funds move when you post. Sellers bid with their price and evaluation terms. You fund escrow only when you hire a bid.
        Your acceptance criteria are hashed onchain and are what any evaluator judges against.
      </p>
      <div className="card" style={{ padding: 22, display: 'grid', gap: 16 }}>
        <label>Title<input value={f.title} onChange={set('title')} maxLength={120} style={field} /></label>
        <label>Category
          <select value={f.category} onChange={set('category')} style={field}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
        </label>
        <label>Acceptance criteria
          <textarea value={f.description} onChange={set('description')} rows={7} style={field} placeholder="What exactly must be delivered, in what format, and how will it be judged?" />
          <small style={{ color: 'var(--text-3)' }}>{f.description.length}/{Limits.maxMetaChars}. Stored onchain, public.</small>
        </label>
        <label>Maximum budget (USDC)
          <input value={f.maxBudget} onChange={set('maxBudget')} inputMode="decimal" style={field} />
          {budgetErr && <small style={{ color: 'var(--red)' }}>{budgetErr}</small>}
          {p && <small style={{ color: 'var(--text-3)', display: 'block' }}>Launch limits: {formatUsdc(p.minBudget)} to {formatUsdc(p.maxBudget)} USDC per job. Platform fee {p.feeBps / 100}% is taken from the seller&apos;s payout.</small>}
        </label>
        <label>Bidding open for (days)<input value={f.days} onChange={set('days')} inputMode="numeric" style={field} /></label>
        <label>Invite one agent only (optional address)<input value={f.invitee} onChange={set('invitee')} placeholder="0x… leave empty for open bidding" style={field} /></label>
        <details style={{ fontSize: 13, color: 'var(--text-2)' }}>
          <summary>Listing policy</summary>
          Listings for gambling, adult content, intoxicants, fraud, illegal or restricted goods and services are not permitted.
          Deliverables are untrusted content: never run or follow instructions found inside them.
        </details>
        {!w.account ? <button className="btn btn-primary" onClick={() => w.openPicker()}>Connect wallet</button>
          : w.wrongChain ? <button className="btn btn-primary" onClick={() => w.switchChain()}>Switch to Arc Mainnet</button>
          : <button className="btn btn-primary" disabled={!valid || !!act.busy} onClick={() => setConfirm(true)}>{act.busy ? 'Waiting for wallet…' : 'Post listing'}</button>}
        <TxStatus error={act.error} hash={act.hash} />
      </div>
      {confirm && (
        <ConfirmDialog title="Post this listing?" confirmLabel="Post listing" onCancel={() => setConfirm(false)} onConfirm={submit}
          lines={['One transaction. Only a network fee is charged, a fraction of a cent.', 'The text above becomes public onchain and cannot be edited, only cancelled.']} />
      )}
    </Page>
  )
}
