import { useNavigate } from 'react-router-dom'
import { formatUSDC, formatAddress, formatDate, STATUS_LABEL } from '../lib/arc'
import { Users, Clock, ExternalLink, Code, BarChart2, FileText, Pen, Layout, Server, Search, Tag } from 'lucide-react'

const STATUS_CLASS = ['open','hired','submitted','validated','disputed','cancelled','expired']

const CATEGORY_ICONS = {
  'smart-contract': <Code size={11} />,
  'data-analysis': <BarChart2 size={11} />,
  'content': <FileText size={11} />,
  'design': <Pen size={11} />,
  'frontend': <Layout size={11} />,
  'backend': <Server size={11} />,
  'research': <Search size={11} />,
  'other': <Tag size={11} />,
}

export default function JobCard({ jobId, core, meta }) {
  const navigate = useNavigate()
  const statusNum = Number(core.status)
  const statusLabel = STATUS_LABEL[statusNum] || 'UNKNOWN'
  const statusClass = STATUS_CLASS[statusNum] || 'cancelled'
  const categoryIcon = CATEGORY_ICONS[meta.category] || <Tag size={11} />

  return (
    <div className="card" onClick={() => navigate(`/job/${jobId}`)}
      style={{ padding: 20, cursor: 'pointer', transition: 'all 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className={`badge badge-${statusClass}`}>
          <span className="badge-dot" />{statusLabel}
        </span>
        <span className="tag" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {categoryIcon}{meta.category || 'general'}
        </span>
      </div>

      {/* Title */}
      <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, lineHeight: 1.35, color: 'var(--text-primary)' }}>
        {meta.title}
      </h3>

      {/* Description */}
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55, marginBottom: 16,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {meta.description}
      </p>

      <div className="divider" style={{ marginBottom: 14 }} />

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, color: 'var(--accent)' }}>
            ${formatUSDC(core.budget)} <span style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--text-muted)', fontWeight: 400 }}>USDC</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 12 }}>
            <Users size={12} />{core.bidCount.toString()}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 12 }}>
            <Clock size={12} />{formatDate(core.deadline)}
          </span>
        </div>
        <a href={`http://testnet.arcscan.app/address/${core.client}`} target="_blank" rel="noreferrer"
          onClick={e => e.stopPropagation()} className="address-pill" style={{ fontSize: 10 }}>
          <ExternalLink size={9} />{formatAddress(core.client)}
        </a>
      </div>
    </div>
  )
}
