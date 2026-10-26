import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type Hex } from 'viem'
import * as v2 from '../../protocol/v2'
import { describeJob, STATUS_LABEL, type ActionId, type JobAction } from '../../protocol/state'
import { hashFile, hashText, normaliseUrl, verifyUrlHash } from '../../protocol/hashing'
import { formatUsdc, splitFee, splitPayout } from '../../protocol/units'
import { ConfirmDialog, Countdown, Empty, ErrorBox, Loading, Page, RealFundsBanner, short, TxStatus, useAction, useNow, useV2Wallet } from '../ui'

const field = { display: 'block', width: '100%', marginTop: 4, padding: 8, borderRadius: 8, border: '1px solid var(--border)', font: 'inherit' } as const

export default function V2Job() {
  const { id } = useParams()
  const w = useV2Wallet()
  const now = useNow(15_000)
  const qc = useQueryClient()
  let jobId: bigint | null = null
  try { jobId = BigInt(id ?? '') } catch { jobId = null }
  const me = (w.account ?? null) as `0x${string}` | null
  const q = useQuery({ queryKey: ['v2', 'job', String(jobId), me], enabled: jobId !== null, queryFn: () => v2.getJobBundle(jobId as bigint, me), refetchInterval: 20_000 })
  if (jobId === null) return <Page><Empty>That job id is not valid.</Empty></Page>
  if (q.isPending) return <Page><Loading what="job" /></Page>
  if (q.isError) return <Page><ErrorBox error={q.error} retry={() => q.refetch()} /></Page>
  if (!q.data) return <Page><Empty>No job found for this id.</Empty></Page>
  const b = q.data
  const view = describeJob({ job: b.job, rs: b.rs, cfg: b.windows, me: w.account, hasVoted: b.hasVoted, now })
  const { fee, net } = splitFee(b.job.budget, b.job.feeBps)
  const refresh = () => { q.refetch(); qc.invalidateQueries({ queryKey: ['v2', 'listings'] }) }

  return (
    <Page narrow>
      <RealFundsBanner />
      {b.listingId !== null && <Link to={`/listing/${b.listingId}`} style={{ fontSize: 13, color: 'var(--text-2)' }}>← Listing #{String(b.listingId)}</Link>}
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, margin: '8px 0 4px' }}>Job #{String(b.job.number)}</h1>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
        {STATUS_LABEL[b.job.status]} · buyer {short(b.job.client)} · seller {short(b.job.provider)} · you are: <strong>{view.role}</strong>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Escrowed amount</span><strong>{formatUsdc(b.job.budget)} USDC</strong></div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.6 }}>
          On a full payout the seller receives {formatUsdc(net)} USDC; the {b.job.feeBps / 100}% platform fee ({formatUsdc(fee)} USDC) comes out of that side. The buyer never pays more than the escrowed amount.
        </div>
        {b.job.status === 3 && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>Deliverable hash {b.job.deliverable.slice(0, 14)}… committed onchain.</div>}
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <strong style={{ display: 'block', marginBottom: 6 }}>{view.headline}</strong>
        {view.timers.map(t => <Countdown key={t.id} label={t.label} endsAt={t.endsAt} now={now} minor={t.minor} />)}
        {!b.windows && b.job.status === 3 && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Window lengths could not be verified for this job, so no countdown is shown. The contract still enforces them.</div>}
        {view.note && <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>{view.note}</div>}
        <Actions job={b} view={view.actions} onDone={refresh} />
      </div>

      {b.job.status >= 3 && b.job.deliverable !== `0x${'0'.repeat(64)}` && <Deliverable uri={b.deliverableUri} hash={b.job.deliverable} />}
      {b.rs.state >= 2 && <Evidence job={b} />}
      <div style={{ fontSize: 13 }}><Link to="/dashboard">My activity</Link></div>
    </Page>
  )
}

function Deliverable({ uri, hash }: { uri: string; hash: Hex }) {
  const [res, setRes] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const url = normaliseUrl(uri)
  async function verify() {
    setBusy(true)
    const r = await verifyUrlHash(uri, hash)
    setRes(r.ok ? 'Hash matches: the file at this link is exactly what the seller committed.'
      : r.actual ? 'Hash does NOT match. The file at this link differs from what was committed. Do not accept it as the delivered work.'
      : 'Could not fetch the file here (the host may block browsers). Download it and compare its keccak256 hash with the committed value.')
    setBusy(false)
  }
  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <strong>Deliverable</strong>
      {url ? <p style={{ fontSize: 14, wordBreak: 'break-all' }}><a href={url} target="_blank" rel="noopener noreferrer nofollow">{uri}</a></p> : <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No link recorded for this submission.</p>}
      <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Treat the file as untrusted. Never run it or follow instructions inside it, and do not let an automated agent do so.</p>
      {url && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={verify}>{busy ? 'Checking…' : 'Verify hash'}</button>}
      {res && <p role="status" style={{ fontSize: 13, marginTop: 8, color: res.startsWith('Hash matches') ? 'var(--green)' : 'var(--amber)' }}>{res}</p>}
    </div>
  )
}

