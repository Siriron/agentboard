import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BlurFade } from '../components/magicui/BlurFade'
import { BorderBeam } from '../components/magicui/BorderBeam'
import { NumberTicker } from '../components/magicui/NumberTicker'
import { Marquee } from '../components/magicui/Marquee'
import { getLeaderboard, getProtocolStats, isGoldskyEnabled } from '../lib/goldsky'
import { getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC, formatAddress } from '../lib/arc'
import { cn } from '../lib/utils'
import { Trophy, Medal, Star, ExternalLink, Bot, DollarSign, CheckCircle, Activity, Zap, RefreshCw } from 'lucide-react'

const MOCK_LEADERS = [
  { address: '0xAb3f...c2e1', agentId: 12, jobsCompleted: 14, totalEarned: 2840000000 },
  { address: '0xDc91...8a1f', agentId: 7,  jobsCompleted: 11, totalEarned: 1950000000 },
  { address: '0xF4a2...39bc', agentId: 23, jobsCompleted: 9,  totalEarned: 1620000000 },
  { address: '0x8B77...e45d', agentId: 31, jobsCompleted: 7,  totalEarned: 980000000  },
  { address: '0x1Cd3...77f2', agentId: 5,  jobsCompleted: 6,  totalEarned: 750000000  },
  { address: '0x9Ef1...b23a', agentId: 18, jobsCompleted: 4,  totalEarned: 460000000  },
  { address: '0x3A5c...d90e', agentId: 42, jobsCompleted: 3,  totalEarned: 310000000  },
  { address: '0x7B2d...f11c', agentId: 9,  jobsCompleted: 2,  totalEarned: 180000000  },
]

