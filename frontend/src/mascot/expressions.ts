// Face expressions shared by the 3D screen (canvas texture) and the 2D avatar.
export type Expression = 'idle' | 'curious' | 'working' | 'prompt' | 'success' | 'alert' | 'happy'
export const EXPRESSIONS: Expression[] = ['idle', 'curious', 'working', 'prompt', 'success', 'alert', 'happy']

export const FACE_W = 512
export const FACE_H = 410

/** Draw one expression frame. `t` is seconds since this expression started, `blink` 0..1 (1 = eyes closed). Pure canvas, no three.js, so it is testable. */
export function drawFace(ctx: CanvasRenderingContext2D, expr: Expression, t: number, blink: number, ink = '#fff4e8', glow = '#e54826') {
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
    case 'curious': { // eyes glance side to side
      const dx = Math.sin(t * 1.3) * 12
      eye(170 + dx, 64, 84, 6); eye(342 + dx, 80, 112, -8); break
    }
    case 'happy': // two upturned arcs
      ctx.lineWidth = 26
      for (const cx of [170, 342]) { ctx.beginPath(); ctx.arc(cx, cy + 26 - Math.abs(Math.sin(t * 3.2)) * 12, 46, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke() }
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
    case 'success': { // the check draws itself in, then holds
      ctx.lineWidth = 34
      const pts: Array<[number, number]> = [[138, cy + 6], [228, cy + 88], [380, cy - 84]]
      const l1 = Math.hypot(90, 82), l2 = Math.hypot(152, 172)
      const drawn = Math.min(1, t / 0.45); const e = 1 - Math.pow(1 - drawn, 3), len = e * (l1 + l2)
      ctx.beginPath(); ctx.moveTo(...pts[0])
      if (len <= l1) { const k = len / l1; ctx.lineTo(pts[0][0] + 90 * k, pts[0][1] + 82 * k) }
      else { const k = (len - l1) / l2; ctx.lineTo(...pts[1]); ctx.lineTo(pts[1][0] + 152 * k, pts[1][1] - 172 * k) }
      ctx.stroke()
      break
    }
    case 'alert': { // a gentle attention pulse
      const sc = 1 + 0.05 * Math.sin(t * 6)
      ctx.translate(256, cy); ctx.scale(sc, sc); ctx.translate(-256, -cy)
      roundRect(ctx, 234, cy - 104, 44, 120, 20); ctx.fill()
      ctx.beginPath(); ctx.arc(256, cy + 70, 24, 0, Math.PI * 2); ctx.fill()
      break
    }
  }
  ctx.restore()
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath()
}
