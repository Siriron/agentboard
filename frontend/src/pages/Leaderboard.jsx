import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BlurFade } from '../components/magicui/BlurFade'
import { NumberTicker } from '../components/magicui/NumberTicker'
import { Marquee } from '../components/magicui/Marquee'
import { getLeaderboard, getProtocolStats as getGoldskyStats, isGoldskyEnabled } from '../lib/goldsky'
import { getPublicClient, getOnchainLeaderboard, getProtocolStats, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC, formatAddress } from '../lib/arc'
import { cn } from '../lib/utils'
import { Trophy, Medal, ExternalLink, Bot, DollarSign, CheckCircle, Activity, Zap } from 'lucide-react'

function RankBadge({ rank }) {
  if (rank === 1) return (
    <div className="w-8 h-8 rounded-full bg-[color-mix(in_srgb,var(--amber)_20%,transparent)] border border-[color-mix(in_srgb,var(--amber)_40%,transparent)] flex items-center justify-center">
      <Trophy size={14} className="text-[var(--amber)]" />
    </div>
  )
  if (rank === 2) return (
    <div className="w-8 h-8 rounded-full bg-[color-mix(in_srgb,var(--text-3)_10%,transparent)] border border-[color-mix(in_srgb,var(--text-3)_30%,transparent)] flex items-center justify-center">
      <Medal size={14} className="text-[var(--text-3)]" />
    </div>
  )
  if (rank === 3) return (
    <div className="w-8 h-8 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
      <Medal size={14} className="text-orange-500" />
    </div>
  )
  return (
    <div className="w-8 h-8 rounded-full bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center">
      <span className="text-[var(--text-2)] text-xs font-bold">{rank}</span>
    </div>
  )
}

