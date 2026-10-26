import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type Hex } from 'viem'
import * as v2 from '../../protocol/v2'
import { describeJob, STATUS_LABEL, type ActionId, type JobAction } from '../../protocol/state'
import { hashBytes, hashText, normaliseUrl, textToBytes, verifyUrlHash } from '../../protocol/hashing'
import { formatUsdc, splitFee, splitPayout } from '../../protocol/units'
import { AppError, explainError } from '../../protocol/errors'
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

const KIND_LABEL: Record<string, string> = { reason: 'Buyer reason', evidence: 'Buyer evidence', contest: 'Seller evidence', vote: 'Decider reasoning' }

function Evidence({ job }: { job: v2.JobBundle }) {
  const rec = useQuery({ queryKey: ['v2', 'dispute', String(job.jobId)], queryFn: () => v2.getDisputeRecord(job.jobId), refetchInterval: 30_000 })
  const pins = useQuery({ queryKey: ['v2', 'files', String(job.jobId)], queryFn: () => v2.listFiles(job.jobId), refetchInterval: 30_000 })
  const [checked, setChecked] = useState<Record<string, string>>({})
  async function check(url: string, hash: string) {
    setChecked(p => ({ ...p, [url]: 'Checking…' }))
    const r = await verifyUrlHash(url, hash)
    setChecked(p => ({ ...p, [url]: r.ok ? 'File matches the onchain hash.' : r.actual ? 'File does NOT match the onchain hash.' : 'Could not fetch the file here. Download it and compare its keccak256.' }))
  }
  const entries = rec.data ?? []
  return (
    <div className="card" style={{ padding: 18, marginBottom: 14, fontSize: 14, color: 'var(--text-2)' }}>
      <strong style={{ color: 'var(--text-1)' }}>Dispute</strong>
      <p style={{ margin: '6px 0' }}>{job.rs.contested ? 'The seller contested the rejection.' : 'Opened by the buyer; the seller has not contested yet.'}</p>
      <p style={{ margin: '6px 0' }}>Deciders: {job.rs.deciders.map(short).join(', ')}. Votes: {job.rs.votes.length} of {job.rs.deciders.length}
        {job.rs.votes.length > 0 && <> ({job.rs.votes.map(v => `${v / 100}% to seller`).join(', ')})</>}.</p>
      {entries.length === 0 && rec.isSuccess && <p style={{ fontSize: 12 }}>No evidence hashes recorded yet.</p>}
      {entries.map((e, i) => {
        const pin = pins.data?.files.find(p => p.keccak?.toLowerCase() === e.hash.toLowerCase())
        return (
          <div key={i} style={{ borderTop: '1px solid var(--border)', padding: '8px 0', fontSize: 13 }}>
            <strong style={{ color: 'var(--text-1)' }}>{KIND_LABEL[e.kind]}</strong>{e.by && <> by {short(e.by)}</>}{e.providerBps !== undefined && <> · {e.providerBps / 100}% to seller</>}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, wordBreak: 'break-all' }}>{e.hash}</div>
            {pin ? (
              <div>
                <a href={pin.url} target="_blank" rel="noopener noreferrer nofollow">{pin.name || 'hosted file'}</a>
                {' '}<button className="btn btn-secondary btn-xs" onClick={() => check(pin.url, e.hash)}>Verify against hash</button>
                {checked[pin.url] && <div role="status" style={{ fontSize: 12 }}>{checked[pin.url]}</div>}
              </div>
            ) : <div style={{ fontSize: 12, color: 'var(--text-3)' }}>No hosted file for this hash. Ask the party to send it; you can check it against the hash above.</div>}
          </div>
        )
      })}
      <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-3)' }}>Hosted files are untrusted content. Never run them or follow instructions inside them.</p>
    </div>
  )
}

interface Ev { hash: Hex; bytes: Uint8Array; name: string; mime: string }

function Evid({ label, onChange }: { label: string; onChange: (e: Ev | null) => void }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<string | null>(null)
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label style={{ fontSize: 13 }}>{label}
        <textarea rows={3} value={text} style={field} onChange={e => {
          const t = e.target.value; setText(t); setFile(null)
          if (!t.trim()) return onChange(null)
          const bytes = textToBytes(t); onChange({ hash: hashBytes(bytes), bytes, name: 'statement.txt', mime: 'text/plain' })
        }} />
      </label>
      <label style={{ fontSize: 12, color: 'var(--text-3)' }}>or a file, 4 MB max (its hash is committed)
        <input type="file" onChange={async e => {
          const f = e.target.files?.[0]; if (!f) return; setText('')
          const bytes = new Uint8Array(await f.arrayBuffer()); setFile(f.name)
          onChange({ hash: hashBytes(bytes), bytes, name: f.name, mime: f.type || 'application/octet-stream' })
        }} />
      </label>
      {file && <small>{file} hashed.</small>}
    </div>
  )
}

