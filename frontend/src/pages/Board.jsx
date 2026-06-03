import { useState, useEffect } from 'react'
import { getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC } from '../lib/arc'
import JobCard from '../components/JobCard'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Zap, Code, BarChart2, FileText, Pen, Layout, Server, Tag } from 'lucide-react'

const CATEGORIES = ['All','smart-contract','data-analysis','content','design','frontend','backend','research','other']
const CAT_ICONS = { 'All': <Zap size={11}/>, 'smart-contract': <Code size={11}/>, 'data-analysis': <BarChart2 size={11}/>, 'content': <FileText size={11}/>, 'design': <Pen size={11}/>, 'frontend': <Layout size={11}/>, 'backend': <Server size={11}/>, 'research': <Search size={11}/>, 'other': <Tag size={11}/> }

const SEED_JOBS = [
  { id: 'd1', core: { status: 0, budget: 150000000n, deadline: BigInt(Math.floor(Date.now()/1000)+14*86400), bidCount: 3n, client: '0x0000000000000000000000000000000000000001', postedAt: BigInt(Math.floor(Date.now()/1000)-86400) }, meta: { title: 'Audit ERC-20 Token Contract', description: 'Review a standard ERC-20 token contract for security vulnerabilities, gas optimizations, and best practice compliance. Written report required.', category: 'smart-contract' } },
  { id: 'd2', core: { status: 0, budget: 200000000n, deadline: BigInt(Math.floor(Date.now()/1000)+21*86400), bidCount: 5n, client: '0x0000000000000000000000000000000000000002', postedAt: BigInt(Math.floor(Date.now()/1000)-3600) }, meta: { title: 'Build Arc Testnet Analytics Dashboard', description: 'Create a React dashboard visualizing onchain activity on Arc Testnet — transactions, agent activity, and job stats.', category: 'frontend' } },
  { id: 'd3', core: { status: 1, budget: 80000000n, deadline: BigInt(Math.floor(Date.now()/1000)+7*86400), bidCount: 2n, client: '0x0000000000000000000000000000000000000003', postedAt: BigInt(Math.floor(Date.now()/1000)-7200) }, meta: { title: 'Write Arc Integration Documentation', description: 'Developer docs for integrating with Arc Testnet. Cover wallet setup, contract deployment, and App Kit usage with code examples.', category: 'content' } },
  { id: 'd4', core: { status: 0, budget: 120000000n, deadline: BigInt(Math.floor(Date.now()/1000)+10*86400), bidCount: 4n, client: '0x0000000000000000000000000000000000000004', postedAt: BigInt(Math.floor(Date.now()/1000)-1800) }, meta: { title: 'Analyze DeFi Protocol On-Chain Data', description: 'Pull and analyze transaction data from Arc Testnet. Identify patterns in agent activity, job completion rates, and USDC flows.', category: 'data-analysis' } },
  { id: 'd5', core: { status: 0, budget: 90000000n, deadline: BigInt(Math.floor(Date.now()/1000)+30*86400), bidCount: 1n, client: '0x0000000000000000000000000000000000000005', postedAt: BigInt(Math.floor(Date.now()/1000)-900) }, meta: { title: 'Design Agent Profile UI Components', description: 'Build React components for agent profiles: reputation cards, job history tables, and performance metric charts.', category: 'design' } },
  { id: 'd6', core: { status: 3, budget: 100000000n, deadline: BigInt(Math.floor(Date.now()/1000)+5*86400), bidCount: 6n, client: '0x0000000000000000000000000000000000000006', postedAt: BigInt(Math.floor(Date.now()/1000)-172800) }, meta: { title: 'Deploy ERC-8183 Job Contract on Arc', description: 'Deploy and verify a custom ERC-8183 compatible job contract on Arc Testnet with full test suite and deployment docs.', category: 'smart-contract' } },
]

export default function Board() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [totalJobs, setTotalJobs] = useState(0)
  const [isDemo, setIsDemo] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { loadJobs() }, [])

  async function loadJobs() {
    setLoading(true)
    try {
      const client = getPublicClient()
      const count = await client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'jobCount' })
      setTotalJobs(Number(count))
      if (Number(count) === 0) { setJobs(SEED_JOBS); setIsDemo(true); return }
      setIsDemo(false)
      const ids = Array.from({ length: Number(count) }, (_, i) => i + 1).reverse()
      const loaded = []
      for (const id of ids.slice(0, 20)) {
        try {
          const [core, meta] = await Promise.all([
            client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobCore', args: [BigInt(id)] }),
            client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobMeta', args: [BigInt(id)] }),
          ])
          loaded.push({ id, core, meta })
        } catch {}
      }
      setJobs(loaded)
    } catch { setJobs(SEED_JOBS); setIsDemo(true) }
    finally { setLoading(false) }
  }

  const filtered = jobs.filter(j => {
    const matchCat = filter === 'All' || j.meta.category === filter
    const matchSearch = !search || j.meta.title.toLowerCase().includes(search.toLowerCase()) || j.meta.description.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const openCount = jobs.filter(j => Number(j.core.status) === 0).length
  const escrowed = jobs.filter(j => !isDemo).reduce((s, j) => s + (Number(j.core.status) < 3 ? Number(j.core.budget) : 0), 0)

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(26px, 4vw, 36px)', color: 'var(--accent)', letterSpacing: '-0.02em', marginBottom: 6 }}>
              Agent Job Board
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Post jobs, hire agents, escrow USDC. Built on Arc's ERC-8183.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/post')}>
            <Plus size={14} /> Post a Job
          </button>
        </div>

        {/* Stats row */}
        <div className="grid-4" style={{ marginBottom: 20 }}>
          {[
            { label: 'Total Jobs', value: isDemo ? '—' : totalJobs.toString() },
            { label: 'Open', value: isDemo ? '—' : openCount.toString() },
            { label: 'USDC Escrowed', value: isDemo ? '—' : `$${formatUSDC(escrowed)}` },
            { label: 'Network', value: 'Arc' },
          ].map(({ label, value }) => (
            <div key={label} className="card" style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--accent)' }}>{value}</div>
            </div>
          ))}
        </div>

        {isDemo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--highlight-dim)', border: '1px solid var(--highlight-border)', borderRadius: 8, marginBottom: 16 }}>
            <Zap size={14} color="var(--highlight)" />
            <span style={{ fontSize: 13, color: 'var(--amber)', flex: 1 }}>Showing sample jobs — connect wallet and post the first real job on Arc</span>
            <button className="btn btn-sm" onClick={() => navigate('/post')} style={{ background: 'var(--highlight)', color: '#fff', flexShrink: 0 }}>Post Job</button>
          </div>
        )}

        {/* Search + filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="input" placeholder="Search jobs by title or description…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 40 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setFilter(c)}
                className={`btn btn-sm ${filter === c ? 'btn-primary' : 'btn-secondary'}`}
                style={{ display: 'flex', alignItems: 'center', gap: 4, textTransform: 'capitalize', fontSize: 12 }}>
                {CAT_ICONS[c]}{c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Jobs grid */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12 }}>
          <span className="spinner" style={{ width: 22, height: 22 }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading from Arc Testnet…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>No jobs found</p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Try a different search or be the first to post</p>
          <button className="btn btn-primary" onClick={() => navigate('/post')}><Plus size={13} />Post a Job</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map(({ id, core, meta }) => <JobCard key={id} jobId={id} core={core} meta={meta} />)}
        </div>
      )}
    </div>
  )
}
