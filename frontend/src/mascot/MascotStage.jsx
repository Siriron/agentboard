import { Suspense, lazy } from 'react'
import RobotPoster from './RobotPoster'

// The full 3D agent (same robot as the landing page) with a snapshot of the 3D robot as the loading state (no 2D swap).
// Use for one large instance per page; use <MascotAvatar> for small repeated spots (one WebGL context per page is plenty).
const Mascot3D = lazy(() => import('./Mascot3D'))

export default function MascotStage({ expression = 'idle', pose = 'hero', label = 'AgentBoard agent', height, className = '' }) {
  return (
    <div className={`mascot-stage ${className}`} style={height ? { '--stage-h': height } : undefined}>
      <Suspense fallback={<div className="mascot-stage-fb" style={{ position: 'relative' }}><RobotPoster /></div>}>
        <Mascot3D expression={expression} pose={pose} label={label} fallbackSize={170} />
      </Suspense>
    </div>
  )
}
