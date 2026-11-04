import { useId } from 'react'

// 2D version of the AgentBoard agent, drawn to match the 3D scene (src/mascot/scene.ts): ceramic head with the pinned-card tab,
// halo-framed screen, ear caps, hovering hands, status-LED plate and the glowing hover ring. Same face vocabulary as
// src/mascot/expressions.ts. Every expression is alive (CSS only, see styles/mascot.css) and respects prefers-reduced-motion.
// Decorative unless `label` is given. Pass animated={false} for a still frame.
export default function MascotAvatar({ expression = 'idle', size = 96, label = undefined, className = '', animated = true }) {
  const uid = useId().replace(/:/g, '')
  const face = FACES[expression] || FACES.idle
  const led = expression === 'prompt' ? 0 : expression === 'working' ? 1 : expression === 'success' || expression === 'happy' ? 2 : -1
  const g = n => `${n}-${uid}`
  // Each robot gets its own phase so a row of them never blinks, waves or glances in unison.
  const phase = [...uid].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7) % 90 / 10
  return (
    <svg className={`mascot-avatar ${animated ? '' : 'is-still'} ${className}`} width={size} height={size} viewBox="0 0 120 120" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false" style={{ '--m-d': `${phase}s` }}>
      <defs>
        <linearGradient id={g('cer')} x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".55" stopColor="#f1f5f9" /><stop offset="1" stopColor="#d9e0ea" /></linearGradient>
        <linearGradient id={g('hi')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#e5eaf1" /></linearGradient>
        <linearGradient id={g('gra')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1f2937" /><stop offset="1" stopColor="#0f1623" /></linearGradient>
        <clipPath id={g('scr')}><rect x="30.5" y="22.5" width="59" height="39" rx="9" /></clipPath>
      </defs>
      <ellipse className="mascot-shadow" cx="60" cy="113" rx="26" ry="3.6" fill="#0f172a" opacity=".13" />
      <ellipse className="mascot-pad" cx="60" cy="112" rx="31" ry="5" fill="none" strokeWidth="1.3" />
      <g className="mascot-bob">
        {/* body: graphite base, ceramic torso, LED plate, card slot */}
        <rect x="41" y="96" width="38" height="9" rx="4.5" fill={`url(#${g('gra')})`} />
        <rect x="37" y="71" width="46" height="29" rx="12" fill={`url(#${g('cer')})`} stroke="rgba(17,24,39,.16)" />
        <rect x="53" y="65" width="14" height="8" rx="3" fill={`url(#${g('gra')})`} />
        <rect x="44" y="79" width="32" height="11" rx="4.5" fill={`url(#${g('gra')})`} />
        <rect className={`mascot-led ${led === 0 ? 'is-on' : ''}`} x="47" y="82.5" width="7" height="4" rx="2" fill="#2dd4bf" />
        <rect className={`mascot-led ${led === 1 ? 'is-on' : ''}`} x="56.5" y="82.5" width="7" height="4" rx="2" style={{ fill: 'var(--accent)' }} />
        <rect className={`mascot-led ${led === 2 ? 'is-on' : ''}`} x="66" y="82.5" width="7" height="4" rx="2" fill="#94a3b8" />
        <rect x="50" y="93" width="20" height="2.2" rx="1.1" fill="#09090b" opacity=".85" />
        {/* floating hands */}
        <g className="mascot-hand mascot-hand-l"><rect x="22" y="80" width="12" height="15" rx="6" fill={`url(#${g('hi')})`} stroke="rgba(17,24,39,.14)" /><rect x="24.5" y="78.5" width="7" height="3.2" rx="1.6" fill="#111827" /></g>
        <g className="mascot-hand mascot-hand-r"><g className="mascot-wave"><rect x="86" y="80" width="12" height="15" rx="6" fill={`url(#${g('hi')})`} stroke="rgba(17,24,39,.14)" /><rect x="88.5" y="78.5" width="7" height="3.2" rx="1.6" fill="#111827" /></g></g>
        {/* head */}
        <g className="mascot-head">
          <g className="mascot-tab"><rect className="mascot-halo" x="52" y="4.5" width="16" height="10" rx="3.5" /><circle cx="60" cy="9.5" r="1.6" fill="#09090b" /></g>
          <rect x="20" y="12" width="80" height="60" rx="17" fill={`url(#${g('cer')})`} stroke="rgba(17,24,39,.16)" />
          <rect x="13" y="35" width="9" height="16" rx="4.5" fill={`url(#${g('gra')})`} /><rect x="11.4" y="38.5" width="3.4" height="9" rx="1.7" fill="#ffffff" />
          <rect x="98" y="35" width="9" height="16" rx="4.5" fill={`url(#${g('gra')})`} /><rect x="105.2" y="38.5" width="3.4" height="9" rx="1.7" fill="#ffffff" />
          <rect className="mascot-halo" x="27" y="19" width="66" height="46" rx="12.5" />
          <rect x="30.5" y="22.5" width="59" height="39" rx="9" fill="#08090b" />
          <g clipPath={`url(#${g('scr')})`}>
            <g className={`mascot-face mascot-${expression}`} fill="#fff4e8" stroke="#fff4e8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 3px var(--accent))' }}>{face}</g>
          </g>
          <rect x="27" y="14.5" width="30" height="3.4" rx="1.7" fill="#ffffff" opacity=".7" />
        </g>
      </g>
    </svg>
  )
}

const FACES = {
  idle: <g className="mascot-glance"><g className="mascot-eyes"><rect x="44" y="36" width="9" height="13" rx="3.5" stroke="none" /><rect x="67" y="36" width="9" height="13" rx="3.5" stroke="none" /></g></g>,
  curious: <g className="mascot-look"><g className="mascot-eyes"><rect x="44" y="38" width="8" height="11" rx="3.2" stroke="none" /><rect x="66" y="33" width="10" height="16" rx="3.8" stroke="none" /></g></g>,
  happy: <g fill="none" strokeWidth="4"><path className="mascot-hop" d="M44 46 q5 -9 10 0" /><path className="mascot-hop" d="M66 46 q5 -9 10 0" /></g>,
  working: <g stroke="none"><circle className="mascot-dot" cx="46" cy="45" r="3.4" /><circle className="mascot-dot" cx="60" cy="45" r="3.4" /><circle className="mascot-dot" cx="74" cy="45" r="3.4" /></g>,
  prompt: <g fill="none" strokeWidth="3.6"><path d="M44 35 l11 8 l-11 8" /><path className="mascot-cursor" d="M60 52 h14" /></g>,
  success: <g fill="none" strokeWidth="5"><path className="mascot-check" pathLength="40" d="M45 44 l9 9 l20 -20" /></g>,
  alert: <g className="mascot-pulse" stroke="none"><rect x="57" y="31" width="6" height="16" rx="3" /><circle cx="60" cy="53" r="3.4" /></g>,
}
