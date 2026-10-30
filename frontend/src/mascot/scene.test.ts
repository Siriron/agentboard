// Smoke test without a GPU: stub the renderer and 2D canvas, then build the real scene graph and run frames.
// Catches construction-order bugs, invalid geometry and per-frame exceptions. It does NOT prove how the robot looks.
import { describe, expect, it, vi } from 'vitest'

vi.mock('three', async orig => {
  const real = await orig<typeof import('three')>()
  class FakeRenderer {
    shadowMap = { enabled: false, type: 0 }; toneMapping = 0; outputColorSpace = ''; renders = 0
    setClearColor() {} setPixelRatio() {} setSize() {} render() { this.renders++ } dispose() {} forceContextLoss() {}
    constructor() { (globalThis as any).__r = this }
  }
  class FakePMREM { fromScene() { return { texture: {}, dispose() {} } } dispose() {} }
  return { ...real, WebGLRenderer: FakeRenderer, PMREMGenerator: FakePMREM }
})

const ctx = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? {} : () => {}), set: () => true })
;(globalThis as any).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) }
;(globalThis as any).requestAnimationFrame = () => 1
;(globalThis as any).cancelAnimationFrame = () => {}

describe('MascotScene', () => {
  it('builds, animates every pose and expression, and disposes', async () => {
    const { MascotScene } = await import('./scene')
    const { EXPRESSIONS } = await import('./expressions')
    const canvas = { addEventListener() {}, removeEventListener() {} } as unknown as HTMLCanvasElement
    for (const theme of ['light', 'dark'] as const) {
      const s = new MascotScene({ canvas, theme, reducedMotion: false, lowPower: false })
      s.resize(390, 420, 2)
      for (const p of ['hero', 'face', 'wide', 'hidden'] as const) { s.setPose(p); (s as any).step(0.016) }
      for (const e of EXPRESSIONS) { s.setExpression(e); for (let i = 0; i < 20; i++) (s as any).step(0.05) }
      s.setPointer(0.4, -0.2); s.react(); s.applyTheme(theme === 'dark' ? 'light' : 'dark'); (s as any).step(0.016)
      expect((globalThis as any).__r.renders).toBeGreaterThan(20)
      s.dispose()
    }
    const r = new MascotScene({ canvas, theme: 'light', reducedMotion: true, lowPower: true }); r.resize(300, 300, 1); r.start(); r.dispose()
  })
})
