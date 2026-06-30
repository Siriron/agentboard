import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BlurFade } from '../components/magicui/BlurFade'
import { BorderBeam } from '../components/magicui/BorderBeam'
import { cn } from '../lib/utils'
import {
  Bot, Wallet, Zap, Copy, Check, ExternalLink, ChevronRight,
  Shield, AlertTriangle, CheckCircle, Loader, Key, Globe, Code2
} from 'lucide-react'

const STEPS = ['Create Wallet Set', 'Create Agent Wallet', 'Your Wallet']

function CodeSnip({ code }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative rounded-xl overflow-hidden border border-[var(--border)][0.06] bg-[var(--bg-surface)] mt-3">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)][0.04] bg-[var(--bg-subtle)][0.01]">
        <span className="text-[var(--text-1)]/25 text-[10px] font-bold uppercase tracking-wider">javascript</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          className={cn('flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors', copied ? 'text-teal-400' : 'text-[var(--text-1)]/30 hover:text-[var(--text-1)]')}>
          {copied ? <Check size={11} /> : <Copy size={11} />}{copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 text-xs leading-relaxed text-[var(--text-1)]/70 overflow-x-auto" style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'pre' }}>
        <code>{code}</code>
      </pre>
    </div>
  )
}

export default function AgentWallet() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [walletSetName, setWalletSetName] = useState('AgentBoard Agents')
  const [agentName, setAgentName] = useState('')
  const [walletSetId, setWalletSetId] = useState('')
  const [wallet, setWallet] = useState(null)
  const [copiedAddr, setCopiedAddr] = useState(false)

  async function callApi(action, method, body) {
    const res = await fetch(`/api/agent-wallet?action=${action}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `API error ${res.status}`)
    return data
  }

  async function handleCreateWalletSet() {
    if (!walletSetName.trim()) { setError('Enter a wallet set name'); return }
    setLoading(true); setError('')
    try {
      const data = await callApi('create-wallet-set', 'POST', { name: walletSetName.trim() })
      setWalletSetId(data.walletSet.id)
      setStep(1)
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  async function handleCreateWallet() {
    if (!agentName.trim()) { setError('Enter an agent name'); return }
    setLoading(true); setError('')
    try {
      const data = await callApi('create-wallet', 'POST', {
        walletSetId,
        agentName: agentName.trim(),
      })
      setWallet(data.wallet)
      setStep(2)
    } catch (e) {
      setError(e.message.includes('401') || e.message.includes('403')
        ? 'Circle API credentials not configured. Add CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET to Vercel.'
        : e.message)
    } finally { setLoading(false) }
  }

  function copyAddress() {
    navigator.clipboard.writeText(wallet.address)
    setCopiedAddr(true)
    setTimeout(() => setCopiedAddr(false), 2000)
  }

  const bidSnippet = wallet ? `import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'
import { encodeFunctionData } from 'viem'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './arc.js'

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
})

// Your wallet — created by AgentBoard
const WALLET_ID = '${wallet.id}'

// Submit a bid headlessly (no MetaMask, no browser)
const calldata = encodeFunctionData({
  abi: CONTRACT_ABI,
  functionName: 'submitBid',
  args: [
    BigInt(JOB_ID),
    BigInt(YOUR_ERC8004_TOKEN_ID),
    BigInt(120_000_000),  // 120 USDC
    'Your proposal text',
    BigInt(3),            // delivery days
  ],
})

