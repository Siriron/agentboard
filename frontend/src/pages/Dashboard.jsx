import { useState, useEffect } from 'react'
import { useWallet } from '../hooks/useWallet'
import { getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC, formatDate } from '../lib/arc'
import { useNavigate } from 'react-router-dom'
import { Briefcase, ArrowRight, AlertCircle } from 'lucide-react'

const STATUS_LABEL = ['OPEN','HIRED','SUBMITTED','VALIDATED','DISPUTED','CANCELLED','EXPIRED']
const STATUS_CLASS = ['open','hired','submitted','validated','disputed','cancelled','expired']

export default function Dashboard() {
  const { account, connect } = useWallet()
  const navigate = useNavigate()
  const [clientJobs, setClientJobs] = useState([])
  const [agentJobs, setAgentJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('client')

  // BUG FIX: account is a string dependency — must be in dep array
  useEffect(() => { if (account) load() }, [account])

  async function load() {
    setLoading(true)
    try {
      const client = getPublicClient()
      const [cIds, aIds] = await Promise.all([
        client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getClientJobs', args: [account] }),
        client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getAgentJobs', args: [account] }),
      ])

      async function loadJobList(ids) {
        const jobs = []
        for (const id of ids) {
          try {
            const [core, meta] = await Promise.all([
              client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobCore', args: [id] }),
              client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobMeta', args: [id] }),
            ])
            jobs.push({ id: Number(id), core, meta })
          } catch {}
        }
        return jobs
      }

      const [cJobs, aJobs] = await Promise.all([loadJobList(cIds), loadJobList(aIds)])
      setClientJobs(cJobs.reverse())
      setAgentJobs(aJobs.reverse())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (!account) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 16, textAlign: 'center' }}>
      <AlertCircle size={40} color="var(--text-muted)" />
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22 }}>Connect to View Dashboard</h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: 340 }}>Your dashboard shows all jobs you've posted and jobs you've been hired for.</p>
      <button className="btn btn-primary btn-lg" onClick={connect}>Connect Wallet</button>
    </div>
  )

  // BUG FIX: status comparisons must use Number() — viem returns BigInt for uint8
  const completed = agentJobs.filter(j => Number(j.core.status) === 3)
  const earned = completed.reduce((s, j) => s + Number(j.core.budget), 0)
  const spent = clientJobs.filter(j => Number(j.core.status) === 3).reduce((s, j) => s + Number(j.core.budget), 0)
  const displayJobs = tab === 'client' ? clientJobs : agentJobs

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 32 }}>
        <div className="section-header" style={{ marginBottom: 12 }}>Mission Control</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28 }}>
          Your <span style={{ color: 'var(--accent)' }}>Dashboard</span>
        </h1>
      </div>

      <div className="grid-4" style={{ marginBottom: 32 }}>
        {[
          { label: 'Jobs Posted', value: clientJobs.length, color: 'var(--text-primary)' },
          { label: 'Jobs Completed', value: completed.length, color: 'var(--green)' },
          { label: 'USDC Earned', value: formatUSDC(earned), color: 'var(--accent)' },
          { label: 'USDC Spent', value: formatUSDC(spent), color: 'var(--blue)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="panel corner-accent" style={{ padding: 20 }}>
            <div className="metric-label" style={{ marginBottom: 8 }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color }}>{value.toString()}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {[['client', `Client (${clientJobs.length})`], ['agent', `Agent (${agentJobs.length})`]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`btn ${tab === key ? 'btn-primary' : 'btn-secondary'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 40 }}>
          <span className="spinner" style={{ width: 20, height: 20 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>Loading from Arc…</span>
        </div>
      ) : displayJobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Briefcase size={28} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
            {tab === 'client' ? 'No jobs posted yet' : 'No agent jobs yet'}
          </p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
            {tab === 'client' ? 'Post your first job to get started' : 'Browse the board and submit bids'}
          </p>
          <button className="btn btn-primary" onClick={() => navigate(tab === 'client' ? '/post' : '/board')}>
            {tab === 'client' ? 'Post a Job' : 'Browse Board'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {displayJobs.map(({ id, core, meta }) => {
            const statusNum = Number(core.status)
            return (
              <div key={id} className="panel" style={{ padding: 20, cursor: 'pointer' }} onClick={() => navigate(`/job/${id}`)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className={`badge badge-${STATUS_CLASS[statusNum] || 'cancelled'}`}>
                      <span className="badge-dot" />{STATUS_LABEL[statusNum] || 'UNKNOWN'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{meta.title}</span>
                    <span className="category-tag">{meta.category}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--accent)' }}>
                      {formatUSDC(core.budget)} USDC
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{formatDate(core.deadline)}</span>
                    <ArrowRight size={14} color="var(--text-muted)" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
