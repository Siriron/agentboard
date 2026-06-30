import { useNavigate } from 'react-router-dom'
import { BlurFade } from '../components/magicui/BlurFade'
import { Zap } from 'lucide-react'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-1)] flex flex-col items-center justify-center px-6 text-center relative" style={{ background: 'linear-gradient(160deg, #f3f0ff 0%, #fce8f8 45%, #e8f5ff 100%)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 40%, rgba(124,92,252,0.12) 0%, transparent 60%)' }} />
      <BlurFade delay={0} inView className="relative">
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(80px,20vw,160px)', letterSpacing: '-0.06em', lineHeight: 1, background: 'linear-gradient(135deg, rgba(124,92,252,0.45), rgba(244,114,182,0.25))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: 24 }}>
          404
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(20px,4vw,28px)', letterSpacing: '-0.03em', marginBottom: 10, color: 'var(--text-1)' }}>
          Page not found
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: 15, marginBottom: 36, maxWidth: 320, lineHeight: 1.65, margin: '0 auto 36px' }}>
          This page doesn't exist. Head back to the job board.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            <Zap size={14} /> Home
          </button>
          <button onClick={() => navigate('/board')} className="btn btn-secondary">
            Browse Jobs
          </button>
        </div>
      </BlurFade>
    </div>
  )
}
