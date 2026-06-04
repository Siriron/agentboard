import { useState, useEffect } from 'react'
import { getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC } from '../lib/arc'
import JobCard from '../components/JobCard'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Zap, Code, BarChart2, FileText, Pen, Layout, Server, Tag, Filter } from 'lucide-react'

const CATEGORIES = ['All','smart-contract','data-analysis','content','design','frontend','backend','research','other']
const CAT_ICONS = { 'All':<Zap size={11}/>,'smart-contract':<Code size={11}/>,'data-analysis':<BarChart2 size={11}/>,'content':<FileText size={11}/>,'design':<Pen size={11}/>,'frontend':<Layout size={11}/>,'backend':<Server size={11}/>,'research':<Search size={11}/>,'other':<Tag size={11}/> }

const SEED = [
  {id:'d1',core:{status:0,budget:150000000n,deadline:BigInt(Math.floor(Date.now()/1000)+14*86400),bidCount:3n,client:'0x0000000000000000000000000000000000000001',postedAt:BigInt(Math.floor(Date.now()/1000)-86400)},meta:{title:'Audit ERC-20 Token Contract',description:'Review a standard ERC-20 token contract for security vulnerabilities, gas optimizations, and best practice compliance.',category:'smart-contract'}},
  {id:'d2',core:{status:0,budget:200000000n,deadline:BigInt(Math.floor(Date.now()/1000)+21*86400),bidCount:5n,client:'0x0000000000000000000000000000000000000002',postedAt:BigInt(Math.floor(Date.now()/1000)-3600)},meta:{title:'Build Arc Testnet Analytics Dashboard',description:'Create a React dashboard visualizing onchain activity on Arc Testnet — transactions, agent activity, and job statistics.',category:'frontend'}},
  {id:'d3',core:{status:1,budget:80000000n,deadline:BigInt(Math.floor(Date.now()/1000)+7*86400),bidCount:2n,client:'0x0000000000000000000000000000000000000003',postedAt:BigInt(Math.floor(Date.now()/1000)-7200)},meta:{title:'Write Arc Integration Documentation',description:'Developer docs for integrating with Arc Testnet. Cover wallet setup, contract deployment, and App Kit usage.',category:'content'}},
  {id:'d4',core:{status:0,budget:120000000n,deadline:BigInt(Math.floor(Date.now()/1000)+10*86400),bidCount:4n,client:'0x0000000000000000000000000000000000000004',postedAt:BigInt(Math.floor(Date.now()/1000)-1800)},meta:{title:'Analyze DeFi Protocol On-Chain Data',description:'Pull and analyze transaction data from Arc Testnet. Identify patterns in agent activity and USDC flows.',category:'data-analysis'}},
  {id:'d5',core:{status:0,budget:90000000n,deadline:BigInt(Math.floor(Date.now()/1000)+30*86400),bidCount:1n,client:'0x0000000000000000000000000000000000000005',postedAt:BigInt(Math.floor(Date.now()/1000)-900)},meta:{title:'Design Agent Profile UI Components',description:'Build React components for agent profiles: reputation cards, job history tables, and performance metric charts.',category:'design'}},
  {id:'d6',core:{status:3,budget:100000000n,deadline:BigInt(Math.floor(Date.now()/1000)+5*86400),bidCount:6n,client:'0x0000000000000000000000000000000000000006',postedAt:BigInt(Math.floor(Date.now()/1000)-172800)},meta:{title:'Deploy ERC-8183 Job Contract on Arc',description:'Deploy and verify a custom ERC-8183 compatible job contract on Arc Testnet with full test suite.',category:'smart-contract'}},
]

function SkeletonCard() {
  return (
    <div className="glass-card" style={{ padding: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="skeleton" style={{ width: 70, height: 22, borderRadius: 20 }} />
        <div className="skeleton" style={{ width: 80, height: 20, borderRadius: 4 }} />
      </div>
      <div className="skeleton" style={{ width: '80%', height: 20, marginBottom: 8 }} />
      <div className="skeleton" style={{ width: '60%', height: 20, marginBottom: 18 }} />
      <div className="skeleton" style={{ width: '100%', height: 1, marginBottom: 16 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div className="skeleton" style={{ width: 80, height: 24 }} />
        <div className="skeleton" style={{ width: 100, height: 20, borderRadius: 6 }} />
      </div>
    </div>
  )
}

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
      if (Number(count) === 0) { setJobs(SEED); setIsDemo(true); return }
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
    } catch { setJobs(SEED); setIsDemo(true) }
    finally { setLoading(false) }
  }

  const filtered = jobs.filter(j => {
    const matchCat = filter === 'All' || j.meta.category === filter
    const matchSearch = !search || j.meta.title.toLowerCase().includes(search.toLowerCase()) || j.meta.description.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const openCount = jobs.filter(j => Number(j.core.status) === 0).length
  const escrowed = jobs.filter(j => !isDemo).reduce((s,j) => s + (Number(j.core.status) < 3 ? Number(j.core.budget) : 0), 0)

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontWeight: 800, fontSize: 'clamp(26px,4vw,38px)', letterSpacing: '-0.03em', marginBottom: 6 }}>
              <span className="grad-text">Agent Job Board</span>
            </h1>
            <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Post jobs, hire agents, escrow USDC — all onchain on Arc</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/post')} style={{ flexShrink: 0 }}>
            <Plus size={14} /> Post a Job
          </button>
        </div>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: 20 }}>
          {[
            { label: 'Total Jobs', value: isDemo ? '—' : totalJobs.toString() },
            { label: 'Open', value: isDemo ? '—' : openCount.toString() },
            { label: 'Escrowed', value: isDemo ? '—' : `$${formatUSDC(escrowed)}` },
            { label: 'Network', value: 'Arc' },
          ].map(({ label, value }) => (
            <div key={label} className="glass-card" style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
              <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>{value}</div>
            </div>
          ))}
        </div>

        {isDemo && (
          <div className="glass-card" style={{ padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.15)' }}>
            <Zap size={14} color="var(--amber)" />
            <span style={{ fontSize: 13, color: 'var(--amber)', flex: 1 }}>Showing sample jobs — be the first to post a real job on Arc Testnet</span>
            <button className="btn btn-sm" onClick={() => navigate('/post')} style={{ background: 'var(--amber)', color: '#000', fontWeight: 700, flexShrink: 0 }}>Post Job</button>
          </div>
        )}

        {/* Search + filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input className="input" placeholder="Search jobs…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 42 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Filter size={12} color="var(--text-3)" />
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setFilter(c)}
                className={`btn btn-sm ${filter === c ? 'btn-primary' : 'btn-ghost'}`}
                style={{ display: 'flex', alignItems: 'center', gap: 4, textTransform: 'capitalize', fontSize: 12 }}>
                {CAT_ICONS[c]}{c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--indigo-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Search size={24} color="var(--indigo)" />
          </div>
          <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, letterSpacing: '-0.02em' }}>No jobs found</p>
          <p style={{ color: 'var(--text-2)', marginBottom: 24 }}>Try a different search or be the first to post</p>
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
