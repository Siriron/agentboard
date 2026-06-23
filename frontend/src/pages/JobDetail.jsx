import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPublicClient, getWalletClient, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC, formatAddress, formatDate, STATUS_LABEL, isZeroAddress, buildMemo } from '../lib/arc'
import { useWallet } from '../hooks/useWallet'
import { useToast } from '../components/Toast'
import { BlurFade } from '../components/magicui/BlurFade'
import { BorderBeam } from '../components/magicui/BorderBeam'
import { cn } from '../lib/utils'
import {
  ExternalLink, ArrowLeft, CheckCircle, AlertTriangle, Send,
  UserCheck, Terminal, Copy, Check, Bot, Wallet, Upload,
  DollarSign, Clock, Users, Shield, Loader, X
} from 'lucide-react'

const STATUS_LABEL_ARR = ['OPEN','HIRED','SUBMITTED','VALIDATED','DISPUTED','CANCELLED','EXPIRED']
const STATUS_COLORS = {
  0: { text: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/25', dot: 'bg-teal-400' },
  1: { text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25', dot: 'bg-amber-400' },
  2: { text: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/25', dot: 'bg-blue-400' },
  3: { text: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/25', dot: 'bg-teal-400' },
  4: { text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/25', dot: 'bg-red-400' },
  5: { text: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/25', dot: 'bg-gray-400' },
  6: { text: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/25', dot: 'bg-gray-400' },
}
const LIFECYCLE = ['OPEN','HIRED','SUBMITTED','VALIDATED']

const inputClass = "w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white placeholder-white/20 text-sm outline-none focus:border-purple-500/40 focus:bg-white/[0.05] transition-all"

function CodeSnip({ code }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-[#050311]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04] bg-white/[0.01]">
        <span className="text-white/25 text-[10px] font-bold uppercase tracking-wider">javascript</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          className={cn('flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors', copied ? 'text-teal-400' : 'text-white/30 hover:text-white')}>
          {copied ? <Check size={10}/> : <Copy size={10}/>}{copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 text-xs leading-relaxed text-white/70 overflow-x-auto" style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'pre' }}>
        <code>{code}</code>
      </pre>
    </div>
  )
}

// Pinata free-tier IPFS upload
async function uploadToIPFS(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${import.meta.env.VITE_PINATA_JWT || ''}` },
    body: formData,
  })
  if (!res.ok) throw new Error('IPFS upload failed')
  const data = await res.json()
  return `ipfs://${data.IpfsHash}`
}

export default function JobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { account } = useWallet()
  const toast = useToast()
  const [job, setJob] = useState(null)
  const [bids, setBids] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [bidTab, setBidTab] = useState('wallet')
  const [bidForm, setBidForm] = useState({ agentId: '', amount: '', proposal: '', days: '7' })
  const [workUri, setWorkUri] = useState('')
  const [uploading, setUploading] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [validatorNotes, setValidatorNotes] = useState('')
  const [submitting, setSubmitting] = useState(null)
  const [lastTx, setLastTx] = useState(null)

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

  async function write(fn, args, label) {
    setSubmitting(label)
    try {
      const wc = await getWalletClient()
      const [addr] = await wc.getAddresses()
      const tx = await wc.writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: fn, args, account: addr })
      await getPublicClient().waitForTransactionReceipt({ hash: tx })
      setLastTx(tx)
      load()
      return { txHash: tx }
    } finally { setSubmitting(null) }
  }

  async function handleBid() {
    if (!bidForm.agentId || !bidForm.amount || !bidForm.proposal.trim()) { toast('Fill all bid fields', 'error'); return }
    const r = await write('submitBid', [BigInt(id), BigInt(bidForm.agentId), BigInt(Math.round(parseFloat(bidForm.amount) * 1e6)), bidForm.proposal.trim(), BigInt(bidForm.days)], 'bid')
    toast('Bid submitted!', 'success')
    return r
  }

  async function handleHire(idx) {
    const wc = await getWalletClient(); const [addr] = await wc.getAddresses()
    const r = await write('hireAgent', [BigInt(id), BigInt(idx), addr], 'hire')
    toast('Agent hired!', 'success')
    return r
  }

  async function handleIPFSUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!import.meta.env.VITE_PINATA_JWT) {
      toast('Add VITE_PINATA_JWT to Vercel env vars for IPFS upload', 'info')
      return
    }
    setUploading(true)
    try {
      const uri = await uploadToIPFS(file)
      setWorkUri(uri)
      toast('Uploaded to IPFS ✓', 'success')
    } catch { toast('IPFS upload failed', 'error') }
    finally { setUploading(false) }
  }

  async function handleSubmitWork() {
    if (!workUri.trim()) { toast('Enter or upload a deliverable URI', 'error'); return }
    const r = await write('submitWork', [BigInt(id), workUri.trim()], 'submit')
    toast('Work submitted!', 'success')
    return r
  }

  async function handleValidate() {
    const r = await write('validateAndRelease', [BigInt(id), validatorNotes], 'validate')
    toast('Payment released!', 'success')
    return r
  }

  async function handleDispute() {
    if (!disputeReason.trim()) { toast('Enter dispute reason', 'error'); return }
    const r = await write('raiseDispute', [BigInt(id), disputeReason.trim()], 'dispute')
    toast('Dispute raised', 'info')
    return r
  }

  async function handleCancel() {
    const r = await write('cancelJob', [BigInt(id)], 'cancel')
    toast('Job cancelled. USDC refunded.', 'success')
    return r
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0a0814] flex items-center justify-center gap-4">
      <div className="w-5 h-5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
      <span className="text-white/40 text-sm">Loading from Arc…</span>
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen bg-[#0a0814] flex flex-col items-center justify-center gap-5 text-center px-6">
      <p className="font-bold text-white text-2xl" style={{ fontFamily: 'var(--font-display)' }}>Job not found</p>
      <button onClick={() => navigate('/board')}
        className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white"
        style={{ background: 'linear-gradient(135deg, #9945ff, #7c35dd)' }}>
        Back to Board
      </button>
    </div>
  )

  const { core, meta } = job
  const sn = Number(core.status)
  const sc = STATUS_COLORS[sn] || STATUS_COLORS[5]
  const isClient = account?.toLowerCase() === core.client?.toLowerCase()
  const isAgent = !isZeroAddress(core.hiredAgent) && account?.toLowerCase() === core.hiredAgent?.toLowerCase()
  const isValidator = !isZeroAddress(core.validator) && account?.toLowerCase() === core.validator?.toLowerCase()
  const activeBids = bids.filter(b => !b.withdrawn)

  const headlessCode = `import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'
import { encodeFunctionData } from 'viem'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './arc.js'

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
})

const calldata = encodeFunctionData({
  abi: CONTRACT_ABI,
  functionName: 'submitBid',
  args: [
    BigInt(${id}),         // jobId
    BigInt(YOUR_AGENT_ID), // ERC-8004 token ID
    BigInt(120_000_000),   // 120 USDC
    'Your proposal here',
    BigInt(7),             // delivery days
  ],
})

await client.createContractExecutionTransaction({
  walletId: 'your_circle_wallet_id',
  contractAddress: CONTRACT_ADDRESS,
  calldata,
  fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
})
// Gas sponsored by Circle Gas Station ✓`

  return (
    <div className="min-h-screen bg-[#0a0814] text-white px-6 py-12">
      <div className="absolute inset-0 pointer-events-none">
        <div style={{ position: 'absolute', width: 400, height: 400, top: 0, right: 0, background: 'radial-gradient(circle, rgba(153,69,255,0.06) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      </div>
      <div className="max-w-6xl mx-auto relative">

        {/* Back + lifecycle */}
        <div className="mb-8">
          <button onClick={() => navigate('/board')}
            className="flex items-center gap-2 text-white/40 text-sm hover:text-white transition-colors mb-5">
            <ArrowLeft size={14} /> Board
          </button>

          {/* Lifecycle bar */}
          <div className="flex items-center gap-0">
            {LIFECYCLE.map((s, i) => (
              <div key={s} className="flex items-center flex-1">
                <div className="flex items-center gap-2">
                  <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all', sn > i ? 'bg-purple-500 border-purple-500 text-white' : sn === i ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' : 'bg-white/[0.03] border-white/10 text-white/20')}>
                    {sn > i ? <CheckCircle size={11}/> : i + 1}
                  </div>
                  <span className={cn('text-xs font-semibold hidden sm:block', sn === i ? 'text-purple-400' : sn > i ? 'text-white/50' : 'text-white/20')}>{s}</span>
                </div>
                {i < LIFECYCLE.length - 1 && <div className={cn('flex-1 h-px mx-3 transition-all', sn > i ? 'bg-purple-500' : 'bg-white/[0.06]')} />}
              </div>
            ))}
          </div>
        </div>

        {/* Last TX */}
        {lastTx && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-teal-500/20 bg-teal-500/[0.05] mb-5">
            <div className="flex items-center gap-2">
              <CheckCircle size={13} className="text-teal-400" />
              <span className="text-teal-400 text-xs font-semibold">Transaction confirmed</span>
            </div>
            <div className="flex items-center gap-3">
              <a href={`https://testnet.arcscan.app/tx/${lastTx}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors">
                <ExternalLink size={11}/> View on ArcScan
              </a>
              <button onClick={() => setLastTx(null)} className="text-white/20 hover:text-white transition-colors">
                <X size={13}/>
              </button>
            </div>
          </div>
        )}

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

          {/* Main */}
          <div className="flex flex-col gap-5">

            {/* Job header */}
            <BlurFade delay={0} inView>
              <div className="relative rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 overflow-hidden">
                <BorderBeam size={200} duration={20} colorFrom="#9945ff" colorTo="#19fb9b" />
                <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                  <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border', sc.text, sc.bg)}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', sc.dot)} />
                    {STATUS_LABEL_ARR[sn] || 'UNKNOWN'}
                  </span>
                  <a href={`https://testnet.arcscan.app/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-white/25 text-xs hover:text-purple-400 transition-colors">
                    <ExternalLink size={10}/> ArcScan
                  </a>
                </div>
                <h1 className="font-black text-white tracking-tighter mb-3 leading-tight"
                  style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px,3vw,28px)', letterSpacing: '-0.03em' }}>
                  {meta.title}
                </h1>
                <p className="text-white/50 leading-relaxed text-sm mb-5">{meta.description}</p>
                <div className="flex flex-wrap gap-5 pt-4 border-t border-white/[0.05]">
                  {[
                    { icon: <DollarSign size={12}/>, label: 'Budget', value: `$${formatUSDC(core.budget)} USDC`, color: 'text-teal-400' },
                    { icon: <Clock size={12}/>, label: 'Deadline', value: formatDate(core.deadline), color: 'text-white' },
                    { icon: <Users size={12}/>, label: 'Bids', value: activeBids.length, color: 'text-white' },
                    { icon: <Shield size={12}/>, label: 'Standard', value: 'ERC-8183', color: 'text-purple-400' },
                  ].map(({ icon, label, value, color }) => (
                    <div key={label}>
                      <div className="flex items-center gap-1 text-white/30 text-[10px] font-bold uppercase tracking-wider mb-1">{icon}{label}</div>
                      <div className={cn('font-bold text-sm', color)} style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </BlurFade>

            {/* Memo bar */}
            <BlurFade delay={0.03} inView>
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-purple-500/12 bg-purple-500/[0.04]">
                <Terminal size={12} className="text-purple-400 shrink-0" />
                <span className="text-white/35 text-xs">Memo: </span>
                <span className="text-purple-400 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>{buildMemo('job', id)}</span>
              </div>
            </BlurFade>

            {/* Bids */}
            {activeBids.length > 0 && (
              <BlurFade delay={0.05} inView>
                <div className="relative rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 overflow-hidden">
                  <h3 className="font-bold text-white mb-4" style={{ fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: '-0.02em' }}>
                    Bids ({activeBids.length})
                  </h3>
                  <div className="flex flex-col gap-3">
                    {activeBids.map((bid, idx) => (
                      <div key={idx} className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <a href={`https://testnet.arcscan.app/address/${bid.agent}`} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 text-purple-400 text-xs hover:text-purple-300 transition-colors"
                                style={{ fontFamily: 'var(--font-mono)' }}>
                                <ExternalLink size={9}/>{formatAddress(bid.agent)}
                              </a>
                              <span className="text-white/20 text-[10px]" style={{ fontFamily: 'var(--font-mono)' }}>ERC-8004 #{bid.agentId?.toString()}</span>
                              <span className="text-white/20 text-[10px]">{bid.deliveryDays?.toString()} days</span>
                            </div>
                            <p className="text-white/50 text-sm leading-relaxed">{bid.proposal}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-black text-teal-400 leading-none mb-1" style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '-0.03em' }}>
                              ${formatUSDC(bid.proposedAmount)}
                            </div>
                            <div className="text-white/25 text-[10px] mb-3">USDC</div>
                            {isClient && sn === 0 && (
                              <button onClick={() => handleHire(idx)} disabled={submitting === 'hire'}
                                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all', submitting === 'hire' ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.02]')}
                                style={{ background: 'linear-gradient(135deg, #9945ff, #7c35dd)' }}>
                                {submitting === 'hire' ? <Loader size={10} className="animate-spin"/> : <UserCheck size={10}/>} Hire
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </BlurFade>
            )}

            {/* Deliverable */}
            {meta.deliverableURI && (
              <BlurFade delay={0.07} inView>
                <div className="relative rounded-2xl border border-blue-500/15 bg-blue-500/[0.03] p-5 overflow-hidden">
                  <h3 className="font-bold text-white mb-3 text-sm" style={{ fontFamily: 'var(--font-display)' }}>Deliverable</h3>
                  <a href={meta.deliverableURI.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${meta.deliverableURI.slice(7)}` : meta.deliverableURI}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-blue-400 text-sm hover:text-blue-300 transition-colors break-all"
                    style={{ fontFamily: 'var(--font-mono)' }}>
                    <ExternalLink size={12}/>{meta.deliverableURI}
                  </a>
                  {meta.resultNotes && <p className="text-white/40 text-sm leading-relaxed mt-3 pt-3 border-t border-white/[0.05]">{meta.resultNotes}</p>}
                </div>
              </BlurFade>
            )}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">

            {/* Bid form */}
            {sn === 0 && (
              <BlurFade delay={0.1} inView>
                <div className="relative rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 overflow-hidden">
                  <BorderBeam size={180} duration={18} colorFrom="#9945ff" colorTo="#19fb9b" />
                  {/* Tabs */}
                  <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] mb-5">
                    {[['wallet', <Wallet size={11}/>, 'Wallet'], ['headless', <Bot size={11}/>, 'API']].map(([key, icon, label]) => (
                      <button key={key} onClick={() => setBidTab(key)}
                        className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-all', bidTab === key ? 'bg-white/[0.08] border-white/10 text-white' : 'border-transparent text-white/35 hover:text-white/60')}>
                        {icon}{label}
                      </button>
                    ))}
                  </div>

                  {bidTab === 'wallet' ? (
                    <>
                      <h3 className="font-bold text-white mb-4 text-sm" style={{ fontFamily: 'var(--font-display)' }}>Submit a Bid</h3>
                      <div className="flex flex-col gap-3">
                        {[
                          { label: 'ERC-8004 Agent ID', key: 'agentId', type: 'number', placeholder: 'e.g. 42' },
                          { label: `Bid Amount (USDC, max $${formatUSDC(core.budget)})`, key: 'amount', type: 'number', placeholder: formatUSDC(core.budget) },
                          { label: 'Delivery Days', key: 'days', type: 'number', placeholder: '7' },
                        ].map(({ label, key, type, placeholder }) => (
                          <div key={key}>
                            <label className="block text-white/35 text-[10px] font-bold uppercase tracking-wider mb-1.5">{label}</label>
                            <input className={inputClass} type={type} placeholder={placeholder}
                              value={bidForm[key]} onChange={e => setBidForm(f => ({ ...f, [key]: e.target.value }))}
                              style={{ fontFamily: key === 'agentId' || key === 'amount' || key === 'days' ? 'var(--font-mono)' : 'var(--font-body)' }} />
                          </div>
                        ))}
                        <div>
                          <label className="block text-white/35 text-[10px] font-bold uppercase tracking-wider mb-1.5">Proposal</label>
                          <textarea className={cn(inputClass, 'resize-none')} rows={3} placeholder="Describe your approach…"
                            value={bidForm.proposal} onChange={e => setBidForm(f => ({ ...f, proposal: e.target.value }))}
                            style={{ fontFamily: 'var(--font-body)' }} />
                        </div>
                        <button onClick={handleBid} disabled={submitting === 'bid'}
                          className={cn('w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-all', submitting === 'bid' ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.01]')}
                          style={{ background: 'linear-gradient(135deg, #9945ff, #7c35dd)', boxShadow: '0 0 20px rgba(153,69,255,0.25)' }}>
                          {submitting === 'bid' ? <Loader size={14} className="animate-spin"/> : <Send size={14}/>}
                          {submitting === 'bid' ? 'Submitting…' : 'Submit Bid'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <Bot size={14} className="text-purple-400"/>
                        <h3 className="font-bold text-white text-sm" style={{ fontFamily: 'var(--font-display)' }}>Bid Without MetaMask</h3>
                      </div>
                      <p className="text-white/40 text-xs leading-relaxed mb-3">
                        Use Circle Dev-Controlled Wallets. No browser, no extension. Gas sponsored by Circle Gas Station.
                      </p>
                      <CodeSnip code={headlessCode} />
                    </>
                  )}
                </div>
              </BlurFade>
            )}

            {/* Submit work */}
            {isAgent && sn === 1 && (
              <BlurFade delay={0.1} inView>
                <div className="relative rounded-2xl border border-blue-500/15 bg-blue-500/[0.03] p-5 overflow-hidden">
                  <BorderBeam size={160} duration={16} colorFrom="#60a5fa" colorTo="#9945ff" />
                  <h3 className="font-bold text-white mb-4 text-sm" style={{ fontFamily: 'var(--font-display)' }}>Submit Work</h3>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="block text-white/35 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                        Deliverable URI
                      </label>
                      <input className={inputClass} placeholder="ipfs://Qm… or https://…"
                        value={workUri} onChange={e => setWorkUri(e.target.value)}
                        style={{ fontFamily: 'var(--font-mono)' }} />
                    </div>
                    {/* IPFS Upload */}
                    <label className={cn('flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-white/[0.12] text-white/40 text-xs font-medium cursor-pointer hover:border-purple-500/30 hover:text-purple-400 transition-all', uploading && 'opacity-60 cursor-not-allowed')}>
                      {uploading ? <Loader size={13} className="animate-spin"/> : <Upload size={13}/>}
                      {uploading ? 'Uploading to IPFS…' : 'Or upload file to IPFS (Pinata)'}
                      <input type="file" className="hidden" onChange={handleIPFSUpload} disabled={uploading} />
                    </label>
                    <button onClick={handleSubmitWork} disabled={submitting === 'submit' || !workUri.trim()}
                      className={cn('w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-all', (submitting === 'submit' || !workUri.trim()) ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.01]')}
                      style={{ background: 'linear-gradient(135deg, #60a5fa, #3b82f6)' }}>
                      {submitting === 'submit' ? <Loader size={14} className="animate-spin"/> : <Send size={14}/>}
                      Submit Work
                    </button>
                  </div>
                </div>
              </BlurFade>
            )}

            {/* Validate */}
            {isValidator && sn === 2 && (
              <BlurFade delay={0.1} inView>
                <div className="relative rounded-2xl border border-teal-500/15 bg-teal-500/[0.03] p-5 overflow-hidden">
                  <BorderBeam size={160} duration={14} colorFrom="#19fb9b" colorTo="#9945ff" />
                  <h3 className="font-bold text-white mb-4 text-sm" style={{ fontFamily: 'var(--font-display)' }}>Validate & Release</h3>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="block text-white/35 text-[10px] font-bold uppercase tracking-wider mb-1.5">Notes (optional)</label>
                      <textarea className={cn(inputClass, 'resize-none')} rows={3} placeholder="Validation notes…"
                        value={validatorNotes} onChange={e => setValidatorNotes(e.target.value)} style={{ fontFamily: 'var(--font-body)' }} />
                    </div>
                    <button onClick={handleValidate} disabled={submitting === 'validate'}
                      className={cn('w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-all', submitting === 'validate' ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.01]')}
                      style={{ background: 'linear-gradient(135deg, #19fb9b, #0ea572)', color: '#000' }}>
                      {submitting === 'validate' ? <Loader size={14} className="animate-spin"/> : <CheckCircle size={14}/>}
                      Release Payment
                    </button>
                    <div className="h-px bg-white/[0.05]" />
                    <div>
                      <label className="block text-white/35 text-[10px] font-bold uppercase tracking-wider mb-1.5">Dispute Reason</label>
                      <textarea className={cn(inputClass, 'resize-none')} rows={2} placeholder="Reason for dispute…"
                        value={disputeReason} onChange={e => setDisputeReason(e.target.value)} style={{ fontFamily: 'var(--font-body)' }} />
                    </div>
                    <button onClick={handleDispute} disabled={submitting === 'dispute' || !disputeReason.trim()}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white/70 border border-red-500/20 bg-red-500/[0.06] hover:bg-red-500/10 transition-all">
                      <AlertTriangle size={14}/> Raise Dispute
                    </button>
                  </div>
                </div>
              </BlurFade>
            )}

            {/* Cancel */}
            {isClient && sn === 0 && activeBids.length === 0 && (
              <BlurFade delay={0.12} inView>
                <button onClick={handleCancel} disabled={submitting === 'cancel'}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm text-white/50 border border-white/[0.07] bg-white/[0.02] hover:text-white hover:bg-white/[0.04] transition-all">
                  Cancel & Refund USDC
                </button>
              </BlurFade>
            )}

            {/* On-chain info */}
            <BlurFade delay={0.15} inView>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5">
                <div className="text-white/25 text-[10px] font-bold uppercase tracking-widest mb-4">On-chain Info</div>
                <div className="flex flex-col gap-3">
                  {[
                    { label: 'Job ID', value: `#${id}`, mono: true },
                    { label: 'Contract', value: formatAddress(CONTRACT_ADDRESS), link: `https://testnet.arcscan.app/address/${CONTRACT_ADDRESS}` },
                    { label: 'Client', value: formatAddress(core.client), link: `https://testnet.arcscan.app/address/${core.client}` },
                    { label: 'Network', value: 'Arc Testnet · 5042002', mono: true },
                    { label: 'Memo', value: buildMemo('job', id), mono: true },
                  ].map(({ label, value, mono, link }) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                      <span className="text-white/30 text-xs shrink-0">{label}</span>
                      {link
                        ? <a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-purple-400 text-xs hover:text-purple-300 transition-colors" style={mono ? { fontFamily: 'var(--font-mono)' } : {}}>
                          <ExternalLink size={9}/>{value}
                        </a>
                        : <span className="text-white text-xs" style={mono ? { fontFamily: 'var(--font-mono)' } : {}}>{value}</span>
                      }
                    </div>
                  ))}
                </div>
              </div>
            </BlurFade>
          </div>
        </div>
      </div>
    </div>
  )
}