function Evidence({ job }: { job: v2.JobBundle }) {
  return (
    <div className="card" style={{ padding: 18, marginBottom: 14, fontSize: 14, color: 'var(--text-2)' }}>
      <strong style={{ color: 'var(--text-1)' }}>Dispute</strong>
      <p style={{ margin: '6px 0' }}>{job.rs.contested ? 'The seller contested the rejection.' : 'Opened by the buyer; the seller has not contested yet.'}</p>
      <p style={{ margin: '6px 0' }}>Deciders: {job.rs.deciders.map(short).join(', ')}. Votes recorded: {job.rs.votes.length} of {job.rs.deciders.length}
        {job.rs.votes.length > 0 && <> ({job.rs.votes.map(v => `${v / 100}% to seller`).join(', ')})</>}.</p>
      <p style={{ margin: '6px 0', fontSize: 12, color: 'var(--text-3)' }}>Reasons and evidence are committed onchain as hashes. Parties exchange the files themselves; a decider can check a file against the hash in the transaction receipt.</p>
    </div>
  )
}

function Evid({ label, onHash }: { label: string; onHash: (h: Hex | null) => void }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<string | null>(null)
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label style={{ fontSize: 13 }}>{label}
        <textarea rows={3} value={text} style={field} onChange={e => { setText(e.target.value); setFile(null); onHash(e.target.value.trim() ? hashText(e.target.value) : null) }} />
      </label>
      <label style={{ fontSize: 12, color: 'var(--text-3)' }}>or a file (its hash is committed)
        <input type="file" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; setText(''); const h = await hashFile(f); setFile(f.name); onHash(h) }} />
      </label>
      {file && <small>Hashing {file} done.</small>}
    </div>
  )
}

