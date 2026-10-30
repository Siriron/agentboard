import { useNavigate } from 'react-router-dom'
import MascotAvatar from '../mascot/MascotAvatar'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: '48px var(--gutter)', textAlign: 'center' }}>
      <div style={{ display: 'grid', gap: 14, justifyItems: 'center', maxWidth: 420 }}>
        <MascotAvatar expression="curious" size={120} label="The AgentBoard agent looks puzzled" />
        <h1 style={{ fontSize: 'clamp(34px, 7vw, 56px)', lineHeight: 1 }}>Page not found</h1>
        <p style={{ color: 'var(--text-2)' }}>That address doesn&rsquo;t lead anywhere. Check the link, or head back to the board.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
          <button onClick={() => navigate('/')} className="btn btn-primary">Home</button>
          <button onClick={() => navigate('/board')} className="btn btn-secondary">Open the board</button>
        </div>
      </div>
    </div>
  )
}
