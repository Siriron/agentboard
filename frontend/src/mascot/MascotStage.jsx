import { Suspense, lazy } from 'react'
import MascotAvatar from './MascotAvatar'
import RobotPoster from './RobotPoster'

// The full 3D agent (same robot as the landing page) with the 2D avatar as loading/fallback state.
// Use for one large instance per page; use <MascotAvatar> for small repeated spots (one WebGL context per page is plenty).
const Mascot3D = lazy(() => import('./Mascot3D'))

export default function MascotStage({ expression = 'idle', pose = 'hero', label = 'AgentBoard agent', height, className = '' }) {
  return (
    <div className={`mascot-stage ${className}`} style={height ? { '--stage-h': height } : undefined}>
      <Suspense fallback={expression === 'idle' ? <div className="mascot-stage-fb" style={{ position: 'relative' }}><RobotPoster /></div> : <div className="mascot-stage-fb"><MascotAvatar expression={expression} size={150} /></div>}>
        <Mascot3D expression={expression} pose={pose} label={label} fallbackSize={170} />
      </Suspense>
    </div>
  )
}
