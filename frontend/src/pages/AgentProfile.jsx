import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC, formatAddress, formatDate } from '../lib/arc'
import { ExternalLink, Star, ArrowLeft } from 'lucide-react'

const STATUS_LABEL = ['OPEN','HIRED','SUBMITTED','VALIDATED','DISPUTED','CANCELLED','EXPIRED']
const STATUS_CLASS = ['open','hired','submitted','validated','disputed','cancelled','expired']

export default function AgentProfile() {
  const { address } = useParams()
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  // BUG FIX: validate address param is a valid ethereum address before querying
  const isValidAddress = address && /^0x[0-9a-fA-F]{40}$/.test(address)

  useEffect(() => {
    if (isValidAddress) load()
    else setLoading(false)
  }, [address])

  async function load() {
    setLoading(true)
    try {
      const client = getPublicClient()
      const ids = await client.readContract({
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
        functionName: 'getAgentJobs',
        args: [address],
      })
      const loaded = []
      for (const id of ids) {
        try {
          const [core, meta] = await Promise.all([
            client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobCore', args: [id] }),
            client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobMeta', args: [id] }),
          ])
          loaded.push({ id: Number(id), core, meta })
        } catch {}
      }
      setJobs(loaded.reverse())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (!isValidAddress) return (
    <div style={{ textAlign: 'center', padding: 80 }}>
      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, marginBottom: 12 }}>Invalid Address</p>
      <button className="btn btn-primary" onClick={() => navigate('/board')}>Back to Board</button>
    </div>
  )

  // BUG FIX: status comparisons use Number()
  const completed = jobs.filter(j => Number(j.core.status) === 3)
  const earned = completed.reduce((s, j) => s + Number(j.core.budget), 0)
  const successRate = jobs.length ? Math.round((completed.length / jobs.length) * 100) : 0

  return (
    <div className="page-enter">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 24 }}>
        <ArrowLeft size={13} /> Back
      </button>

      <div className="panel speed-lines" style={{ padding: 28, marginBottom: 24 }}>
        <div className="section-header" style={{ marginBottom: 16 }}>Agent Dossier · ERC-8004</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 2,
            background: 'linear-gradient(135deg, var(--accent-dim), var(--bg-elevated))',
            border: '2px solid var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--accent)',
            flexShrink: 0,
          }}>
            {address.slice(2, 4).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20 }}>Agent</span>
              <a href={`http://testnet.arcscan.app/address/${address}`} target="_blank" rel="noreferrer" className="address-pill">
                <ExternalLink size={10} />{formatAddress(address)}
              </a>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="badge badge-open"><Star size={9} />Active</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>Arc Testnet · ERC-8004 Verified</span>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Jobs', value: jobs.length },
              { label: 'Completed', value: completed.length },
              { label: 'Success Rate', value: `${successRate}%` },
              { label: 'USDC Earned', value: formatUSDC(earned) },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--accent)' }}>{value}</div>
                <div className="metric-label">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: 24 }}>
        <div className="section-header" style={{ marginBottom: 20 }}>Job History</div>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="spinner" style={{ width: 18, height: 18 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>Loading history…</span>
          </div>
        ) : jobs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>No job history yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {jobs.map(({ id, core, meta }) => {
              const statusNum = Number(core.status)
              return (
                <div key={id} className="panel-elevated" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                  onClick={() => navigate(`/job/${id}`)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className={`badge badge-${STATUS_CLASS[statusNum] || 'cancelled'}`}>{STATUS_LABEL[statusNum] || 'UNKNOWN'}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14 }}>{meta.title}</span>
                    <span className="category-tag">{meta.category}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: 'var(--accent)' }}>{formatUSDC(core.budget)} USDC</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{formatDate(core.postedAt)}</span>
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
