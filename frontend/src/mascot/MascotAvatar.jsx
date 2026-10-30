import { useId } from 'react'

// Lightweight 2D version of the AgentBoard agent. Same face vocabulary as the 3D scene (src/mascot/expressions.ts),
// used in the app for empty states, guidance and real status feedback. Decorative unless `label` is given.
export default function MascotAvatar({ expression = 'idle', size = 96, label = undefined, className = '' }) {
  const uid = useId().replace(/:/g, '')
  const face = FACES[expression] || FACES.idle
  return (
    <svg className={`mascot-avatar ${className}`} width={size} height={size} viewBox="0 0 120 120" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
      <ellipse cx="60" cy="112" rx="30" ry="4.5" fill="var(--text-1)" opacity=".12" />
      {/* body */}
      <rect x="36" y="74" width="48" height="32" rx="12" fill="#ebe6dc" stroke="rgba(0,0,0,.18)" />
      <rect x="44" y="82" width="32" height="10" rx="4" fill="#1a1c20" />
      <rect x="47" y="85" width="7" height="4" rx="2" fill="#ffb347" /><rect x="56.5" y="85" width="7" height="4" rx="2" fill="#ff6c4b" /><rect x="66" y="85" width="7" height="4" rx="2" fill="#5ee0b0" />
      <rect x="26" y="84" width="9" height="12" rx="4.5" fill="#f6f2ea" stroke="rgba(0,0,0,.15)" /><rect x="85" y="84" width="9" height="12" rx="4.5" fill="#f6f2ea" stroke="rgba(0,0,0,.15)" />
      {/* head */}
      <rect x="53" y="6" width="14" height="9" rx="3" fill="#ff6c4b" /><circle cx="60" cy="10.5" r="1.7" fill="#0a0b0d" />
      <rect x="22" y="14" width="76" height="58" rx="16" fill="#ebe6dc" stroke="rgba(0,0,0,.18)" />
      <rect x="15" y="36" width="9" height="14" rx="4" fill="#1a1c20" /><rect x="96" y="36" width="9" height="14" rx="4" fill="#1a1c20" />
      <rect x="29" y="21" width="62" height="44" rx="11" fill="#ff6c4b" />
      <rect x="32.5" y="24.5" width="55" height="37" rx="8.5" fill="#08090b" />
      <g className={`mascot-face mascot-${expression}`} fill="#fff4e8" stroke="#fff4e8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 3px #ff6c4b)` }} id={uid}>
        {face}
      </g>
    </svg>
  )
}

const FACES = {
  idle: <g className="mascot-eyes"><rect x="44" y="36" width="9" height="13" rx="3.5" stroke="none" /><rect x="67" y="36" width="9" height="13" rx="3.5" stroke="none" /></g>,
  curious: <g><rect x="44" y="38" width="8" height="11" rx="3.2" stroke="none" /><rect x="66" y="33" width="10" height="16" rx="3.8" stroke="none" /></g>,
  happy: <g fill="none" strokeWidth="4"><path d="M44 46 q5 -9 10 0" /><path d="M66 46 q5 -9 10 0" /></g>,
  working: <g stroke="none"><circle cx="46" cy="45" r="3.4" /><circle cx="60" cy="40" r="3.4" /><circle cx="74" cy="45" r="3.4" /></g>,
  prompt: <g fill="none" strokeWidth="3.6"><path d="M44 35 l11 8 l-11 8" /><path d="M60 52 h14" /></g>,
  success: <g fill="none" strokeWidth="5"><path d="M45 44 l9 9 l20 -20" /></g>,
  alert: <g stroke="none"><rect x="57" y="31" width="6" height="16" rx="3" /><circle cx="60" cy="53" r="3.4" /></g>,
}
