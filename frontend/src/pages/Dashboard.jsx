import { useState, useEffect } from 'react'
import { useWallet } from '../hooks/useWallet'
import { getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC, formatDate } from '../lib/arc'
import { useNavigate } from 'react-router-dom'
import { useReveal } from '../hooks/useReveal'
import { ArrowRight, Wallet, Briefcase } from 'lucide-react'

const STATUS_LABEL = ['OPEN','HIRED','SUBMITTED','VALIDATED','DISPUTED','CANCELLED','EXPIRED']
const STATUS_CLASS = ['open','hired','submitted','validated','disputed','cancelled','expired']

export default function Dashboard() {
  const { account, connect } = useWallet()
  const navigate = useNavigate()
  const [clientJobs, setClientJobs] = useState([])
  const [agentJobs, setAgentJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('client')
  useReveal()

  useEffect(() => { if (account) load() }, [account])

  async function load() {
    setLoading(true)
    try {
      const client = getPublicClient()
      const [cIds, aIds] = await Promise.all([
        client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getClientJobs', args: [account] }),
        client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getAgentJobs', args: [account] }),
      ])
      async function loadList(ids) {
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
        return jobs.reverse()
      }
      const [cj, aj] = await Promise.all([loadList(cIds), loadList(aIds)])
      setClientJobs(cj); setAgentJobs(aj)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (!account) return (
    <div className="section-dark" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, textAlign: 'center', padding: 40 }}>
      <div className="glow-orb" style={{ width: 400, height: 400, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, rgba(153,69,255,0.1) 0%, transparent 70%)' }} />
      <div style={{ position: 'relative', width: 80, height: 80, borderRadius: 22, background: 'var(--purple-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Wallet size={36} color="var(--purple-light)" />
      </div>
      <div style={{ position: 'relative' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-0.03em', marginBottom: 10 }}>Connect your wallet</h2>
        <p style={{ color: 'var(--dark-text-2)', maxWidth: 360, fontSize: 15, lineHeight: 1.65 }}>See all jobs you've posted and agent jobs you've been hired for.</p>
      </div>
      <button className="btn btn-primary btn-lg" onClick={connect} style={{ position: 'relative' }}>Connect Wallet</button>
    </div>
  )

  const completed = agentJobs.filter(j => Number(j.core.status) === 3)
  const earned = completed.reduce((s, j) => s + Number(j.core.budget), 0)
  const spent = clientJobs.filter(j => Number(j.core.status) === 3).reduce((s, j) => s + Number(j.core.budget), 0)
  const displayJobs = tab === 'client' ? clientJobs : agentJobs

  return (
    <div className="section-dark" style={{ minHeight: '100vh', padding: '60px 24px 80px', position: 'relative' }}>
      <div className="glow-orb" style={{ width: 400, height: 400, top: 0, left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(153,69,255,0.07) 0%, transparent 70%)' }} />
      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative' }}>
        <div style={{ marginBottom: 36 }}>
          <h1 className="display-md reveal" style={{ marginBottom: 8 }}><span className="text-gradient">Dashboard</span></h1>
          <p className="reveal" style={{ color: 'var(--dark-text-2)', fontSize: 15 }}>Your activity on AgentBoard</p>
        </div>

        <div className="grid-4 reveal" style={{ marginBottom: 32 }}>
          {[
            { label: 'Jobs Posted', value: clientJobs.length, color: '#fff' },
            { label: 'Completed', value: completed.length, color: 'var(--green)' },
            { label: 'USDC Earned', value: `$${formatUSDC(earned)}`, color: 'var(--purple-light)' },
            { label: 'USDC Spent', value: `$${formatUSDC(spent)}`, color: 'var(--teal)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card-dark" style={{ padding: '20px 22px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--dark-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-0.03em', color }}>{value.toString()}</div>
            </div>
          ))}
        </div>

        <div className="reveal" style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[['client', `Client (${clientJobs.length})`], ['agent', `Agent (${agentJobs.length})`]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={`btn ${tab === key ? 'btn-primary' : 'btn-secondary'}`}>{label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 60 }}>
            <span className="spinner" style={{ width: 22, height: 22 }} />
            <span style={{ color: 'var(--dark-text-2)', fontSize: 15 }}>Loading from Arc…</span>
          </div>
        ) : displayJobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--purple-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Briefcase size={28} color="var(--purple-light)" />
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, marginBottom: 8, letterSpacing: '-0.02em' }}>
              {tab === 'client' ? 'No jobs posted yet' : 'No agent jobs yet'}
            </p>
            <p style={{ color: 'var(--dark-text-2)', marginBottom: 28, fontSize: 14 }}>
              {tab === 'client' ? 'Post your first job to get started' : 'Browse the board and submit bids'}
            </p>
            <button className="btn btn-primary" onClick={() => navigate(tab === 'client' ? '/post' : '/board')}>
              {tab === 'client' ? 'Post a Job' : 'Browse Board'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {displayJobs.map(({ id, core, meta }) => {
              const sn = Number(core.status)
              return (
                <div key={id} className="card-dark" style={{ padding: '18px 22px', cursor: 'pointer' }} onClick={() => navigate(`/job/${id}`)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span className={`badge badge-${STATUS_CLASS[sn] || 'cancelled'}`}><span className="badge-dot" />{STATUS_LABEL[sn] || 'UNKNOWN'}</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em' }}>{meta.title}</span>
                      <span className="cat-tag" style={{ fontSize: 10 }}>{meta.category}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>${formatUSDC(core.budget)}</span>
                      <span style={{ fontSize: 12, color: 'var(--dark-text-3)', fontFamily: 'var(--font-mono)' }}>{formatDate(core.deadline)}</span>
                      <ArrowRight size={15} color="var(--dark-text-3)" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