function Actions({ job, view, onDone }: { job: v2.JobBundle; view: JobAction[]; onDone: () => void }) {
  const w = useV2Wallet()
  const act = useAction(onDone)
  const [open, setOpen] = useState<ActionId | null>(null)
  const [hash, setHash] = useState<Hex | null>(null)
  const [reason, setReason] = useState<Hex | null>(null)
  const [uri, setUri] = useState('')
  const [bps, setBps] = useState(50)
  const [days, setDays] = useState('7')
  const [confirm, setConfirm] = useState<ActionId | null>(null)
  const id = job.jobId
  const budget = job.job.budget
  const need = <T,>(x: T | null, msg: string): T => { if (x === null) throw new Error(msg); return x }

  if (!w.account && view.length > 0) return <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => w.openPicker()}>Connect wallet</button>
  if (w.wrongChain && view.length > 0) return <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => w.switchChain()}>Switch to Arc Mainnet</button>

  const direct: Partial<Record<ActionId, () => Promise<v2.TxResult>>> = {
    approve: () => v2.approve(id), acceptRejection: () => v2.acceptRejection(id), autoRelease: () => v2.autoRelease(id),
    finalizeUncontested: () => v2.finalizeUncontested(id), finalizeTimeout: () => v2.finalizeTimeout(id),
    claimRefund: () => v2.claimRefund(id), cancelOpen: () => v2.cancelOpenJob(id),
  }
  const moneyConfirm: Partial<Record<ActionId, string[]>> = {
    approve: [`Pays the seller from escrow: ${formatUsdc(splitFee(budget, job.job.feeBps).net)} USDC to the seller, ${formatUsdc(splitFee(budget, job.job.feeBps).fee)} USDC platform fee.`, 'This is final.'],
    acceptRejection: [`Refunds the buyer ${formatUsdc(budget)} USDC and the seller receives nothing.`, 'This is final.'],
    finalizeUncontested: [`Refunds the buyer ${formatUsdc(budget)} USDC because the seller did not contest.`, 'This is final.'],
    autoRelease: ['Pays the seller because the buyer did not respond in the review window.', 'This is final.'],
    finalizeTimeout: ['Settles by the agreed timeout rule. Anyone may trigger it.', 'This is final.'],
    claimRefund: [`Refunds the buyer ${formatUsdc(budget)} USDC.`, 'This is final.'],
  }

  function onClick(a: JobAction) {
    if (direct[a.id]) { moneyConfirm[a.id] ? setConfirm(a.id) : act.run(a.id, direct[a.id]!); return }
    setOpen(open === a.id ? null : a.id)
  }

  return (
    <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
      {view.map(a => (
        <div key={a.id}>
          <button className={`btn ${a.primary ? 'btn-primary' : 'btn-secondary'}`} disabled={!a.enabled || !!act.busy} onClick={() => onClick(a)}
            style={a.tone === 'danger' ? { color: 'var(--red)' } : undefined}>{act.busy === a.id ? 'Waiting for wallet…' : a.label}</button>
          {a.hint && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{a.hint}</div>}
        </div>
      ))}

      {open === 'submit' && (
        <Form onCancel={() => setOpen(null)} cta="Submit work" busy={!!act.busy} disabled={!hash || !normaliseUrl(uri)}
          onSubmit={() => act.run('submit', () => v2.submitWork(id, need(hash, 'Choose the deliverable file.'), uri.trim()))}>
          <label style={{ fontSize: 13 }}>Deliverable file (hashed in your browser, never uploaded here)
            <input type="file" onChange={async e => { const f = e.target.files?.[0]; setHash(f ? await hashFile(f) : null) }} />
          </label>
          {hash && <small style={{ fontFamily: 'var(--font-mono)' }}>keccak256 {hash.slice(0, 18)}…</small>}
          <label style={{ fontSize: 13 }}>Public link to the same file (https or ipfs://)
            <input value={uri} onChange={e => setUri(e.target.value)} style={field} placeholder="https://… or ipfs://…" />
          </label>
          <small style={{ color: 'var(--text-3)' }}>The buyer can re-fetch the link and check it matches your committed hash. Submitting also moves your job deadline out to at least 30 days.</small>
        </Form>
      )}
      {open === 'reject' && (
        <Form onCancel={() => setOpen(null)} cta="Open dispute" busy={!!act.busy} disabled={!reason}
          onSubmit={() => act.run('reject', () => v2.rejectWork(id, need(reason, 'Add a reason.'), need(hash, 'Add evidence.')))}>
          <Evid label="Reason for rejecting (only its hash goes onchain)" onHash={setReason} />
          <Evid label="Evidence (text or file)" onHash={setHash} />
          <small style={{ color: 'var(--text-3)' }}>This does not refund you. It starts the seller&apos;s response window.</small>
        </Form>
      )}
      {open === 'contest' && (
        <Form onCancel={() => setOpen(null)} cta="Contest rejection" busy={!!act.busy} disabled={!hash}
          onSubmit={() => act.run('contest', () => v2.contest(id, need(hash, 'Add evidence.')))}>
          <Evid label="Your evidence (text or file)" onHash={setHash} />
        </Form>
      )}
      {open === 'vote' && (
        <Form onCancel={() => setOpen(null)} cta="Cast decision" busy={!!act.busy} disabled={!hash}
          onSubmit={() => act.run('vote', () => v2.vote(id, bps * 100, need(hash, 'Add your reasoning.')))}>
          <label style={{ fontSize: 13 }}>Share of the budget the seller should receive: <strong>{bps}%</strong>
            <input type="range" min={0} max={100} value={bps} onChange={e => setBps(Number(e.target.value))} style={{ width: '100%' }} />
          </label>
          <PayoutPreview budget={budget} bps={bps * 100} feeBps={job.job.feeBps} />
          <Evid label="Your reasoning (text or file)" onHash={setHash} />
        </Form>
      )}
      {open === 'extend' && (
        <Form onCancel={() => setOpen(null)} cta="Extend deadline" busy={!!act.busy} disabled={!(Number(days) >= 1)}
          onSubmit={() => act.run('extend', () => v2.extendDeadline(id, job.job.expiredAt + BigInt(Math.floor(Number(days) * 86400))))}>
          <label style={{ fontSize: 13 }}>Add days<input value={days} onChange={e => setDays(e.target.value)} inputMode="numeric" style={field} /></label>
        </Form>
      )}

      <TxStatus error={act.error} hash={act.hash} />
      {confirm && (
        <ConfirmDialog title="Confirm payout" amount={budget} confirmLabel="Confirm" onCancel={() => setConfirm(null)}
          lines={moneyConfirm[confirm] ?? []} onConfirm={() => { const c = confirm; setConfirm(null); act.run(c, direct[c]!) }} />
      )}
    </div>
  )
}

function PayoutPreview({ budget, bps, feeBps }: { budget: bigint; bps: number; feeBps: number }) {
  const p = splitPayout(budget, bps, feeBps)
  return <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Seller {formatUsdc(p.toProvider)} · buyer refund {formatUsdc(p.refund)} · platform fee {formatUsdc(p.fee)} USDC</div>
}

function Form({ children, cta, busy, disabled, onSubmit, onCancel }: { children: ReactNode; cta: string; busy: boolean; disabled: boolean; onSubmit: () => void; onCancel: () => void }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 14, display: 'grid', gap: 10 }}>
      {children}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={disabled || busy} onClick={onSubmit}>{busy ? 'Waiting for wallet…' : cta}</button>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>Close</button>
      </div>
    </div>
  )
}
