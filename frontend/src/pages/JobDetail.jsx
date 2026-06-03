import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPublicClient, getWalletClient, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC, formatAddress, formatDate, STATUS_LABEL, isZeroAddress } from '../lib/arc'
import { useWallet } from '../hooks/useWallet'
import { useToast } from '../components/Toast'
import TxButton from '../components/TxButton'
import { ExternalLink, ArrowLeft, CheckCircle, AlertTriangle, Send, UserCheck, Info } from 'lucide-react'

const STATUS_CLASS = ['open','hired','submitted','validated','disputed','cancelled','expired']

export default function JobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { account } = useWallet()
  const toast = useToast()
  const [job, setJob] = useState(null)
  const [bids, setBids] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [bidForm, setBidForm] = useState({ agentId: '', amount: '', proposal: '', days: '7' })
  const [workUri, setWorkUri] = useState('')
  const [disputeReason, setDisputeReason] = useState('')
  const [validatorNotes, setValidatorNotes] = useState('')

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true); setNotFound(false)
    try {
      const client = getPublicClient()
      const [core, meta, bidsData] = await Promise.all([
        client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobCore', args: [BigInt(id)] }),
        client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobMeta', args: [BigInt(id)] }),
        client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobBids', args: [BigInt(id)] }),
      ])
      if (isZeroAddress(core.client)) { setNotFound(true); return }
      setJob({ core, meta }); setBids(bidsData)
    } catch { setNotFound(true) }
    finally { setLoading(false) }
  }

  const txFn = (fn) => async (...args) => {
    const wc = await getWalletClient()
    const [addr] = await wc.getAddresses()
    const pc = getPublicClient()
    const tx = await wc.writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: fn, args, account: addr })
    await pc.waitForTransactionReceipt({ hash: tx })
    load()
    return { txHash: tx }
  }

  async function handleBid() {
    if (!bidForm.agentId || !bidForm.amount || !bidForm.proposal.trim()) { toast('Fill all bid fields', 'error'); return }
    toast('Submitting bid…', 'info')
    const result = await txFn('submitBid')(BigInt(id), BigInt(bidForm.agentId), BigInt(Math.round(parseFloat(bidForm.amount) * 1e6)), bidForm.proposal.trim(), BigInt(bidForm.days))
    toast('Bid submitted!', 'success')
    return result
  }
  async function handleHire(idx) {
    const wc = await getWalletClient(); const [addr] = await wc.getAddresses()
    toast('Hiring agent…', 'info')
    const result = await txFn('hireAgent')(BigInt(id), BigInt(idx), addr)
    toast('Agent hired!', 'success'); return result
  }
  async function handleSubmitWork() {
    if (!workUri.trim()) { toast('Enter deliverable URI', 'error'); return }
    toast('Submitting work…', 'info')
    const result = await txFn('submitWork')(BigInt(id), workUri.trim())
    toast('Work submitted!', 'success'); return result
  }
  async function handleValidate() {
    toast('Releasing payment…', 'info')
    const result = await txFn('validateAndRelease')(BigInt(id), validatorNotes)
    toast('Payment released!', 'success'); return result
  }
  async function handleDispute() {
    if (!disputeReason.trim()) { toast('Enter dispute reason', 'error'); return }
    const result = await txFn('raiseDispute')(BigInt(id), disputeReason.trim())
    toast('Dispute raised', 'info'); return result
  }
  async function handleCancel() {
    const result = await txFn('cancelJob')(BigInt(id))
    toast('Job cancelled. USDC refunded.', 'success'); return result
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}><span className="spinner" style={{ width: 24, height: 24 }} /><span style={{ color: 'var(--text-muted)' }}>Loading job…</span></div>

  if (notFound) return (
    <div style={{ textAlign: 'center', padding: 80 }}>
      <p style={{ fontWeight: 700, fontSize: 20, marginBottom: 12 }}>Job not found</p>
      <button className="btn btn-primary" onClick={() => navigate('/board')}>Back to Board</button>
    </div>
  )

  const { core, meta } = job
  const sn = Number(core.status)
  const isClient = account?.toLowerCase() === core.client?.toLowerCase()
  const isAgent = !isZeroAddress(core.hiredAgent) && account?.toLowerCase() === core.hiredAgent?.toLowerCase()
  const isValidator = !isZeroAddress(core.validator) && account?.toLowerCase() === core.validator?.toLowerCase()
  const activeBids = bids.filter(b => !b.withdrawn)

  return (
    <div className="page-enter">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/board')} style={{ marginBottom: 20 }}>
        <ArrowLeft size={13} /> Back to Board
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', className: 'job-detail-grid', gap: 20, alignItems: 'start' }}>
        {/* Main */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header card */}
          <div className="card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <span className={`badge badge-${STATUS_CLASS[sn]}`}><span className="badge-dot" />{STATUS_LABEL[sn]}</span>
              <span className="tag">{meta.category}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>Job #{id}</span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(20px, 3vw, 28px)', color: 'var(--accent)', letterSpacing: '-0.02em', marginBottom: 12 }}>{meta.title}</h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: 14 }}>{meta.description}</p>
          </div>

          {/* Bids */}
          <div className="card" style={{ padding: 24 }}>
            <div className="section-label" style={{ marginBottom: 16 }}>Bids ({activeBids.length})</div>
            {activeBids.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No bids yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activeBids.map((bid, i) => (
                  <div key={i} className="card-inset" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <a href={`http://testnet.arcscan.app/address/${bid.agent}`} target="_blank" rel="noreferrer" className="address-pill"><ExternalLink size={9} />{formatAddress(bid.agent)}</a>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>#{bid.agentId.toString()}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--accent)' }}>${formatUSDC(bid.proposedAmount)}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{bid.deliveryDays.toString()}d</span>
                        {isClient && sn === 0 && (
                          <TxButton onClick={() => handleHire(i)} className="btn btn-primary btn-sm" showTx={false}>
                            <UserCheck size={11} /> Hire
                          </TxButton>
                        )}
                      </div>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>{bid.proposal}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit bid */}
          {sn === 0 && !isClient && account && (
            <div className="card" style={{ padding: 24 }}>
              <div className="section-label" style={{ marginBottom: 16 }}>Submit a Bid</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="grid-2">
                  <div className="input-group"><label className="input-label">Your Agent ID (ERC-8004)</label><input className="input" placeholder="e.g. 1" value={bidForm.agentId} onChange={e => setBidForm(f => ({ ...f, agentId: e.target.value }))} /></div>
                  <div className="input-group"><label className="input-label">Your Price (USDC)</label><input className="input" type="number" placeholder={`Max: $${formatUSDC(core.budget)}`} value={bidForm.amount} onChange={e => setBidForm(f => ({ ...f, amount: e.target.value }))} /></div>
                </div>
                <div className="input-group"><label className="input-label">Delivery Days</label><input className="input" type="number" min="1" value={bidForm.days} onChange={e => setBidForm(f => ({ ...f, days: e.target.value }))} /></div>
                <div className="input-group"><label className="input-label">Proposal</label><textarea className="input" rows={4} placeholder="Describe your approach and why you're the right agent…" value={bidForm.proposal} onChange={e => setBidForm(f => ({ ...f, proposal: e.target.value }))} /></div>
                <TxButton onClick={handleBid} className="btn btn-primary"><Send size={13} />Submit Bid</TxButton>
              </div>
            </div>
          )}

          {/* Submit work */}
          {sn === 1 && isAgent && (
            <div className="card" style={{ padding: 24 }}>
              <div className="section-label" style={{ marginBottom: 16 }}>Submit Your Work</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="input-group"><label className="input-label">Deliverable URI (IPFS or URL)</label><input className="input" placeholder="ipfs://... or https://..." value={workUri} onChange={e => setWorkUri(e.target.value)} /></div>
                <TxButton onClick={handleSubmitWork} className="btn btn-primary"><CheckCircle size={13} />Submit Work</TxButton>
              </div>
            </div>
          )}

          {/* Validate */}
          {sn === 2 && isValidator && (
            <div className="card" style={{ padding: 24 }}>
              <div className="section-label" style={{ marginBottom: 16 }}>Validate & Release Payment</div>
              {meta.deliverableURI && (
                <div style={{ marginBottom: 14, padding: 12, background: 'var(--bg-surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Deliverable</div>
                  <a href={meta.deliverableURI} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 13, wordBreak: 'break-all' }}>{meta.deliverableURI}</a>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="input-group"><label className="input-label">Validation Notes</label><textarea className="input" rows={3} placeholder="Notes on work quality…" value={validatorNotes} onChange={e => setValidatorNotes(e.target.value)} /></div>
                <TxButton onClick={handleValidate} className="btn btn-primary"><CheckCircle size={13} />Approve &amp; Release USDC</TxButton>
              </div>
            </div>
          )}

          {/* Dispute */}
          {sn === 2 && isClient && (
            <div className="card" style={{ padding: 24 }}>
              <div className="section-label" style={{ marginBottom: 16 }}>Raise a Dispute</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="input-group"><label className="input-label">Reason</label><textarea className="input" rows={3} placeholder="Describe the issue with the submitted work…" value={disputeReason} onChange={e => setDisputeReason(e.target.value)} /></div>
                <TxButton onClick={handleDispute} className="btn btn-danger"><AlertTriangle size={13} />Raise Dispute</TxButton>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Escrowed Budget</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 34, color: 'var(--accent)', marginBottom: 4 }}>${formatUSDC(core.budget)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>USDC · 1% platform fee on release</div>
          </div>

          <div className="card" style={{ padding: 22 }}>
            <div className="section-label" style={{ marginBottom: 14 }}>Details</div>
            {[
              { label: 'Client', value: formatAddress(core.client), link: `http://testnet.arcscan.app/address/${core.client}` },
              { label: 'Deadline', value: formatDate(core.deadline) },
              { label: 'Posted', value: formatDate(core.postedAt) },
              { label: 'Bids', value: core.bidCount.toString() },
              ...(!isZeroAddress(core.hiredAgent) ? [{ label: 'Agent', value: formatAddress(core.hiredAgent), link: `http://testnet.arcscan.app/address/${core.hiredAgent}` }] : []),
            ].map(({ label, value, link }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>
                {link ? (
                  <a href={link} target="_blank" rel="noreferrer" className="address-pill" style={{ fontSize: 10 }}><ExternalLink size={9} />{value}</a>
                ) : (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{value}</span>
                )}
              </div>
            ))}
          </div>

          {isClient && sn === 0 && (
            <TxButton onClick={handleCancel} className="btn btn-danger" style={{ width: '100%' }}>
              Cancel &amp; Refund USDC
            </TxButton>
          )}

          <a href={`http://testnet.arcscan.app/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ justifyContent: 'center' }}>
            <ExternalLink size={13} /> View on ArcScan
          </a>
        </div>
      </div>

      {/* Mobile: stack sidebar below on small screens */}
      <style>{`
        @media (max-width: 700px) {
          .job-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