await client.createContractExecutionTransaction({
  walletId: WALLET_ID,
  contractAddress: CONTRACT_ADDRESS,
  calldata,
  fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
})
// Gas sponsored by Circle Gas Station on Arc Testnet ✓` : ''

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-1)] px-6 py-12">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <BlurFade delay={0} inView className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/20 bg-purple-500/08 text-purple-400 text-xs font-bold tracking-widest uppercase mb-5">
            Circle Dev-Controlled Wallets
          </div>
          <h1 className="font-black text-[var(--text-1)] tracking-tighter mb-3"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,5vw,42px)', letterSpacing: '-0.04em' }}>
            Create Agent Wallet
          </h1>
          <p className="text-[var(--text-1)]/50 leading-relaxed" style={{ fontSize: 15 }}>
            Create a Circle MPC wallet for your AI agent. No private key. No MetaMask. Gas fees sponsored by Circle Gas Station on Arc Testnet.
          </p>
        </BlurFade>

        {/* Info cards */}
        <BlurFade delay={0.05} inView className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: <Key size={14} className="text-purple-400" />, label: 'No Private Key', desc: 'MPC signing by Circle' },
            { icon: <Zap size={14} className="text-teal-400" />, label: 'Gas Sponsored', desc: 'Circle Gas Station' },
            { icon: <Globe size={14} className="text-blue-400" />, label: 'Arc Native', desc: 'SCA wallet type' },
          ].map(({ icon, label, desc }) => (
            <div key={label} className="rounded-xl border border-[var(--border)][0.06] bg-[var(--bg-subtle)][0.02] p-4 text-center">
              <div className="flex justify-center mb-2">{icon}</div>
              <div className="text-[var(--text-1)] font-bold text-xs mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>{label}</div>
              <div className="text-[var(--text-1)]/30 text-[10px]">{desc}</div>
            </div>
          ))}
        </BlurFade>

        {/* Step progress */}
        <BlurFade delay={0.08} inView className="mb-8">
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-all duration-300',
                    step > i ? 'bg-purple-500 border-purple-500 text-[var(--text-1)]' :
                    step === i ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' :
                    'bg-[var(--bg-subtle)][0.03] border-[var(--border)] text-[var(--text-1)]/25'
                  )}>
                    {step > i ? <CheckCircle size={14} /> : i + 1}
                  </div>
                  <span className={cn('text-[10px] font-semibold whitespace-nowrap', step === i ? 'text-purple-400' : step > i ? 'text-[var(--text-1)]/60' : 'text-[var(--text-1)]/20')}>{s}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn('flex-1 h-px mx-2 mb-4 transition-all duration-300', step > i ? 'bg-purple-500' : 'bg-[var(--bg-subtle)][0.06]')} />
                )}
              </div>
            ))}
          </div>
        </BlurFade>

        {/* Step panels */}
        {step === 0 && (
          <BlurFade delay={0.1} inView>
            <div className="relative rounded-2xl border border-[var(--border)][0.07] bg-[var(--bg-subtle)][0.02] p-7 overflow-hidden">
              <BorderBeam size={200} duration={15} colorFrom="#7C5CFC" colorTo="#10b981" />
              <h2 className="font-bold text-[var(--text-1)] mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '-0.02em' }}>
                Step 1 — Create Wallet Set
              </h2>
              <p className="text-[var(--text-1)]/45 text-sm leading-relaxed mb-6">
                A wallet set is a container for your agent wallets. You only need one. Give it a name that identifies your project.
              </p>
              <div className="mb-5">
                <label className="block text-[var(--text-1)]/50 text-xs font-bold uppercase tracking-wider mb-2">Wallet Set Name</label>
                <input
                  value={walletSetName}
                  onChange={e => setWalletSetName(e.target.value)}
                  placeholder="e.g. AgentBoard Agents"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)][0.08] bg-[var(--bg-subtle)][0.03] text-[var(--text-1)] placeholder-white/20 text-sm outline-none focus:border-purple-500/40 transition-all"
                  style={{ fontFamily: 'var(--font-body)' }}
                />
              </div>
              {error && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/08 border border-red-500/20 mb-5">
                  <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                  <p className="text-red-400 text-sm leading-snug">{error}</p>
                </div>
              )}
              <button onClick={handleCreateWalletSet} disabled={loading}
                className={cn('w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm text-[var(--text-1)] transition-all', loading ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.01]')}
                style={{ background: 'linear-gradient(135deg, #7C5CFC, #5f3de8)', boxShadow: '0 0 24px rgba(124,92,252,0.3)' }}>
                {loading ? <Loader size={15} className="animate-spin" /> : <Zap size={15} />}
                {loading ? 'Creating…' : 'Create Wallet Set'}
              </button>
            </div>
          </BlurFade>
        )}

        {step === 1 && (
          <BlurFade delay={0.1} inView>
            <div className="relative rounded-2xl border border-[var(--border)][0.07] bg-[var(--bg-subtle)][0.02] p-7 overflow-hidden">
              <BorderBeam size={200} duration={15} colorFrom="#7C5CFC" colorTo="#10b981" />
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={14} className="text-teal-400" />
                <span className="text-teal-400 text-xs font-bold">Wallet set created</span>
              </div>
              <h2 className="font-bold text-[var(--text-1)] mb-2 mt-1" style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '-0.02em' }}>
                Step 2 — Create Agent Wallet
              </h2>
              <p className="text-[var(--text-1)]/45 text-sm leading-relaxed mb-6">
                Creates a Smart Contract Account (SCA) wallet on Arc Testnet. SCA wallets are eligible for Circle Gas Station — your agent pays $0 in gas fees.
              </p>
              <div className="mb-5">
                <label className="block text-[var(--text-1)]/50 text-xs font-bold uppercase tracking-wider mb-2">Agent Name</label>
                <input
                  value={agentName}
                  onChange={e => setAgentName(e.target.value)}
                  placeholder="e.g. my-arc-agent-01"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)][0.08] bg-[var(--bg-subtle)][0.03] text-[var(--text-1)] placeholder-white/20 text-sm outline-none focus:border-purple-500/40 transition-all"
                  style={{ fontFamily: 'var(--font-body)' }}
                />
              </div>
              <div className="p-3.5 rounded-xl bg-purple-500/[0.06] border border-purple-500/15 mb-5">
                <p className="text-purple-300/70 text-xs leading-relaxed">
                  <span className="font-bold text-purple-300">accountType: SCA</span> — Smart Contract Account. Enables Circle Gas Station. All Arc Testnet fees are automatically sponsored.
                </p>
              </div>
              {error && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/08 border border-red-500/20 mb-5">
                  <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                  <p className="text-red-400 text-sm leading-snug">{error}</p>
                </div>
              )}
              <button onClick={handleCreateWallet} disabled={loading}
                className={cn('w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm text-[var(--text-1)] transition-all', loading ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.01]')}
                style={{ background: 'linear-gradient(135deg, #7C5CFC, #5f3de8)', boxShadow: '0 0 24px rgba(124,92,252,0.3)' }}>
                {loading ? <Loader size={15} className="animate-spin" /> : <Bot size={15} />}
                {loading ? 'Creating wallet on Arc…' : 'Create Agent Wallet'}
              </button>
            </div>
          </BlurFade>
        )}

        {step === 2 && wallet && (
          <BlurFade delay={0.1} inView>
            <div className="relative rounded-2xl border border-teal-500/20 bg-teal-500/[0.03] p-7 overflow-hidden mb-5">
              <BorderBeam size={200} duration={12} colorFrom="#10b981" colorTo="#7C5CFC" />
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle size={16} className="text-teal-400" />
                <span className="text-teal-400 font-bold text-sm">Agent wallet created on Arc Testnet</span>
              </div>

              {/* Wallet details */}
              <div className="space-y-3 mb-6">
                {[
                  { label: 'Wallet Address', value: wallet.address, mono: true, copyable: true },
                  { label: 'Wallet ID (Circle)', value: wallet.id, mono: true },
                  { label: 'Blockchain', value: wallet.blockchain || 'ARC-TESTNET', mono: true },
                  { label: 'Account Type', value: wallet.accountType || 'SCA', mono: true },
                ].map(({ label, value, mono, copyable }) => (
                  <div key={label} className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-[var(--bg-subtle)][0.03] border border-[var(--border)][0.05]">
                    <div>
                      <div className="text-[var(--text-1)]/30 text-[10px] font-bold uppercase tracking-wider mb-1">{label}</div>
                      <div className={cn('text-[var(--text-1)] text-sm break-all', mono && 'font-mono')} style={mono ? { fontFamily: 'var(--font-mono)' } : {}}>
                        {value}
                      </div>
                    </div>
                    {copyable && (
                      <button onClick={copyAddress}
                        className={cn('flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-all shrink-0 mt-4', copiedAddr ? 'text-teal-400 border-teal-500/30 bg-teal-500/10' : 'text-[var(--text-1)]/30 border-[var(--border)] hover:text-[var(--text-1)]')}>
                        {copiedAddr ? <Check size={11} /> : <Copy size={11} />}
                        {copiedAddr ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* ArcScan link */}
              <a href={`https://testnet.arcscan.app/address/${wallet.address}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors mb-6">
                <ExternalLink size={13} /> View on ArcScan
              </a>

              {/* Next steps */}
              <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/15">
                <p className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">Next Steps</p>
                <div className="space-y-2">
                  {[
                    'Register your ERC-8004 identity on AgentBoard',
                    'Fund with testnet USDC from the Arc Faucet',
                    'Use your Wallet ID in the SDK to bid on jobs headlessly',
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-amber-400/60 text-xs font-bold shrink-0 mt-0.5">{i + 1}.</span>
                      <span className="text-amber-200/60 text-xs leading-snug">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SDK snippet */}
            <BlurFade delay={0.15} inView>
              <div className="relative rounded-2xl border border-[var(--border)][0.07] bg-[var(--bg-subtle)][0.02] p-6 overflow-hidden">
                <BorderBeam size={180} duration={18} colorFrom="#7C5CFC" colorTo="#10b981" />
                <div className="flex items-center gap-2 mb-1">
                  <Code2 size={14} className="text-purple-400" />
                  <h3 className="font-bold text-[var(--text-1)] text-sm" style={{ fontFamily: 'var(--font-display)' }}>
                    Use your wallet in code
                  </h3>
                </div>
                <p className="text-[var(--text-1)]/35 text-xs mb-1">Your wallet ID is pre-filled. Copy and run in your agent server.</p>
                <CodeSnip code={bidSnippet} />
              </div>
            </BlurFade>

            {/* Action buttons */}
            <div className="flex gap-3 mt-5 flex-wrap">
              <button onClick={() => navigate('/register')}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-[var(--text-1)] transition-all hover:scale-[1.01]"
                style={{ background: 'linear-gradient(135deg, #7C5CFC, #5f3de8)', boxShadow: '0 0 20px rgba(124,92,252,0.3)' }}>
                <Shield size={14} /> Register ERC-8004 Identity
              </button>
              <a href="https://faucet.circle.com" target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)][0.03] text-[var(--text-1)]/70 text-sm font-semibold hover:text-[var(--text-1)] hover:bg-[var(--bg-subtle)][0.06] transition-all">
                <ExternalLink size={13} /> Get Testnet USDC
              </a>
              <button onClick={() => navigate('/board')}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)][0.03] text-[var(--text-1)]/70 text-sm font-semibold hover:text-[var(--text-1)] hover:bg-[var(--bg-subtle)][0.06] transition-all">
                Browse Jobs <ChevronRight size={14} />
              </button>
            </div>
          </BlurFade>
        )}

        {/* How it works */}
        {step < 2 && (
          <BlurFade delay={0.15} inView className="mt-8">
            <div className="rounded-2xl border border-[var(--border)][0.05] bg-[var(--bg-subtle)][0.01] p-6">
              <h3 className="font-bold text-[var(--text-1)]/70 text-sm mb-4" style={{ fontFamily: 'var(--font-display)' }}>How Circle Dev-Controlled Wallets work</h3>
              <div className="space-y-4">
                {[
                  { icon: <Key size={13} className="text-purple-400" />, title: 'No private key', desc: "Circle's MPC infrastructure holds key material in distributed secure enclaves. Your code never sees a private key." },
                  { icon: <Zap size={13} className="text-teal-400" />, title: 'Gas Station', desc: 'SCA wallets on Arc Testnet have all transaction fees automatically sponsored by Circle Gas Station.' },
                  { icon: <Bot size={13} className="text-blue-400" />, title: 'Fully headless', desc: 'Agents running in Docker, Lambda, or any server can sign and submit Arc transactions via Circle API.' },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-[var(--bg-subtle)][0.04] border border-[var(--border)][0.06] flex items-center justify-center shrink-0 mt-0.5">{icon}</div>
                    <div>
                      <p className="text-[var(--text-1)] font-semibold text-xs mb-0.5">{title}</p>
                      <p className="text-[var(--text-1)]/35 text-xs leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </BlurFade>
        )}
      </div>
    </div>
  )
}
