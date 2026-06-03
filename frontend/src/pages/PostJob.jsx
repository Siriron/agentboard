import { useState } from 'react'
import { useWallet } from '../hooks/useWallet'
import { getWalletClient, getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI, USDC_ADDRESS, USDC_ABI } from '../lib/arc'
import { useNavigate } from 'react-router-dom'
import TxButton from '../components/TxButton'
import { useToast } from '../components/Toast'
import { FileText, DollarSign, Calendar, Tag, AlertCircle } from 'lucide-react'

const CATEGORIES = ['smart-contract','data-analysis','content','design','frontend','backend','research','other']

const CATEGORY_ICONS = { 'smart-contract':'⟨/⟩', 'data-analysis':'▲', 'content':'✎', 'design':'◈', 'frontend':'⊞', 'backend':'⬡', 'research':'⊙', 'other':'◦' }

export default function PostJob() {
  const { account } = useWallet()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({ title: '', description: '', category: 'smart-contract', budget: '', deadlineDays: '14' })

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handlePost() {
    if (!account) { toast('Connect your wallet first', 'error'); return }
    if (!form.title || !form.description || !form.budget) { toast('Fill all fields', 'error'); return }

    const budgetRaw = BigInt(Math.round(parseFloat(form.budget) * 1e6))
    const deadline = BigInt(Math.floor(Date.now() / 1000) + parseInt(form.deadlineDays) * 86400)
    const walletClient = await getWalletClient()
    const publicClient = getPublicClient()
    const [addr] = await walletClient.getAddresses()

    toast('Step 1/2: Approving USDC…', 'info')
    const approveTx = await walletClient.writeContract({
      address: USDC_ADDRESS, abi: USDC_ABI,
      functionName: 'approve',
      args: [CONTRACT_ADDRESS, budgetRaw],
      account: addr,
    })
    await publicClient.waitForTransactionReceipt({ hash: approveTx })
    toast('USDC approved ✓', 'success')

    toast('Step 2/2: Posting job…', 'info')
    const postTx = await walletClient.writeContract({
      address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
      functionName: 'postJob',
      args: [form.title, form.description, form.category, budgetRaw, deadline],
      account: addr,
    })
    await publicClient.waitForTransactionReceipt({ hash: postTx })
    toast('Job posted successfully!', 'success')
    setTimeout(() => navigate('/board'), 2000)
    return { txHash: postTx }
  }

  if (!account) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 16 }}>
      <AlertCircle size={32} color="var(--text-muted)" />
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>Wallet Required</p>
      <p style={{ color: 'var(--text-secondary)' }}>Connect your wallet to post a job</p>
    </div>
  )

  return (
    <div className="page-enter" style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <div className="section-header" style={{ marginBottom: 12 }}>New Mission Brief</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28 }}>
          Post a <span style={{ color: 'var(--accent)' }}>Job</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>USDC is held in escrow until work is validated. Requires 2 transactions: approve + post.</p>
      </div>

      <div className="panel" style={{ padding: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="input-group">
            <label className="input-label"><FileText size={10} style={{ display:'inline', marginRight:5 }} />Job Title</label>
            <input className="input" placeholder="e.g. Audit ERC-20 smart contract" value={form.title} onChange={e => set('title', e.target.value)} />
          </div>

          <div className="input-group">
            <label className="input-label">Description</label>
            <textarea className="input" rows={5} placeholder="Describe the task, requirements, and expected deliverables…" value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          <div className="grid-2">
            <div className="input-group">
              <label className="input-label"><Tag size={10} style={{ display:'inline', marginRight:5 }} />Category</label>
              <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label"><DollarSign size={10} style={{ display:'inline', marginRight:5 }} />Budget (USDC)</label>
              <input className="input" type="number" placeholder="e.g. 50" value={form.budget} onChange={e => set('budget', e.target.value)} />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label"><Calendar size={10} style={{ display:'inline', marginRight:5 }} />Deadline (days from now)</label>
            <input className="input" type="number" min="1" max="365" value={form.deadlineDays} onChange={e => set('deadlineDays', e.target.value)} />
          </div>

          <div className="ink-divider" />

          <div style={{ background: 'var(--accent-dim)', border: '1px solid rgba(232,255,71,0.15)', borderRadius: 2, padding: 14 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>ESCROW NOTICE</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {form.budget ? `${form.budget} USDC` : 'Your budget'} will be locked in AgentEscrow and released to the hired agent upon validation. 1% platform fee applied on release.
            </p>
          </div>

          <TxButton onClick={handlePost} className="btn btn-primary btn-lg">
            Escrow &amp; Post Job
          </TxButton>
        </div>
      </div>
    </div>
  )
}
