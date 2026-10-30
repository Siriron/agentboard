// Face expressions shared by the 3D screen (canvas texture) and the 2D avatar.
export type Expression = 'idle' | 'curious' | 'working' | 'prompt' | 'success' | 'alert' | 'happy'
export const EXPRESSIONS: Expression[] = ['idle', 'curious', 'working', 'prompt', 'success', 'alert', 'happy']

export const FACE_W = 512
export const FACE_H = 410

/** Draw one expression frame. `t` is seconds, `blink` 0..1 (1 = eyes closed). Pure canvas, no three.js, so it is testable. */
export function drawFace(ctx: CanvasRenderingContext2D, expr: Expression, t: number, blink: number, ink = '#fff4e8', glow = '#ff6c4b') {
  const w = FACE_W, h = FACE_H
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#08090b'
  roundRect(ctx, 0, 0, w, h, 54); ctx.fill()
  ctx.save()
  roundRect(ctx, 0, 0, w, h, 54); ctx.clip()
  // faint scanlines
  ctx.fillStyle = 'rgba(255,255,255,.025)'
  for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 1)
  ctx.shadowColor = glow; ctx.shadowBlur = 26; ctx.fillStyle = ink; ctx.strokeStyle = ink
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const cy = h * 0.5
  const eye = (cx: number, ew: number, eh: number, oy = 0) => {
    const k = 1 - 0.9 * blink
    roundRect(ctx, cx - ew / 2, cy + oy - (eh * k) / 2, ew, eh * k, Math.min(ew, eh * k) * 0.38); ctx.fill()
  }
  switch (expr) {
    case 'idle': eye(170, 72, 96); eye(342, 72, 96); break
    case 'curious': eye(170, 64, 84, 6); eye(342, 80, 112, -8); break
    case 'happy': // two upturned arcs
      ctx.lineWidth = 26
      for (const cx of [170, 342]) { ctx.beginPath(); ctx.arc(cx, cy + 26, 46, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke() }
      break
    case 'working': {
      for (let i = 0; i < 3; i++) {
        const k = (Math.sin(t * 5 - i * 0.9) + 1) / 2
        ctx.beginPath(); ctx.arc(150 + i * 106, cy + 16 - k * 30, 24 + k * 6, 0, Math.PI * 2); ctx.fill()
      }
      break
    }
    case 'prompt': {
      ctx.lineWidth = 24
      ctx.beginPath(); ctx.moveTo(130, cy - 64); ctx.lineTo(214, cy); ctx.lineTo(130, cy + 64); ctx.stroke()
      if (Math.floor(t * 2) % 2 === 0) roundRect(ctx, 262, cy + 40, 108, 24, 10), ctx.fill()
      break
    }
    case 'success':
      ctx.lineWidth = 34
      ctx.beginPath(); ctx.moveTo(138, cy + 6); ctx.lineTo(228, cy + 88); ctx.lineTo(380, cy - 84); ctx.stroke()
      break
    case 'alert':
      roundRect(ctx, 234, cy - 104, 44, 120, 20); ctx.fill()
      ctx.beginPath(); ctx.arc(256, cy + 70, 24, 0, Math.PI * 2); ctx.fill()
      break
  }
  ctx.restore()
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath()
}
