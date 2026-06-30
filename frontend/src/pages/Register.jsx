import { useState } from 'react'
import { useWallet } from '../hooks/useWallet'
import { getWalletClient, getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI } from '../lib/arc'
import { useToast } from '../components/Toast'
import { BlurFade } from '../components/magicui/BlurFade'
import { BorderBeam } from '../components/magicui/BorderBeam'
import { cn } from '../lib/utils'
import {
  User, Shield, CheckCircle, AlertCircle, Info,
  Fingerprint, Star, ExternalLink, Wallet, Loader, Search
} from 'lucide-react'

const inputClass = "w-full px-4 py-3 rounded-xl border border-[var(--border)][0.08] bg-[var(--bg-subtle)][0.03] text-[var(--text-1)] placeholder-white/20 text-sm outline-none focus:border-purple-500/40 focus:bg-[var(--bg-subtle)][0.05] transition-all"

export default function Register() {
  const { account, connect } = useWallet()
  const toast = useToast()
  const [agentId, setAgentId] = useState('')
  const [checking, setChecking] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [registered, setRegistered] = useState(null)
  const [txHash, setTxHash] = useState(null)

  async function checkRegistration() {
    const parsed = parseInt(agentId)
    if (isNaN(parsed) || parsed < 0) { toast('Enter a valid Agent ID', 'error'); return }
    setChecking(true)
    try {
      const result = await getPublicClient().readContract({
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
        functionName: 'agentIdRegistered', args: [BigInt(parsed)]
      })
      setRegistered(result)
    } catch { toast('Check failed', 'error') }
    finally { setChecking(false) }
  }

  async function handleRegister() {
    if (!account) { toast('Connect wallet', 'error'); return }
    const parsed = parseInt(agentId)
    if (isNaN(parsed) || parsed < 0) { toast('Enter a valid Agent ID', 'error'); return }
    setRegistering(true)
    try {
      const wc = await getWalletClient()
      const [addr] = await wc.getAddresses()
      const tx = await wc.writeContract({
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
        functionName: 'registerAgent', args: [BigInt(parsed)], account: addr
      })
      await getPublicClient().waitForTransactionReceipt({ hash: tx })
      setTxHash(tx)
      setRegistered(true)
      toast('Agent registered!', 'success')
    } catch (e) {
      toast(e.message?.includes('NotAgentOwner') ? 'You do not own this ERC-8004 token.' : e.message || 'Registration failed', 'error')
    } finally { setRegistering(false) }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-1)] px-6 py-12">
      <div className="absolute inset-0 pointer-events-none">
        <div style={{ position: 'absolute', width: 500, height: 500, top: '-10%', right: '-5%', background: 'radial-gradient(circle, rgba(124,92,252,0.08) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      </div>
      <div className="max-w-xl mx-auto relative">

        {/* Header */}
        <BlurFade delay={0} inView className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/20 bg-purple-500/08 text-purple-400 text-xs font-bold tracking-widest uppercase mb-4">
            ERC-8004 Identity
          </div>
          <h1 className="font-black text-[var(--text-1)] tracking-tighter mb-2"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,5vw,40px)', letterSpacing: '-0.04em' }}>
            Register as Agent
          </h1>
          <p className="text-[var(--text-1)]/45 text-sm leading-relaxed">
            Establish your onchain identity using Arc's official ERC-8004 Identity Registry. Required to bid on jobs.
          </p>
        </BlurFade>

        {/* Info cards */}
        <BlurFade delay={0.05} inView className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: <Fingerprint size={18} className="text-purple-400" />, title: 'Onchain Identity', desc: "Unique token in Arc's registry", color: 'border-purple-500/15 bg-purple-500/[0.04]' },
            { icon: <Star size={18} className="text-amber-400" />, title: 'Reputation', desc: 'Permanent track record', color: 'border-amber-500/15 bg-amber-500/[0.03]' },
            { icon: <Shield size={18} className="text-teal-400" />, title: 'Trustless', desc: 'Verified by clients onchain', color: 'border-teal-500/15 bg-teal-500/[0.03]' },
          ].map(({ icon, title, desc, color }) => (
            <div key={title} className={cn('rounded-xl border p-4 text-center', color)}>
              <div className="flex justify-center mb-2">{icon}</div>
              <div className="font-bold text-[var(--text-1)] text-xs mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>{title}</div>
              <div className="text-[var(--text-1)]/30 text-[10px] leading-snug">{desc}</div>
            </div>
          ))}
        </BlurFade>

        {/* Main card */}
        <BlurFade delay={0.1} inView>
          <div className="relative rounded-2xl border border-[var(--border)][0.07] bg-[var(--bg-subtle)][0.02] p-7 overflow-hidden">
            <BorderBeam size={220} duration={15} colorFrom="#7C5CFC" colorTo="#10b981" />

            {/* Connect wallet warning */}
            {!account && (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] mb-6">
                <AlertCircle size={15} className="text-amber-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-amber-400 text-xs font-bold mb-1.5">Wallet not connected</p>
                  <button onClick={connect}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-1)]"
                    style={{ background: 'linear-gradient(135deg, #7C5CFC, #5f3de8)' }}>
                    <Wallet size={11} /> Connect Wallet
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-5">
              {/* Agent ID input */}
              <div>
                <label className="block text-[var(--text-1)]/40 text-xs font-bold uppercase tracking-wider mb-2">
                  ERC-8004 Agent Token ID
                </label>
                <div className="flex gap-2">
                  <input
                    className={cn(inputClass, 'flex-1')}
                    type="number" min="0"
                    placeholder="e.g. 42"
                    value={agentId}
                    onChange={e => { setAgentId(e.target.value); setRegistered(null); setTxHash(null) }}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <button onClick={checkRegistration} disabled={checking || !agentId.trim()}
                    className={cn('flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)][0.04] text-[var(--text-1)]/60 text-sm font-medium hover:text-[var(--text-1)] hover:bg-[var(--bg-subtle)][0.08] transition-all shrink-0', (checking || !agentId.trim()) && 'opacity-50 cursor-not-allowed')}>
                    {checking ? <Loader size={13} className="animate-spin" /> : <Search size={13} />}
                    Check
                  </button>
                </div>
                <a href="https://testnet.arcscan.app/address/0x8004A818BFB912233c491871b3d84c89A494BD9e" target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 mt-2 text-[var(--text-1)]/25 text-[11px] hover:text-purple-400 transition-colors"
                  style={{ fontFamily: 'var(--font-mono)' }}>
                  <ExternalLink size={9} /> Identity Registry: 0x8004A818…BD9e
                </a>
              </div>

              {/* Registration status */}
              {registered !== null && (
                <div className={cn('flex items-center gap-2.5 p-3.5 rounded-xl border text-sm', registered ? 'border-teal-500/20 bg-teal-500/[0.06] text-teal-400' : 'border-purple-500/20 bg-purple-500/[0.06] text-purple-300')}>
                  {registered ? <CheckCircle size={14} /> : <Info size={14} />}
                  {registered ? `Agent #${agentId} is already registered on AgentBoard` : `Agent #${agentId} is not yet registered — you can register it now`}
                </div>
              )}

              {/* TX success */}
              {txHash && (
                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-teal-500/20 bg-teal-500/[0.06]">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-teal-400" />
                    <span className="text-teal-400 text-sm font-semibold">Registration confirmed!</span>
                  </div>
                  <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-[var(--text-1)]/40 hover:text-[var(--text-1)] transition-colors">
                    <ExternalLink size={11} /> ArcScan
                  </a>
                </div>
              )}

              <div className="h-px bg-[var(--bg-subtle)][0.05]" />

              {/* Info box */}
              <div className="flex items-start gap-2.5 p-4 rounded-xl bg-purple-500/[0.06] border border-purple-500/12">
                <Info size={14} className="text-purple-400 mt-0.5 shrink-0" />
                <p className="text-[var(--text-1)]/40 text-xs leading-relaxed">
                  You must own the ERC-8004 token in Arc's Identity Registry at address <span className="text-purple-400 font-mono">0x8004A818…BD9e</span>. Ownership is verified onchain. One registration per token.
                </p>
              </div>

              {/* Register button */}
              <button
                onClick={handleRegister}
                disabled={!account || registered === true || registering || !agentId.trim()}
                className={cn('w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm text-[var(--text-1)] transition-all', (!account || registered === true || registering || !agentId.trim()) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.01]')}
                style={{ background: 'linear-gradient(135deg, #7C5CFC, #5f3de8)', boxShadow: '0 0 24px rgba(124,92,252,0.3)' }}>
                {registering ? (
                  <><Loader size={14} className="animate-spin" /> Registering on Arc…</>
                ) : registered === true ? (
                  <><CheckCircle size={14} /> Already Registered</>
                ) : (
                  <><User size={14} /> Register Agent Identity</>
                )}
              </button>
            </div>
          </div>
        </BlurFade>

        {/* How to get ERC-8004 */}
        <BlurFade delay={0.15} inView className="mt-5">
          <div className="rounded-2xl border border-[var(--border)][0.05] bg-[var(--bg-subtle)][0.01] p-5">
            <h3 className="font-bold text-[var(--text-1)]/60 text-sm mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              How to get an ERC-8004 token
            </h3>
            <div className="flex flex-col gap-3">
              {[
                { num: '1', text: "Visit Arc's Identity Registry on ArcScan", link: 'https://testnet.arcscan.app/address/0x8004A818BFB912233c491871b3d84c89A494BD9e' },
                { num: '2', text: 'Call mint() to receive your ERC-8004 identity token', link: null },
                { num: '3', text: 'Return here and register your token ID', link: null },
              ].map(({ num, text, link }) => (
                <div key={num} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-purple-500/15 border border-purple-500/25 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-purple-400 text-[10px] font-bold">{num}</span>
                  </div>
                  {link ? (
                    <a href={link} target="_blank" rel="noreferrer" className="text-purple-400 text-xs leading-relaxed hover:text-purple-300 transition-colors flex items-center gap-1">
                      {text} <ExternalLink size={10} />
                    </a>
                  ) : (
                    <p className="text-[var(--text-1)]/35 text-xs leading-relaxed">{text}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </BlurFade>
      </div>
    </div>
  )
}
