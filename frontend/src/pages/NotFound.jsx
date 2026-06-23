import { useNavigate } from 'react-router-dom'
import { BlurFade } from '../components/magicui/BlurFade'
import { Zap } from 'lucide-react'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[#0a0814] text-white flex flex-col items-center justify-center px-6 text-center relative">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 40%, rgba(153,69,255,0.1) 0%, transparent 60%)' }} />
      <BlurFade delay={0} inView className="relative">
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(80px,20vw,160px)', letterSpacing: '-0.06em', lineHeight: 1, background: 'linear-gradient(135deg, rgba(153,69,255,0.3), rgba(153,69,255,0.05))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: 24 }}>
          404
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(20px,4vw,28px)', letterSpacing: '-0.03em', marginBottom: 10 }}>
          Page not found
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, marginBottom: 36, maxWidth: 320, lineHeight: 1.65 }}>
          This page doesn't exist. Head back to the job board.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white"
            style={{ background: 'linear-gradient(135deg, #9945ff, #7c35dd)', boxShadow: '0 0 20px rgba(153,69,255,0.3)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={14} /> Home
          </button>
          <button onClick={() => navigate('/board')}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 22px', color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
            Browse Jobs
          </button>
        </div>
      </BlurFade>
    </div>
  )
}