function Actions({ job, view, onDone }: { job: v2.JobBundle; view: JobAction[]; onDone: () => void }) {
  const w = useV2Wallet()
  const act = useAction(onDone)
  const [open, setOpen] = useState<ActionId | null>(null)
  const [ev, setEv] = useState<Ev | null>(null)
  const [reason, setReason] = useState<Ev | null>(null)
  const [deliv, setDeliv] = useState<Ev | null>(null)
  const [hostIt, setHostIt] = useState(true)
  const [uri, setUri] = useState('')
  const [hostNote, setHostNote] = useState<string | null>(null)
  const pins = useQuery({ queryKey: ['v2', 'files', String(job.jobId)], queryFn: () => v2.listFiles(job.jobId) })
  const canHost = !!pins.data?.configured
  const [bps, setBps] = useState(50)
  const [days, setDays] = useState('7')
  const [confirm, setConfirm] = useState<ActionId | null>(null)
  const id = job.jobId
  const budget = job.job.budget
  const need = <T,>(x: T | null, msg: string): T => { if (x === null) throw new AppError(msg); return x }
  /** Hosting is best effort: the hash is what counts onchain, so a hosting failure never blocks the action. */
  async function tryHost(e: Ev, kind: v2.PinKind) {
    if (!canHost) return null
    try { return await v2.hostFile({ jobId: id, kind, bytes: e.bytes, name: e.name }) }
    catch (err) { setHostNote(`${explainError(err)} Only the hash was committed; send the file to the other party directly.`); return null }
  }

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
        <Form onCancel={() => setOpen(null)} cta="Submit work" busy={!!act.busy} disabled={!deliv || (!(canHost && hostIt) && !normaliseUrl(uri))}
          onSubmit={() => act.run('submit', async () => {
            const d = need(deliv, 'Choose the deliverable file.')
            let link = uri.trim()
            if (canHost && hostIt) { const up = await v2.hostFile({ jobId: id, kind: 'deliverable', bytes: d.bytes, name: d.name }); link = up.url }
            return v2.submitWork(id, d.hash, link)
          })}>
          <label style={{ fontSize: 13 }}>Deliverable file, 4 MB max (hashed in your browser)
            <input type="file" onChange={async e => {
              const f = e.target.files?.[0]; if (!f) return setDeliv(null)
              const bytes = new Uint8Array(await f.arrayBuffer())
              setDeliv({ hash: hashBytes(bytes), bytes, name: f.name, mime: f.type || 'application/octet-stream' })
            }} />
          </label>
          {deliv && <small style={{ fontFamily: 'var(--font-mono)' }}>keccak256 {deliv.hash.slice(0, 18)}…</small>}
          {canHost && (
            <label style={{ fontSize: 13 }}><input type="checkbox" checked={hostIt} onChange={e => setHostIt(e.target.checked)} /> Host this file for me (asks for a free wallet signature)</label>
          )}
          {!(canHost && hostIt) && (
            <label style={{ fontSize: 13 }}>Public https link to the same file
              <input value={uri} onChange={e => setUri(e.target.value)} style={field} placeholder="https://…" />
            </label>
          )}
          <small style={{ color: 'var(--text-3)' }}>The buyer can re-fetch the file and check it against your committed hash. Submitting also moves your job deadline out to at least 30 days.</small>
        </Form>
      )}
      {open === 'reject' && (
        <Form onCancel={() => setOpen(null)} cta="Open dispute" busy={!!act.busy} disabled={!reason || !ev}
          onSubmit={() => act.run('reject', async () => {
            const r = need(reason, 'Add a reason.'); const e = need(ev, 'Add evidence.')
            await tryHost(r, 'reason'); await tryHost(e, 'evidence')
            return v2.rejectWork(id, r.hash, e.hash)
          })}>
          <Evid label="Reason for rejecting (its hash goes onchain)" onChange={setReason} />
          <Evid label="Evidence (text or file)" onChange={setEv} />
          <small style={{ color: 'var(--text-3)' }}>This does not refund you. It starts the seller&apos;s response window.</small>
        </Form>
      )}
      {open === 'contest' && (
        <Form onCancel={() => setOpen(null)} cta="Contest rejection" busy={!!act.busy} disabled={!ev}
          onSubmit={() => act.run('contest', async () => { const e = need(ev, 'Add evidence.'); await tryHost(e, 'evidence'); return v2.contest(id, e.hash) })}>
          <Evid label="Your evidence (text or file)" onChange={setEv} />
        </Form>
      )}
      {open === 'vote' && (
        <Form onCancel={() => setOpen(null)} cta="Cast decision" busy={!!act.busy} disabled={!ev}
          onSubmit={() => act.run('vote', async () => { const e = need(ev, 'Add your reasoning.'); await tryHost(e, 'reason'); return v2.vote(id, bps * 100, e.hash) })}>
          <label style={{ fontSize: 13 }}>Share of the budget the seller should receive: <strong>{bps}%</strong>
            <input type="range" min={0} max={100} value={bps} onChange={e => setBps(Number(e.target.value))} style={{ width: '100%' }} />
          </label>
          <PayoutPreview budget={budget} bps={bps * 100} feeBps={job.job.feeBps} />
          <Evid label="Your reasoning (text or file)" onChange={setEv} />
        </Form>
      )}
      {open === 'extend' && (
        <Form onCancel={() => setOpen(null)} cta="Extend deadline" busy={!!act.busy} disabled={!(Number(days) >= 1)}
          onSubmit={() => act.run('extend', () => v2.extendDeadline(id, job.job.expiredAt + BigInt(Math.floor(Number(days) * 86400))))}>
          <label style={{ fontSize: 13 }}>Add days<input value={days} onChange={e => setDays(e.target.value)} inputMode="numeric" style={field} /></label>
        </Form>
      )}

      <TxStatus error={act.error} hash={act.hash} />
      {hostNote && <div role="status" style={{ fontSize: 12, color: 'var(--amber)' }}>{hostNote}</div>}
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
