/* Original organic blob shapes — inspired by bu.finance's irregular-card
   pattern but drawn from scratch, no copied assets. */

export function BlobCard({ color = '#7C5CFC', opacity = 1, style }) {
  return (
    <svg viewBox="0 0 400 320" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', ...style }} preserveAspectRatio="none">
      <path
        d="M40,0 H360 C382,0 400,18 400,40 V220 C400,260 370,290 330,290 H180 C160,290 145,300 130,312 C115,324 95,320 90,300 L84,280 C80,266 68,256 52,256 H40 C18,256 0,238 0,216 V40 C0,18 18,0 40,0 Z"
        fill={color} opacity={opacity}
      />
    </svg>
  )
}

export function BlobCardReverse({ color = '#f472b6', opacity = 1, style }) {
  return (
    <svg viewBox="0 0 400 320" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', ...style }} preserveAspectRatio="none">
      <path
        d="M40,0 H360 C382,0 400,18 400,40 V216 C400,238 382,256 360,256 H348 C332,256 320,266 316,280 L310,300 C305,320 285,324 270,312 C255,300 240,290 220,290 H70 C30,290 0,260 0,220 V40 C0,18 18,0 40,0 Z"
        fill={color} opacity={opacity}
      />
    </svg>
  )
}

/* Soft organic blob for ambient backgrounds — replaces hard-edged radial circles */
export function AmbientBlob({ color = 'rgba(124,92,252,0.18)', style }) {
  return (
    <svg viewBox="0 0 600 600" style={{ position: 'absolute', ...style }}>
      <path
        d="M300,40 C420,40 540,100 560,220 C580,340 520,460 400,520 C280,580 140,560 80,460 C20,360 40,220 120,140 C160,100 220,40 300,40 Z"
        fill={color}
      />
    </svg>
  )
}

/* Folder-style decorative shape (flat color block behind cards, bu.finance style) */
export function FolderShape({ color = '#fce8f8', style, flip = false }) {
  return (
    <svg viewBox="0 0 500 380" style={{ position: 'absolute', transform: flip ? 'scaleX(-1)' : 'none', ...style }} preserveAspectRatio="none">
      <path
        d="M30,60 C30,30 55,10 85,10 H220 C240,10 255,20 265,36 L280,58 C290,74 308,84 328,84 H440 C468,84 490,106 490,134 V320 C490,350 466,374 436,374 H64 C34,374 10,350 10,320 V94 C10,80 18,68 30,60 Z"
        fill={color}
      />
    </svg>
  )
}