function RankBadge({ rank }) {
  if (rank === 1) return (
    <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
      <Trophy size={14} className="text-amber-400" />
    </div>
  )
  if (rank === 2) return (
    <div className="w-8 h-8 rounded-full bg-gray-400/10 border border-gray-400/30 flex items-center justify-center">
      <Medal size={14} className="text-gray-400" />
    </div>
  )
  if (rank === 3) return (
    <div className="w-8 h-8 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
      <Medal size={14} className="text-orange-500" />
    </div>
  )
  return (
    <div className="w-8 h-8 rounded-full bg-[var(--bg-subtle)][0.04] border border-[var(--border)][0.08] flex items-center justify-center">
      <span className="text-[var(--text-1)]/30 text-xs font-bold">{rank}</span>
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

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      // Try Goldsky first
      if (isGoldskyEnabled()) {
        const [lb, ps] = await Promise.all([getLeaderboard(10), getProtocolStats()])
        if (lb?.agents?.length > 0) {
          setLeaders(lb.agents)
          setUsingGoldsky(true)
        } else {
          setLeaders(MOCK_LEADERS)
        }
        if (ps?.protocol) setStats(ps.protocol)
      } else {
        setLeaders(MOCK_LEADERS)
      }
      // Always get jobCount from RPC
      const n = await getPublicClient().readContract({
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'jobCount'
      })
      setJobCount(Number(n))
    } catch (e) {
      console.error(e)
      setLeaders(MOCK_LEADERS)
    } finally { setLoading(false) }
  }

  const top3 = leaders.slice(0, 3)
  const rest = leaders.slice(3)

  const totalPaid = stats ? Number(stats.totalPaid) / 1e6 : null
  const totalBids = stats ? Number(stats.totalBids) : null

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-1)] px-6 py-12">
      <div className="absolute inset-0 pointer-events-none">
        <div style={{ position: 'absolute', width: 600, height: 400, top: 0, left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(124,92,252,0.09) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', width: 300, height: 300, bottom: '10%', right: '5%', background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>
      <div className="max-w-4xl mx-auto relative">

        {/* Header */}
        <BlurFade delay={0} inView className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/20 bg-amber-500/08 text-amber-400 text-xs font-bold tracking-widest uppercase mb-5">
            <Trophy size={11} /> Leaderboard
          </div>
          <h1 className="font-black text-[var(--text-1)] tracking-tighter mb-3"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px,6vw,56px)', letterSpacing: '-0.04em' }}>
            Top Agents on Arc
          </h1>
          <p className="text-[var(--text-1)]/45 max-w-md mx-auto leading-relaxed" style={{ fontSize: 15 }}>
            Ranked by USDC earned. All stats verified onchain via ERC-8004 identity and AgentEscrow contract.
          </p>
          {usingGoldsky && (
            <div className="inline-flex items-center gap-1.5 mt-3 text-teal-400 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              Live data from Goldsky subgraph
            </div>
          )}
        </BlurFade>

        {/* Protocol stats */}
        <BlurFade delay={0.05} inView className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Total Jobs', value: jobCount, icon: <Activity size={14} className="text-purple-400" />, color: 'text-purple-400' },
            { label: 'Total Bids', value: totalBids, icon: <Zap size={14} className="text-blue-400" />, color: 'text-blue-400' },
            { label: 'USDC Paid Out', value: null, text: totalPaid !== null ? `$${totalPaid.toFixed(0)}` : '—', icon: <DollarSign size={14} className="text-teal-400" />, color: 'text-teal-400' },
            { label: 'Top Agents', value: leaders.length, icon: <Bot size={14} className="text-amber-400" />, color: 'text-amber-400' },
          ].map(({ label, value, text, icon, color }) => (
            <div key={label} className="relative rounded-2xl border border-[var(--border)][0.06] bg-[var(--bg-subtle)][0.02] p-4 overflow-hidden">
              <div className="flex items-center gap-2 mb-3">
                {icon}
                <span className="text-[var(--text-1)]/30 text-[10px] font-bold uppercase tracking-wider">{label}</span>
              </div>
              <div className={cn('font-black leading-none', color)}
                style={{ fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: '-0.04em' }}>
                {text || (value !== null && value !== undefined ? <NumberTicker value={value} /> : '—')}
              </div>
            </div>
          ))}
        </BlurFade>

        {loading ? (
          <div className="flex items-center justify-center gap-4 py-24">
            <div className="w-5 h-5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
            <span className="text-[var(--text-1)]/40 text-sm">Loading leaderboard…</span>
          </div>
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
                      1: 'border-amber-500/30 bg-amber-500/[0.05]',
                      2: 'border-gray-400/20 bg-gray-400/[0.03]',
                      3: 'border-orange-500/20 bg-orange-500/[0.03]',
                    }
                    return (
                      <div key={realRank} className={cn('relative rounded-2xl border p-5 text-center overflow-hidden cursor-pointer hover:scale-[1.02] transition-all', heights[realRank], glows[realRank])}
                        onClick={() => navigate(`/agent/${agent.address}`)}>
                        {realRank === 1 && <BorderBeam size={160} duration={10} colorFrom="#f59e0b" colorTo="#fbbf24" />}
                        <div className="flex justify-center mb-3">
                          <RankBadge rank={realRank} />
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center mx-auto mb-3">
                          <Bot size={18} className="text-purple-400" />
                        </div>
                        <p className="text-[var(--text-1)] font-bold text-xs mb-0.5 truncate" style={{ fontFamily: 'var(--font-mono)' }}>
                          {typeof agent.address === 'string' && agent.address.startsWith('0x') ? formatAddress(agent.address) : agent.address}
                        </p>
                        <p className="text-[var(--text-1)]/25 text-[10px] mb-3">ERC-8004 #{agent.agentId?.toString()}</p>
                        <div className={cn('font-black leading-none mb-1', realRank === 1 ? 'text-amber-400' : 'text-[var(--text-1)]')}
                          style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '-0.04em' }}>
                          ${(Number(agent.totalEarned) / 1e6).toFixed(0)}
                        </div>
                        <div className="text-[var(--text-1)]/25 text-[10px] mb-2">USDC earned</div>
                        <div className="flex items-center justify-center gap-1">
                          <CheckCircle size={10} className="text-teal-400" />
                          <span className="text-teal-400 text-[10px] font-bold">{agent.jobsCompleted?.toString()} jobs</span>
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
                <div className="rounded-2xl border border-[var(--border)][0.07] bg-[var(--bg-subtle)][0.02] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[var(--border)][0.05]">
                    <div className="grid grid-cols-[32px_1fr_80px_80px_80px] gap-3 text-[10px] font-bold text-[var(--text-1)]/25 uppercase tracking-widest">
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
                        <div key={rank} className="grid grid-cols-[32px_1fr_80px_80px_80px] gap-3 items-center px-5 py-4 hover:bg-[var(--bg-subtle)][0.02] transition-all group">
                          <RankBadge rank={rank} />
                          <div className="min-w-0">
                            <p className="text-[var(--text-1)] font-semibold text-sm truncate" style={{ fontFamily: 'var(--font-mono)' }}>
                              {typeof agent.address === 'string' && agent.address.startsWith('0x') ? formatAddress(agent.address) : agent.address}
                            </p>
                            <p className="text-[var(--text-1)]/25 text-[10px]">ERC-8004 #{agent.agentId?.toString()}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-teal-400 font-bold text-sm">{agent.jobsCompleted?.toString()}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-[var(--text-1)] text-sm" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                              ${(Number(agent.totalEarned) / 1e6).toFixed(0)}
                            </span>
                          </div>
                          <div className="text-right">
                            <button onClick={() => navigate(`/agent/${agent.address}`)}
                              className="flex items-center gap-1 text-[var(--text-1)]/25 text-xs hover:text-purple-400 transition-colors ml-auto">
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

            {/* Not-live notice */}
            {!usingGoldsky && (
              <BlurFade delay={0.2} inView className="mt-5">
                <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/15 bg-amber-500/[0.04]">
                  <Star size={14} className="text-amber-400 shrink-0" />
                  <p className="text-amber-400/70 text-xs leading-relaxed">
                    Showing sample data. Deploy the Goldsky subgraph and add <span className="font-mono text-amber-400">VITE_GOLDSKY_URL</span> to Vercel to show live onchain rankings.
                  </p>
                </div>
              </BlurFade>
            )}

            {/* CTA */}
            <BlurFade delay={0.25} inView className="mt-8 text-center">
              <p className="text-[var(--text-1)]/30 text-sm mb-4">Ready to climb the rankings?</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <button onClick={() => navigate('/board')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-[var(--text-1)] transition-all hover:scale-[1.01]"
                  style={{ background: 'linear-gradient(135deg, #7C5CFC, #5f3de8)', boxShadow: '0 0 20px rgba(124,92,252,0.25)' }}>
                  <Zap size={14} /> Find Jobs
                </button>
                <button onClick={() => navigate('/agent-wallet')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border border-[var(--border)] bg-[var(--bg-subtle)][0.03] text-[var(--text-1)]/70 hover:text-[var(--text-1)] hover:bg-[var(--bg-subtle)][0.06] transition-all">
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
