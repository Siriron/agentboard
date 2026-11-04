import { useEffect, useState } from 'react'
import MascotAvatar from './MascotAvatar'

// One character for every wait in the app. States map onto the existing faces:
//   idle    blinks and bobs
//   working processing: pulsing dots, LED on (also used for loading)
//   success one short check and a hop, then settles
//   error   one short shake and a pulse, then settles
const FACE = { idle: 'idle', working: 'working', loading: 'working', success: 'success', error: 'alert' }
const SIZES = { xs: 24, sm: 32, md: 48, lg: 72 }

export default function Robot({ state = 'idle', size = /** @type {string | number} */ ('md'), label = /** @type {string | undefined} */ (undefined), className = '' }) {
  const px = typeof size === 'number' ? size : SIZES[size] ?? 48
  return (
    <span className={`robot robot-${state} ${className}`} data-state={state} style={{ width: px, height: px }}>
      <MascotAvatar expression={FACE[state] || 'idle'} size={px} label={label} />
    </span>
  )
}

// Block-level loading state. The space is reserved from the first frame, but the robot only appears after `delay` ms,
// so a fast response never flashes it and nothing moves when it shows up.
export function RobotLoader({ label = 'Loading…', delay = 350, size = /** @type {string | number} */ ('lg'), minHeight = 124, className = 'empty' }) {
  const [show, setShow] = useState(delay === 0)
  useEffect(() => {
    if (delay === 0) return undefined
    const t = setTimeout(() => setShow(true), delay)
    return () => clearTimeout(t)
  }, [delay])
  return (
    <div className={`robot-loader ${className}`} role="status" aria-busy="true" style={{ minHeight }}>
      <span className="sr-only">{label}</span>
      {show && (
        <div className="robot-loader-in" aria-hidden>
          <Robot state="working" size={size} />
          <span>{label}</span>
        </div>
      )}
    </div>
  )
}

// Inline version for buttons that wait on a wallet or the network.
export function BusyLabel({ children }) {
  return <span className="robot-busy"><Robot state="working" size="xs" />{children}</span>
}
