import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC, formatDate } from '../lib/arc'
import { isGoldskyEnabled } from '../lib/goldsky'
import { BlurFade } from '../components/magicui/BlurFade'
import { BorderBeam } from '../components/magicui/BorderBeam'
import { cn } from '../lib/utils'
import {
  Search, SlidersHorizontal, ChevronRight, Briefcase,
  DollarSign, Clock, Users, Zap, Bot, RefreshCw
} from 'lucide-react'

const CATEGORIES = ['All','SmartContract','Frontend','Backend','Audit','Research','Design','Data','DevOps','Other']
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'budget_high', label: 'Budget ↓' },
  { value: 'budget_low', label: 'Budget ↑' },
  { value: 'most_bids', label: 'Most Bids' },
  { value: 'deadline', label: 'Deadline Soon' },
]
const STATUS_FILTER = [
  { value: 'all', label: 'All' },
  { value: '0', label: 'Open' },
  { value: '1', label: 'Hired' },
  { value: '2', label: 'Submitted' },
  { value: '3', label: 'Validated' },
]
const STATUS_META = {
  0: { text: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/25', dot: 'bg-teal-400', label: 'OPEN' },
  1: { text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25', dot: 'bg-amber-400', label: 'HIRED' },
  2: { text: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/25', dot: 'bg-blue-400', label: 'SUBMITTED' },
  3: { text: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/25', dot: 'bg-teal-400', label: 'VALIDATED' },
  4: { text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/25', dot: 'bg-red-400', label: 'DISPUTED' },
  5: { text: 'text-gray-500', bg: 'bg-gray-500/10 border-gray-500/20', dot: 'bg-gray-500', label: 'CANCELLED' },
  6: { text: 'text-gray-500', bg: 'bg-gray-500/10 border-gray-500/20', dot: 'bg-gray-500', label: 'EXPIRED' },
}

// Concurrency-limited parallel fetching
async function pLimit(fns, limit = 5) {
  const results = []
  const pool = []
  for (const fn of fns) {
    const p = Promise.resolve().then(fn).then(r => { results.push(r) }).catch(() => {})
    pool.push(p)
    if (pool.length >= limit) await Promise.race(pool).catch(() => {})
    pool.splice(pool.findIndex(x => x === p), 1)
  }
  await Promise.allSettled(pool)
  return results
}

function JobCard({ job, onClick }) {
  const { id, core, meta } = job
  const sn = Number(core.status)
  const sm = STATUS_META[sn] || STATUS_META[5]
  const bids = Number(core.bidCount)

  return (
    <div onClick={onClick} className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 cursor-pointer hover:border-purple-500/25 hover:bg-white/[0.04] transition-all duration-200 overflow-hidden">
      <BorderBeam size={150} duration={22} colorFrom="#9945ff" colorTo="#19fb9b"
        className="opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full border', sm.text, sm.bg)}>
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', sm.dot)} />{sm.label}
          </span>
          <span className="text-[10px] text-white/25 bg-white/[0.03] border border-white/[0.06] px-2 py-0.5 rounded-full font-medium">{meta.category}</span>
        </div>
        <ChevronRight size={14} className="text-white/15 group-hover:text-purple-400 transition-colors shrink-0 mt-0.5" />
      </div>
      <h3 className="font-bold text-white mb-2 leading-snug group-hover:text-purple-100 transition-colors line-clamp-2"
        style={{ fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: '-0.02em' }}>
        {meta.title}
      </h3>
      <p className="text-white/35 text-xs leading-relaxed mb-4 line-clamp-2">{meta.description}</p>
      <div className="flex items-center justify-between gap-3 pt-3.5 border-t border-white/[0.05]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <DollarSign size={11} className="text-teal-400" />
            <span className="font-bold text-white text-sm" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>${formatUSDC(core.budget)}</span>
            <span className="text-white/25 text-[10px]">USDC</span>
          </div>
          <div className="flex items-center gap-1">
            <Users size={11} className="text-white/25" />
            <span className="text-white/40 text-xs">{bids}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={10} className="text-white/20" />
          <span className="text-white/25 text-[10px]">{formatDate(core.deadline)}</span>
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/[0.04] bg-white/[0.01] p-5">
      <div className="flex gap-2 mb-3">
        <div className="skeleton h-5 w-14 rounded-full" />
        <div className="skeleton h-5 w-20 rounded-full" />
      </div>
      <div className="skeleton h-4 w-3/4 mb-2 rounded" />
      <div className="skeleton h-3 w-full mb-1 rounded" />
      <div className="skeleton h-3 w-2/3 mb-4 rounded" />
      <div className="flex justify-between pt-3.5 border-t border-white/[0.03]">
        <div className="skeleton h-4 w-20 rounded" />
        <div className="skeleton h-4 w-16 rounded" />
      </div>
    </div>
  )
}

export default function Board() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('newest')
  const [showFilters, setShowFilters] = useState(false)
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')

  const loadJobs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const client = getPublicClient()
      const count = Number(await client.readContract({
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'jobCount'
      }))
      if (count === 0) { setJobs([]); return }

      const ids = Array.from({ length: count }, (_, i) => count - i)
      const loaded = []

      // Fetch with concurrency limit of 5 parallel requests
      await pLimit(ids.map(id => async () => {
        const [core, meta] = await Promise.all([
          client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobCore', args: [BigInt(id)] }),
          client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobMeta', args: [BigInt(id)] }),
        ])
        loaded.push({ id, core, meta })
      }), 5)

      loaded.sort((a, b) => b.id - a.id)
      setJobs(loaded)
    } catch (e) { console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase().trim()
    if (q && !j.meta.title.toLowerCase().includes(q) && !j.meta.description.toLowerCase().includes(q) && !j.meta.category.toLowerCase().includes(q)) return false
    if (category !== 'All' && j.meta.category !== category) return false
    if (status !== 'all' && Number(j.core.status) !== parseInt(status)) return false
    const budget = Number(j.core.budget) / 1e6
    if (budgetMin && budget < parseFloat(budgetMin)) return false
    if (budgetMax && budget > parseFloat(budgetMax)) return false
    return true
  }).sort((a, b) => {
    switch (sort) {
      case 'budget_high': return Number(b.core.budget) - Number(a.core.budget)
      case 'budget_low': return Number(a.core.budget) - Number(b.core.budget)
      case 'most_bids': return Number(b.core.bidCount) - Number(a.core.bidCount)
      case 'deadline': return Number(a.core.deadline) - Number(b.core.deadline)
      default: return b.id - a.id
    }
  })

  const openCount = jobs.filter(j => Number(j.core.status) === 0).length
  const hasActiveFilters = search || category !== 'All' || status !== 'all' || budgetMin || budgetMax

  return (
    <div className="min-h-screen bg-[#0a0814] text-white px-5 sm:px-6 py-10">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <BlurFade delay={0} inView className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                <span className="text-teal-400 text-xs font-bold uppercase tracking-widest">
                  {openCount} open · {jobs.length} total
                  {isGoldskyEnabled() && <span className="ml-2 text-white/20 normal-case font-normal">· Indexed by Goldsky</span>}
                </span>
              </div>
              <h1 className="font-black text-white tracking-tighter"
                style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px,5vw,40px)', letterSpacing: '-0.04em' }}>
                Job Board
              </h1>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => loadJobs(true)} disabled={refreshing || loading}
                className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.02] text-white/50 text-xs font-medium hover:text-white transition-all', (refreshing || loading) && 'opacity-40 pointer-events-none')}>
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
              </button>
              <button onClick={() => navigate('/post')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-xs text-white transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, #9945ff, #7c35dd)', boxShadow: '0 0 16px rgba(153,69,255,0.3)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                <Zap size={12} /> Post Job
              </button>
            </div>
          </div>
        </BlurFade>

        {/* Controls */}
        <BlurFade delay={0.04} inView className="mb-5 flex flex-col gap-3">
          {/* Row 1: search + status + sort + filter toggle */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] text-white placeholder-white/25 text-sm outline-none focus:border-purple-500/40 focus:bg-white/[0.05] transition-all"
                style={{ fontFamily: 'var(--font-body)' }} />
            </div>
            {[
              { value: status, onChange: setStatus, options: STATUS_FILTER },
              { value: sort, onChange: setSort, options: SORT_OPTIONS },
            ].map((sel, i) => (
              <select key={i} value={sel.value} onChange={e => sel.onChange(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] text-white/80 text-xs outline-none focus:border-purple-500/40 cursor-pointer"
                style={{ fontFamily: 'var(--font-body)' }}>
                {sel.options.map(o => <option key={o.value} value={o.value} style={{ background: '#0a0814' }}>{o.label}</option>)}
              </select>
            ))}
            <button onClick={() => setShowFilters(f => !f)}
              className={cn('flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all', showFilters ? 'border-purple-500/35 bg-purple-500/10 text-purple-400' : 'border-white/[0.07] bg-white/[0.02] text-white/45 hover:text-white')}>
              <SlidersHorizontal size={12} /> Filters
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 ml-0.5" />}
            </button>
          </div>

          {/* Advanced filters */}
          {showFilters && (
            <div className="flex gap-3 flex-wrap items-end p-4 rounded-xl border border-purple-500/12 bg-purple-500/[0.03]">
              {[
                { label: 'Min Budget (USDC)', value: budgetMin, set: setBudgetMin, ph: '0' },
                { label: 'Max Budget (USDC)', value: budgetMax, set: setBudgetMax, ph: '∞' },
              ].map(({ label, value, set, ph }) => (
                <div key={label}>
                  <div className="text-white/35 text-[10px] font-bold uppercase tracking-wide mb-1.5">{label}</div>
                  <input value={value} onChange={e => set(e.target.value)} type="number" placeholder={ph}
                    className="w-28 px-3 py-2 rounded-lg border border-white/[0.07] bg-white/[0.03] text-white text-xs outline-none focus:border-purple-500/40"
                    style={{ fontFamily: 'var(--font-mono)' }} />
                </div>
              ))}
              {hasActiveFilters && (
                <button onClick={() => { setBudgetMin(''); setBudgetMax(''); setSearch(''); setCategory('All'); setStatus('all') }}
                  className="px-3 py-2 rounded-lg text-white/35 text-xs hover:text-white transition-colors border border-white/[0.05]">
                  Clear all
                </button>
              )}
            </div>
          )}

          {/* Category pills */}
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={cn('px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all', category === cat
                  ? 'bg-purple-500/15 border-purple-500/35 text-purple-300'
                  : 'bg-white/[0.02] border-white/[0.06] text-white/35 hover:text-white/70 hover:border-white/15')}>
                {cat}
              </button>
            ))}
          </div>
        </BlurFade>

        {/* Result count */}
        {!loading && (
          <div className="text-white/25 text-xs mb-4">
            {filtered.length} {filtered.length === 1 ? 'job' : 'jobs'}
            {hasActiveFilters ? ' matching filters' : ''}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array(6).fill(0).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center mb-4">
              <Briefcase size={24} className="text-purple-400" />
            </div>
            <p className="font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>
              {search ? `No results for "${search}"` : 'No jobs found'}
            </p>
            <p className="text-white/30 text-sm mb-6">
              {hasActiveFilters ? 'Try adjusting your filters.' : 'Be the first to post a job.'}
            </p>
            {hasActiveFilters && (
              <button onClick={() => { setSearch(''); setCategory('All'); setStatus('all'); setBudgetMin(''); setBudgetMax('') }}
                className="text-purple-400 text-sm hover:text-purple-300 transition-colors underline underline-offset-2">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(job => (
              <JobCard key={job.id} job={job} onClick={() => navigate(`/job/${job.id}`)} />
            ))}
          </div>
        )}

        {/* Headless agent CTA */}
        {!loading && filtered.length > 0 && (
          <BlurFade delay={0} inView className="mt-10">
            <div className="relative rounded-2xl border border-purple-500/12 bg-purple-500/[0.03] p-5 flex items-center justify-between gap-5 flex-wrap overflow-hidden">
              <BorderBeam size={180} duration={22} colorFrom="#9945ff" colorTo="#19fb9b" />
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/12 flex items-center justify-center shrink-0">
                  <Bot size={16} className="text-purple-400" />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm" style={{ fontFamily: 'var(--font-display)' }}>Building an AI agent?</p>
                  <p className="text-white/35 text-xs">Bid headlessly with Circle Dev-Controlled Wallets — no MetaMask required.</p>
                </div>
              </div>
              <button onClick={() => navigate('/docs#headless')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-purple-500/25 bg-purple-500/08 text-purple-300 text-xs font-semibold hover:bg-purple-500/15 transition-all shrink-0"
                style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                View API Docs <ChevronRight size={12} />
              </button>
            </div>
          </BlurFade>
        )}
      </div>
    </div>
  )
}
