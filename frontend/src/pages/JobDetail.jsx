import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPublicClient, getWalletClient, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC, formatAddress, formatDate, STATUS_LABEL, isZeroAddress } from '../lib/arc'
import { useWallet } from '../hooks/useWallet'
import { useToast } from '../components/Toast'
import TxButton from '../components/TxButton'
import { ExternalLink, ArrowLeft, CheckCircle, AlertTriangle, Send, UserCheck } from 'lucide-react'

const STATUS_CLASS = ['open','hired','submitted','validated','disputed','cancelled','expired']
const LIFECYCLE = ['OPEN','HIRED','SUBMITTED','VALIDATED']

export default function JobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { account } = useWallet()
  const toast = useToast()
  const [job, setJob] = useState(null)
  const [bids, setBids] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [bidForm, setBidForm] = useState({ agentId:'', amount:'', proposal:'', days:'7' })
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

  const write = async (fn, args) => {
    const wc = await getWalletClient()
    const [addr] = await wc.getAddresses()
    const tx = await wc.writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: fn, args, account: addr })
    await getPublicClient().waitForTransactionReceipt({ hash: tx })
    load(); return { txHash: tx }
  }

  async function handleBid() {
    if (!bidForm.agentId||!bidForm.amount||!bidForm.proposal.trim()) { toast('Fill all bid fields','error'); return }
    toast('Submitting bid…','info')
    const r = await write('submitBid',[BigInt(id),BigInt(bidForm.agentId),BigInt(Math.round(parseFloat(bidForm.amount)*1e6)),bidForm.proposal.trim(),BigInt(bidForm.days)])
    toast('Bid submitted!','success'); return r
  }
  async function handleHire(idx) {
    const wc = await getWalletClient(); const [addr] = await wc.getAddresses()
    toast('Hiring agent…','info')
    const r = await write('hireAgent',[BigInt(id),BigInt(idx),addr])
    toast('Agent hired!','success'); return r
  }
  async function handleSubmitWork() {
    if (!workUri.trim()) { toast('Enter deliverable URI','error'); return }
    const r = await write('submitWork',[BigInt(id),workUri.trim()])
    toast('Work submitted!','success'); return r
  }
  async function handleValidate() {
    const r = await write('validateAndRelease',[BigInt(id),validatorNotes])
    toast('Payment released!','success'); return r
  }
  async function handleDispute() {
    if (!disputeReason.trim()) { toast('Enter dispute reason','error'); return }
    const r = await write('raiseDispute',[BigInt(id),disputeReason.trim()])
    toast('Dispute raised','info'); return r
  }
  async function handleCancel() {
    const r = await write('cancelJob',[BigInt(id)])
    toast('Job cancelled. USDC refunded.','success'); return r
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, gap:12 }}>
      <span className="spinner" style={{ width:24, height:24 }} />
      <span style={{ color:'var(--text-2)' }}>Loading job from Arc…</span>
    </div>
  )
  if (notFound) return (
    <div style={{ textAlign:'center', padding:80 }}>
      <p style={{ fontWeight:700, fontSize:20, marginBottom:12, letterSpacing:'-0.02em' }}>Job not found</p>
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
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/board')} style={{ marginBottom:24 }}>
        <ArrowLeft size={13} /> Board
      </button>

      {/* Lifecycle bar */}
      <div className="lifecycle-bar" style={{ marginBottom:24 }}>
        {LIFECYCLE.map((s,i) => (
          <div key={s} className={`lifecycle-step ${sn===i?'active':sn>i?'done':''}`}>
            {sn>i ? <CheckCircle size={10} style={{display:'inline',marginRight:4}} /> : null}{s}
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 300px', gap:20, alignItems:'start' }}>
        {/* Main */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="glass-card" style={{ padding:28 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18, flexWrap:'wrap' }}>
              <span className={`badge badge-${STATUS_CLASS[sn]}`}><span className="badge-dot" />{STATUS_LABEL[sn]}</span>
              <span className="tag">{meta.category}</span>
              <span style={{ marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-3)' }}>Job #{id}</span>
            </div>
            <h1 style={{ fontWeight:800, fontSize:'clamp(20px,3vw,28px)', letterSpacing:'-0.03em', marginBottom:14 }}>
              <span className="grad-text">{meta.title}</span>
            </h1>
            <p style={{ color:'var(--text-2)', lineHeight:1.7, fontSize:14 }}>{meta.description}</p>
          </div>

          {/* Bids */}
          <div className="glass-card" style={{ padding:24 }}>
            <div className="section-label" style={{ marginBottom:16 }}>Bids ({activeBids.length})</div>
            {activeBids.length === 0 ? (
              <p style={{ color:'var(--text-3)', fontSize:13 }}>No bids yet — be the first agent to bid.</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {activeBids.map((bid,i) => (
                  <div key={i} className="card-inset" style={{ padding:16 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, flexWrap:'wrap', gap:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <a href={`https://testnet.arcscan.app/address/${bid.agent}`} target="_blank" rel="noreferrer" className="address-pill"><ExternalLink size={9}/>{formatAddress(bid.agent)}</a>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-3)' }}>#{bid.agentId.toString()}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontWeight:800, fontSize:16, letterSpacing:'-0.02em' }}>${formatUSDC(bid.proposedAmount)}</span>
                        <span style={{ fontSize:12, color:'var(--text-3)' }}>{bid.deliveryDays.toString()}d</span>
                        {isClient && sn===0 && (
                          <TxButton onClick={() => handleHire(i)} className="btn btn-primary btn-sm" showTx={false}>
                            <UserCheck size={11}/> Hire
                          </TxButton>
                        )}
                      </div>
                    </div>
                    <p style={{ color:'var(--text-2)', fontSize:13, lineHeight:1.5 }}>{bid.proposal}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit bid */}
          {sn===0 && !isClient && account && (
            <div className="glass-card" style={{ padding:24 }}>
              <div className="section-label" style={{ marginBottom:16 }}>Submit a Bid</div>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div className="grid-2">
                  <div className="input-group"><label className="input-label">Agent ID (ERC-8004)</label><input className="input" placeholder="e.g. 1" value={bidForm.agentId} onChange={e=>setBidForm(f=>({...f,agentId:e.target.value}))}/></div>
                  <div className="input-group"><label className="input-label">Price (USDC)</label><input className="input" type="number" placeholder={`Max $${formatUSDC(core.budget)}`} value={bidForm.amount} onChange={e=>setBidForm(f=>({...f,amount:e.target.value}))}/></div>
                </div>
                <div className="input-group"><label className="input-label">Delivery Days</label><input className="input" type="number" min="1" value={bidForm.days} onChange={e=>setBidForm(f=>({...f,days:e.target.value}))}/></div>
                <div className="input-group"><label className="input-label">Proposal</label><textarea className="input" rows={4} placeholder="Describe your approach and why you're the right agent…" value={bidForm.proposal} onChange={e=>setBidForm(f=>({...f,proposal:e.target.value}))}/></div>
                <TxButton onClick={handleBid} className="btn btn-primary"><Send size={13}/>Submit Bid</TxButton>
              </div>
            </div>
          )}

          {/* Submit work */}
          {sn===1 && isAgent && (
            <div className="glass-card" style={{ padding:24 }}>
              <div className="section-label" style={{ marginBottom:16 }}>Submit Deliverable</div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div className="input-group"><label className="input-label">Deliverable URI</label><input className="input" placeholder="ipfs://... or https://..." value={workUri} onChange={e=>setWorkUri(e.target.value)}/></div>
                <TxButton onClick={handleSubmitWork} className="btn btn-primary"><CheckCircle size={13}/>Submit Work</TxButton>
              </div>
            </div>
          )}

          {/* Validate */}
          {sn===2 && isValidator && (
            <div className="glass-card" style={{ padding:24 }}>
              <div className="section-label" style={{ marginBottom:16 }}>Validate & Release Payment</div>
              {meta.deliverableURI && (
                <div style={{ marginBottom:14, padding:12, background:'var(--surface-1)', borderRadius:8, border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Deliverable</div>
                  <a href={meta.deliverableURI} target="_blank" rel="noreferrer" style={{ color:'#818cf8', fontSize:13, wordBreak:'break-all' }}>{meta.deliverableURI}</a>
                </div>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div className="input-group"><label className="input-label">Validation Notes</label><textarea className="input" rows={3} placeholder="Notes on work quality…" value={validatorNotes} onChange={e=>setValidatorNotes(e.target.value)}/></div>
                <TxButton onClick={handleValidate} className="btn btn-primary"><CheckCircle size={13}/>Approve &amp; Release USDC</TxButton>
              </div>
            </div>
          )}

          {/* Dispute */}
          {sn===2 && isClient && (
            <div className="glass-card" style={{ padding:24 }}>
              <div className="section-label" style={{ marginBottom:16 }}>Raise a Dispute</div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div className="input-group"><label className="input-label">Reason</label><textarea className="input" rows={3} placeholder="Describe the issue…" value={disputeReason} onChange={e=>setDisputeReason(e.target.value)}/></div>
                <TxButton onClick={handleDispute} className="btn btn-danger"><AlertTriangle size={13}/>Raise Dispute</TxButton>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="glass-card" style={{ padding:22, background:'rgba(99,102,241,0.06)', borderColor:'rgba(99,102,241,0.15)' }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Escrowed Budget</div>
            <div style={{ fontWeight:800, fontSize:36, letterSpacing:'-0.04em', marginBottom:4 }}>${formatUSDC(core.budget)}</div>
            <div style={{ fontSize:12, color:'var(--text-3)' }}>USDC · 1% platform fee on release</div>
          </div>

          <div className="glass-card" style={{ padding:22 }}>
            <div className="section-label" style={{ marginBottom:14 }}>Details</div>
            {[
              {label:'Client',value:formatAddress(core.client),link:`https://testnet.arcscan.app/address/${core.client}`},
              {label:'Deadline',value:formatDate(core.deadline)},
              {label:'Posted',value:formatDate(core.postedAt)},
              {label:'Bids',value:core.bidCount.toString()},
              ...(!isZeroAddress(core.hiredAgent)?[{label:'Agent',value:formatAddress(core.hiredAgent),link:`https://testnet.arcscan.app/address/${core.hiredAgent}`}]:[]),
            ].map(({label,value,link}) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:12, fontWeight:500, color:'var(--text-3)' }}>{label}</span>
                {link ? <a href={link} target="_blank" rel="noreferrer" className="address-pill" style={{fontSize:10}}><ExternalLink size={9}/>{value}</a>
                  : <span style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{value}</span>}
              </div>
            ))}
          </div>

          {isClient && sn===0 && (
            <TxButton onClick={handleCancel} className="btn btn-danger w-full">Cancel &amp; Refund</TxButton>
          )}

          <a href={`https://testnet.arcscan.app/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer"
            className="btn btn-secondary" style={{ justifyContent:'center' }}>
            <ExternalLink size={13}/> View on ArcScan
          </a>
        </div>
      </div>

      <style>{`@media(max-width:700px){.job-grid{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}
