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
  const statusLabel = STATUS_LABEL[core.status] || 'UNKNOWN'
  const statusClass = STATUS_CLASS[core.status] || 'cancelled'
  const categoryIcon = CATEGORY_ICONS[meta.category] || <Tag size={11} />

  return (
    <div className="panel corner-accent" onClick={() => navigate(`/job/${jobId}`)}
      style={{ padding: 20, cursor: 'pointer', transition: 'all 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--border-bright)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className={`badge badge-${statusClass}`}>
          <span className="badge-dot" />{statusLabel}
        </span>
        <span className="category-tag" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {categoryIcon}{meta.category || 'general'}
        </span>
      </div>

      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, marginBottom: 8, lineHeight: 1.3 }}>
        {meta.title}
      </h3>

      <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5, marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {meta.description}
      </p>

      <div className="ink-divider" style={{ marginBottom: 14 }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--accent)' }}>
            {formatUSDC(core.budget)} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>USDC</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            <Users size={11} />{core.bidCount.toString()} bids
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            <Clock size={11} />{formatDate(core.deadline)}
          </div>
        </div>
        <a href={`http://testnet.arcscan.app/address/${core.client}`} target="_blank" rel="noreferrer"
          onClick={e => e.stopPropagation()} className="address-pill" style={{ fontSize: 10 }}>
          <ExternalLink size={9} />{formatAddress(core.client)}
        </a>
      </div>
    </div>
  )
}
