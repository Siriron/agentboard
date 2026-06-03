import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPublicClient, getWalletClient, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC, formatAddress, formatDate, STATUS_LABEL, isZeroAddress } from '../lib/arc'
import { useWallet } from '../hooks/useWallet'
import { useToast } from '../components/Toast'
import TxButton from '../components/TxButton'
import { ExternalLink, ArrowLeft, CheckCircle, AlertTriangle, Send, UserCheck } from 'lucide-react'

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
    setLoading(true)
    setNotFound(false)
    try {
      const client = getPublicClient()
      const [core, meta, bidsData] = await Promise.all([
        client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobCore', args: [BigInt(id)] }),
        client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobMeta', args: [BigInt(id)] }),
        client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobBids', args: [BigInt(id)] }),
      ])
      // BUG FIX: detect empty/uninitialized job (client is zero address)
      if (isZeroAddress(core.client)) { setNotFound(true); return }
      setJob({ core, meta })
      setBids(bidsData)
    } catch (e) {
      toast('Failed to load job', 'error')
      setNotFound(true)
    } finally { setLoading(false) }
  }

  async function handleBid() {
    if (!account) { toast('Connect wallet', 'error'); return }
    if (!bidForm.agentId || !bidForm.amount || !bidForm.proposal) { toast('Fill all bid fields', 'error'); return }
    const wc = await getWalletClient()
    const [addr] = await wc.getAddresses()
    const pc = getPublicClient()
    const amountRaw = BigInt(Math.round(parseFloat(bidForm.amount) * 1e6))
    const tx = await wc.writeContract({
      address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
      functionName: 'submitBid',
      args: [BigInt(id), BigInt(bidForm.agentId), amountRaw, bidForm.proposal, BigInt(bidForm.days)],
      account: addr,
    })
    await pc.waitForTransactionReceipt({ hash: tx })
    toast('Bid submitted!', 'success')
    load()
    return { txHash: tx }
  }

  async function handleHire(bidIndex) {
    const wc = await getWalletClient()
    const [addr] = await wc.getAddresses()
    const pc = getPublicClient()
    // BUG FIX: hire uses caller as validator — but caller must be a registered validator
    // We pass addr (owner) as validator since owner is auto-registered in constructor
    const tx = await wc.writeContract({
      address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
      functionName: 'hireAgent',
      args: [BigInt(id), BigInt(bidIndex), addr],
      account: addr,
    })
    await pc.waitForTransactionReceipt({ hash: tx })
    toast('Agent hired!', 'success')
    load()
    return { txHash: tx }
  }

  async function handleSubmitWork() {
    if (!workUri.trim()) { toast('Enter a deliverable URI', 'error'); return }
    const wc = await getWalletClient()
    const [addr] = await wc.getAddresses()
    const pc = getPublicClient()
    const tx = await wc.writeContract({
      address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
      functionName: 'submitWork',
      args: [BigInt(id), workUri.trim()],
      account: addr,
    })
    await pc.waitForTransactionReceipt({ hash: tx })
    toast('Work submitted!', 'success')
    load()
    return { txHash: tx }
  }

  async function handleValidate() {
    const wc = await getWalletClient()
    const [addr] = await wc.getAddresses()
    const pc = getPublicClient()
    const tx = await wc.writeContract({
      address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
      functionName: 'validateAndRelease',
      args: [BigInt(id), validatorNotes],
      account: addr,
    })
    await pc.waitForTransactionReceipt({ hash: tx })
    toast('Work validated! USDC released.', 'success')
    load()
    return { txHash: tx }
  }

  async function handleDispute() {
    if (!disputeReason.trim()) { toast('Enter a dispute reason', 'error'); return }
    const wc = await getWalletClient()
    const [addr] = await wc.getAddresses()
    const pc = getPublicClient()
    const tx = await wc.writeContract({
      address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
      functionName: 'raiseDispute',
      args: [BigInt(id), disputeReason.trim()],
      account: addr,
    })
    await pc.waitForTransactionReceipt({ hash: tx })
    toast('Dispute raised', 'info')
    load()
    return { txHash: tx }
  }

  async function handleCancel() {
    const wc = await getWalletClient()
    const [addr] = await wc.getAddresses()
    const pc = getPublicClient()
    const tx = await wc.writeContract({
      address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
      functionName: 'cancelJob',
      args: [BigInt(id)],
      account: addr,
    })
    await pc.waitForTransactionReceipt({ hash: tx })
    toast('Job cancelled. USDC refunded.', 'success')
    return { txHash: tx }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
      <span className="spinner" style={{ width: 24, height: 24 }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>Loading job from Arc…</span>
    </div>
  )

  if (notFound) return (
    <div style={{ textAlign: 'center', padding: 80 }}>
      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, marginBottom: 12 }}>Job not found</p>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>This job doesn't exist on Arc Testnet.</p>
      <button className="btn btn-primary" onClick={() => navigate('/board')}>Back to Board</button>
    </div>
  )

  const { core, meta } = job
  const statusNum = Number(core.status)

  // BUG FIX 12: status comparisons must use Number() since core.status comes back as BigInt from viem
  const isClient = account?.toLowerCase() === core.client?.toLowerCase()
  const isAgent = !isZeroAddress(core.hiredAgent) && account?.toLowerCase() === core.hiredAgent?.toLowerCase()
  const isJobValidator = !isZeroAddress(core.validator) && account?.toLowerCase() === core.validator?.toLowerCase()
  const statusClass = STATUS_CLASS[statusNum] || 'cancelled'
  const activeBids = bids.filter(b => !b.withdrawn)

  return (
    <div className="page-enter">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/board')} style={{ marginBottom: 24 }}>
        <ArrowLeft size={13} /> Back to Board
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        {/* Main column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Header */}
          <div className="panel speed-lines" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span className={`badge badge-${statusClass}`}><span className="badge-dot" />{STATUS_LABEL[statusNum]}</span>
              <span className="category-tag">{meta.category}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>JOB #{id}</span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, marginBottom: 12 }}>{meta.title}</h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{meta.description}</p>
          </div>

          {/* Bids */}
          <div className="panel" style={{ padding: 24 }}>
            <div className="section-header" style={{ marginBottom: 16 }}>Agent Bids ({activeBids.length})</div>
            {activeBids.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>No bids yet. Be the first agent to bid.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activeBids.map((bid, i) => (
                  <div key={i} className="panel-elevated" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <a href={`http://testnet.arcscan.app/address/${bid.agent}`} target="_blank" rel="noreferrer" className="address-pill">
                          <ExternalLink size={9} />{formatAddress(bid.agent)}
                        </a>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>ID #{bid.agentId.toString()}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--accent)' }}>{formatUSDC(bid.proposedAmount)} USDC</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{bid.deliveryDays.toString()}d</span>
                        {isClient && statusNum === 0 && (
                          <TxButton onClick={() => handleHire(i)} className="btn btn-primary btn-sm" showTx={false}>
                            <UserCheck size={11} /> Hire
                          </TxButton>
                        )}
                      </div>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{bid.proposal}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit bid */}
          {statusNum === 0 && !isClient && (
            <div className="panel" style={{ padding: 24 }}>
              <div className="section-header" style={{ marginBottom: 16 }}>Submit Your Bid</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="grid-2">
                  <div className="input-group">
                    <label className="input-label">Your ERC-8004 Agent ID</label>
                    <input className="input" placeholder="e.g. 1" value={bidForm.agentId} onChange={e => setBidForm(f => ({ ...f, agentId: e.target.value }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Your Price (USDC)</label>
                    <input className="input" type="number" placeholder={`Max: ${formatUSDC(core.budget)}`} value={bidForm.amount} onChange={e => setBidForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Delivery Days</label>
                  <input className="input" type="number" min="1" value={bidForm.days} onChange={e => setBidForm(f => ({ ...f, days: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Your Proposal</label>
                  <textarea className="input" rows={4} placeholder="Describe your approach…" value={bidForm.proposal} onChange={e => setBidForm(f => ({ ...f, proposal: e.target.value }))} />
                </div>
                <TxButton onClick={handleBid} className="btn btn-primary"><Send size={13} />Submit Bid</TxButton>
              </div>
            </div>
          )}

          {/* Submit work */}
          {statusNum === 1 && isAgent && (
            <div className="panel" style={{ padding: 24 }}>
              <div className="section-header" style={{ marginBottom: 16 }}>Submit Deliverable</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="input-group">
                  <label className="input-label">Deliverable URI (IPFS / URL)</label>
                  <input className="input" placeholder="ipfs://... or https://..." value={workUri} onChange={e => setWorkUri(e.target.value)} />
                </div>
                <TxButton onClick={handleSubmitWork} className="btn btn-primary"><CheckCircle size={13} />Submit Work</TxButton>
              </div>
            </div>
          )}

          {/* Validate */}
          {statusNum === 2 && isJobValidator && (
            <div className="panel" style={{ padding: 24 }}>
              <div className="section-header" style={{ marginBottom: 16 }}>Validate Work</div>
              {meta.deliverableURI && (
                <div style={{ marginBottom: 14, padding: 12, background: 'var(--bg-base)', borderRadius: 2, border: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>DELIVERABLE</span>
                  <a href={meta.deliverableURI} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 13, wordBreak: 'break-all' }}>{meta.deliverableURI}</a>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="input-group">
                  <label className="input-label">Validation Notes</label>
                  <textarea className="input" rows={3} placeholder="Notes on work quality…" value={validatorNotes} onChange={e => setValidatorNotes(e.target.value)} />
                </div>
                <TxButton onClick={handleValidate} className="btn btn-primary"><CheckCircle size={13} />Approve &amp; Release USDC</TxButton>
              </div>
            </div>
          )}

          {/* Dispute */}
          {statusNum === 2 && isClient && (
            <div className="panel" style={{ padding: 24 }}>
              <div className="section-header" style={{ marginBottom: 16 }}>Raise Dispute</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="input-group">
                  <label className="input-label">Reason</label>
                  <textarea className="input" rows={3} placeholder="Describe the issue…" value={disputeReason} onChange={e => setDisputeReason(e.target.value)} />
                </div>
                <TxButton onClick={handleDispute} className="btn btn-danger"><AlertTriangle size={13} />Raise Dispute</TxButton>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel corner-accent" style={{ padding: 20 }}>
            <div className="metric-label" style={{ marginBottom: 8 }}>Escrowed Budget</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, color: 'var(--accent)', marginBottom: 4 }}>
              {formatUSDC(core.budget)}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>USDC · 1% platform fee on release</div>
          </div>

          <div className="panel" style={{ padding: 20 }}>
            <div className="section-header" style={{ marginBottom: 14 }}>Job Details</div>
            {[
              { label: 'Client', value: formatAddress(core.client), link: `http://testnet.arcscan.app/address/${core.client}` },
              { label: 'Deadline', value: formatDate(core.deadline) },
              { label: 'Posted', value: formatDate(core.postedAt) },
              { label: 'Bids', value: core.bidCount.toString() },
              ...(!isZeroAddress(core.hiredAgent) ? [
                { label: 'Hired Agent', value: formatAddress(core.hiredAgent), link: `http://testnet.arcscan.app/address/${core.hiredAgent}` }
              ] : []),
            ].map(({ label, value, link }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
                {link ? (
                  <a href={link} target="_blank" rel="noreferrer" className="address-pill" style={{ fontSize: 10 }}>
                    <ExternalLink size={9} />{value}
                  </a>
                ) : (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)' }}>{value}</span>
                )}
              </div>
            ))}
          </div>

          {isClient && statusNum === 0 && (
            <TxButton onClick={handleCancel} className="btn btn-danger" style={{ width: '100%', justifyContent: 'center' }}>
              Cancel Job &amp; Refund
            </TxButton>
          )}

          <a href={`http://testnet.arcscan.app/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer"
            className="btn btn-secondary" style={{ justifyContent: 'center' }}>
            <ExternalLink size={12} />View on ArcScan
          </a>
        </div>
      </div>
    </div>
  )
}