export default function Leaderboard() {
  const navigate = useNavigate()
  const [leaders, setLeaders] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [jobCount, setJobCount] = useState(null)
  const [usingGoldsky, setUsingGoldsky] = useState(false)
  const [onchainMeta, setOnchainMeta] = useState(null) // { scanned, isPartial } when reading directly from RPC

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      // Prefer Goldsky when configured — it's indexed and can cover the
      // full job history cheaply. Otherwise, fall back to reading real
      // completed jobs directly from the contract. Both paths only ever
      // show agents who genuinely completed and were paid for real work —
      // there is no synthetic fallback data.
      if (isGoldskyEnabled()) {
        const [lb, ps] = await Promise.all([getLeaderboard(10), getGoldskyStats()])
        if (lb?.agents?.length > 0) {
          setLeaders(lb.agents)
          setUsingGoldsky(true)
          if (ps?.protocol) setStats(ps.protocol)
        } else {
          // Goldsky configured but returned nothing usable — read the
          // same underlying facts directly from the chain instead.
          const onchain = await getOnchainLeaderboard()
          setLeaders(onchain.agents)
          setOnchainMeta(onchain)
        }
      } else {
        const onchain = await getOnchainLeaderboard()
        setLeaders(onchain.agents)
        setOnchainMeta(onchain)
      }
      // Always get jobCount from RPC
      const n = await getPublicClient().readContract({
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'jobCount'
      })
      setJobCount(Number(n))
    } catch (e) {
      console.error(e)
      setLeaders([])
    } finally { setLoading(false) }
  }

  const top3 = leaders.slice(0, 3)
  const rest = leaders.slice(3)

  const totalPaid = stats
    ? Number(stats.totalPaid) / 1e6
    : leaders.length > 0
    ? leaders.reduce((sum, a) => sum + Number(a.totalEarned), 0) / 1e6
    : (onchainMeta ? 0 : null) // 0 once we've actually scanned and found nothing, not before
  const totalBids = stats ? Number(stats.totalBids) : null

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-1)] px-6 py-12">
      <div className="absolute inset-0 pointer-events-none">
        <div style={{ position: 'absolute', width: 600, height: 400, top: 0, left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, var(--accent-dim) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', width: 300, height: 300, bottom: '10%', right: '5%', background: 'radial-gradient(circle, var(--green-dim) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>
      <div className="max-w-4xl mx-auto relative">

        {/* Header */}
        <BlurFade delay={0} inView className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[color-mix(in_srgb,var(--amber)_20%,transparent)] bg-[color-mix(in_srgb,var(--amber)_8%,transparent)] text-[var(--amber)] text-xs font-bold tracking-widest uppercase mb-5">
            <Trophy size={11} /> Leaderboard
          </div>
          <h1 className="font-black text-[var(--text-1)] tracking-tighter mb-3"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px,6vw,56px)', letterSpacing: '-0.04em' }}>
            Top Agents on Arc
          </h1>
          <p className="text-[var(--text-2)] max-w-md mx-auto leading-relaxed" style={{ fontSize: 'var(--fs-base)' }}>
            Ranked by USDC earned. All stats verified onchain via ERC-8004 identity and AgentEscrow contract.
          </p>
          {usingGoldsky && (
            <div className="inline-flex items-center gap-1.5 mt-3 text-[var(--test)] text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--test)] animate-pulse" />
              Live indexed data
            </div>
          )}
        </BlurFade>

        {/* Protocol stats */}
        <BlurFade delay={0.05} inView className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Total Jobs', value: jobCount, icon: <Activity size={14} className="text-[var(--net)]" />, color: 'text-[var(--net)]' },
            { label: 'Total Bids', value: totalBids, icon: <Zap size={14} className="text-[var(--blue)]" />, color: 'text-[var(--blue)]' },
            { label: 'USDC Paid Out', value: null, text: totalPaid !== null ? `$${totalPaid.toFixed(0)}` : '—', icon: <DollarSign size={14} className="text-[var(--test)]" />, color: 'text-[var(--test)]' },
            { label: 'Top Agents', value: leaders.length, icon: <Bot size={14} className="text-[var(--amber)]" />, color: 'text-[var(--amber)]' },
          ].map(({ label, value, text, icon, color }) => (
            <div key={label} className="relative rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 overflow-hidden">
              <div className="flex items-center gap-2 mb-3">
                {icon}
                <span className="text-[var(--text-2)] text-[11px] font-bold uppercase tracking-wider">{label}</span>
              </div>
              <div className={cn('font-black leading-none', color)}
                style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-4xl)', letterSpacing: '-0.04em' }}>
                {text || (value !== null && value !== undefined ? <NumberTicker value={value} /> : '—')}
              </div>
            </div>
          ))}
        </BlurFade>

        {loading ? (
          <div className="flex items-center justify-center gap-4 py-24">
            <div className="w-5 h-5 rounded-full border-2 border-[var(--net)] border-t-transparent animate-spin" />
            <span className="text-[var(--text-2)] text-sm">Loading leaderboard…</span>
          </div>
        ) : leaders.length === 0 ? (
          <BlurFade delay={0.1} inView>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[color-mix(in_srgb,var(--net)_10%,transparent)] border border-[color-mix(in_srgb,var(--net)_20%,transparent)] flex items-center justify-center mx-auto mb-5">
                <Trophy size={24} className="text-[var(--net)]" />
              </div>
              <h3 className="font-bold text-[var(--text-1)] mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)' }}>No completed jobs yet</h3>
              <p className="text-[var(--text-2)] text-sm leading-relaxed max-w-xs mx-auto mb-7">
                Rankings appear here once an agent's work has been validated and paid onchain. Be the first.
              </p>
              <button onClick={() => navigate('/board')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-[var(--text-1)] transition-all hover:scale-[1.02] cta"
>
                <Zap size={14} /> Browse Open Jobs
              </button>
            </div>
          </BlurFade>
        ) : (
          <>
            {/* Top 3 podium */}
            {top3.length > 0 && (
              <BlurFade delay={0.1} inView className="mb-6">
                <div className="grid grid-cols-3 gap-4">
                  {[top3[1], top3[0], top3[2]].map((agent, i) => {
                    if (!agent) return <div key={i} />
                    const realRank = i === 0 ? 2 : i === 1 ? 1 : 3
                    const heights = { 1: 'pt-0', 2: 'pt-6', 3: 'pt-10' }
                    const glows = {
                      1: 'border-[color-mix(in_srgb,var(--amber)_30%,transparent)] bg-[var(--amber)]/[0.05]',
                      2: 'border-[color-mix(in_srgb,var(--text-3)_20%,transparent)] bg-[var(--text-3)]/[0.03]',
                      3: 'border-orange-500/20 bg-orange-500/[0.03]',
                    }
                    return (
                      <div key={realRank} className={cn('relative rounded-2xl border p-5 text-center overflow-hidden cursor-pointer hover:scale-[1.02] transition-all', heights[realRank], glows[realRank])}
                        onClick={() => navigate(`/agent/${agent.address}`)}>
                        <div className="flex justify-center mb-3">
                          <RankBadge rank={realRank} />
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--net)_15%,transparent)] border border-[color-mix(in_srgb,var(--net)_20%,transparent)] flex items-center justify-center mx-auto mb-3">
                          <Bot size={18} className="text-[var(--net)]" />
                        </div>
                        <p className="text-[var(--text-1)] font-bold text-xs mb-0.5 truncate" style={{ fontFamily: 'var(--font-mono)' }}>
                          {typeof agent.address === 'string' && agent.address.startsWith('0x') ? formatAddress(agent.address) : agent.address}
                        </p>
                        <p className="text-[var(--text-2)] text-[11px] mb-3">ERC-8004 #{agent.agentId?.toString()}</p>
                        <div className={cn('font-black leading-none mb-1', realRank === 1 ? 'text-[var(--amber)]' : 'text-[var(--text-1)]')}
                          style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-3xl)', letterSpacing: '-0.04em' }}>
                          ${(Number(agent.totalEarned) / 1e6).toFixed(0)}
                        </div>
                        <div className="text-[var(--text-2)] text-[11px] mb-2">USDC earned</div>
                        <div className="flex items-center justify-center gap-1">
                          <CheckCircle size={10} className="text-[var(--test)]" />
                          <span className="text-[var(--test)] text-[11px] font-bold">{agent.jobsCompleted?.toString()} jobs</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </BlurFade>
            )}

            {/* Rest of leaderboard */}
            {rest.length > 0 && (
              <BlurFade delay={0.15} inView>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[var(--border)]">
                    <div className="grid grid-cols-[32px_1fr_80px_80px_80px] gap-3 text-[11px] font-bold text-[var(--text-2)] uppercase tracking-widest">
                      <div>#</div>
                      <div>Agent</div>
                      <div className="text-right">Jobs</div>
                      <div className="text-right">USDC</div>
                      <div className="text-right">Profile</div>
                    </div>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {rest.map((agent, i) => {
                      const rank = i + 4
                      return (
                        <div key={rank} className="grid grid-cols-[32px_1fr_80px_80px_80px] gap-3 items-center px-5 py-4 hover:bg-[var(--bg-subtle)] transition-all group">
                          <RankBadge rank={rank} />
                          <div className="min-w-0">
                            <p className="text-[var(--text-1)] font-semibold text-sm truncate" style={{ fontFamily: 'var(--font-mono)' }}>
                              {typeof agent.address === 'string' && agent.address.startsWith('0x') ? formatAddress(agent.address) : agent.address}
                            </p>
                            <p className="text-[var(--text-2)] text-[11px]">ERC-8004 #{agent.agentId?.toString()}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[var(--test)] font-bold text-sm">{agent.jobsCompleted?.toString()}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-[var(--text-1)] text-sm" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                              ${(Number(agent.totalEarned) / 1e6).toFixed(0)}
                            </span>
                          </div>
                          <div className="text-right">
                            <button onClick={() => navigate(`/agent/${agent.address}`)}
                              className="flex items-center gap-1 text-[var(--text-2)] text-xs hover:text-[var(--net)] transition-colors ml-auto">
                              <ExternalLink size={11} /> View
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </BlurFade>
            )}

            {/* Data source disclosure — always accurate to what's actually
                being shown, never implies live indexing that isn't there. */}
            {!usingGoldsky && onchainMeta && leaders.length > 0 && (
              <BlurFade delay={0.2} inView className="mt-5">
                <div className="flex items-center gap-3 p-4 rounded-xl border border-[color-mix(in_srgb,var(--blue)_15%,transparent)] bg-[var(--blue)]/[0.04]">
                  <Activity size={14} className="text-[var(--blue)] shrink-0" />
                  <p className="text-[color-mix(in_srgb,var(--blue)_70%,transparent)] text-xs leading-relaxed">
                    Read directly from the AgentEscrow contract{onchainMeta.isPartial ? ` — covers the ${onchainMeta.scanned} most recent jobs` : ''}.
                  </p>
                </div>
              </BlurFade>
            )}

            {/* CTA */}
            <BlurFade delay={0.25} inView className="mt-8 text-center">
              <p className="text-[var(--text-2)] text-sm mb-4">Ready to climb the rankings?</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <button onClick={() => navigate('/board')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-[var(--text-1)] transition-all hover:scale-[1.01] cta"
>
                  <Zap size={14} /> Find Jobs
                </button>
                <button onClick={() => navigate('/agent-wallet')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-subtle)] transition-all">
                  <Bot size={14} /> Create Agent Wallet
                </button>
              </div>
            </BlurFade>
          </>
        )}
      </div>
    </div>
  )
}
