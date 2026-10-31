import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTheme } from '../theme/useTheme'
import MascotAvatar from './MascotAvatar'

// Mounts the three.js scene. This file (and three itself) is only loaded through React.lazy on the landing page.
// Falls back to the 2D avatar if WebGL is unavailable or the context is lost. Pauses when off-screen or the tab is hidden.
const Mascot3D = forwardRef(function Mascot3D({ expression = 'idle', pose = 'hero', fallbackSize = 220, label = 'AgentBoard agent' }, ref) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const sceneRef = useRef(null)
  const { resolved } = useTheme()
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const themeRef = useRef(resolved); themeRef.current = resolved
  // Imperative handle so scroll progress can be fed every frame without re-rendering React.
  useImperativeHandle(ref, () => ({ setProgress: p => sceneRef.current?.setProgress(p), react: () => sceneRef.current?.react() }), [])

  useEffect(() => {
    let disposed = false, ro, io, onVis, onMove, onDown, onUp, scene
    const canvas = canvasRef.current, wrap = wrapRef.current
    ;(async () => {
      try {
        const { MascotScene } = await import('./scene')
        if (disposed) return
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const coarse = window.matchMedia('(pointer: coarse)').matches
        const lowPower = coarse || (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
        scene = new MascotScene({ canvas, theme: themeRef.current, reducedMotion: reduced, lowPower: !!lowPower, onContextLost: () => setFailed(true) })
        sceneRef.current = scene
        const fit = () => { const r = wrap.getBoundingClientRect(); scene.resize(r.width, r.height, window.devicePixelRatio || 1) }
        fit(); ro = new ResizeObserver(fit); ro.observe(wrap)
        let visible = true
        const update = () => { (visible && !document.hidden) ? scene.start() : scene.stop() }
        io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; update() }, { threshold: 0.01 }); io.observe(wrap)
        onVis = update; document.addEventListener('visibilitychange', onVis)
        if (!reduced) {
          // Mouse: the head follows the cursor anywhere on the page. Touch: only while a finger is on the mascot, and
          // vertical scrolling is never blocked (touch-action: pan-y; the browser fires pointercancel when a scroll starts).
          onMove = e => {
            if (e.pointerType === 'touch') { const r = wrap.getBoundingClientRect(); scene.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1) }
            else scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
          }
          window.addEventListener('pointermove', onMove, { passive: true })
        }
        onDown = e => { scene.react(); scene.flash(e.pointerType === 'touch' ? 'happy' : 'curious'); if (e.pointerType === 'touch') onMove(e) }
        onUp = () => scene.setPointer(0, 0)
        wrap.addEventListener('pointerdown', onDown); wrap.addEventListener('pointerup', onUp); wrap.addEventListener('pointercancel', onUp)
        scene.start(); setReady(true)
      } catch (err) { console.warn('[mascot] WebGL unavailable, using 2D fallback:', err); if (!disposed) setFailed(true) }
    })()
    return () => {
      disposed = true
      ro?.disconnect(); io?.disconnect()
      if (onVis) document.removeEventListener('visibilitychange', onVis)
      if (onMove) window.removeEventListener('pointermove', onMove)
      if (onDown) { wrap.removeEventListener('pointerdown', onDown); wrap.removeEventListener('pointerup', onUp); wrap.removeEventListener('pointercancel', onUp) }
      scene?.dispose(); sceneRef.current = null
    }
  }, [])

  useEffect(() => { sceneRef.current?.applyTheme(resolved) }, [resolved])
  useEffect(() => { sceneRef.current?.setExpression(expression) }, [expression, ready])
  useEffect(() => { sceneRef.current?.setPose(pose) }, [pose, ready])

  if (failed) return <div className="mascot-fallback" style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%' }}><MascotAvatar expression={expression} size={fallbackSize} label={label} /></div>
  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%', position: 'relative', touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', cursor: 'pointer' }}>
      <canvas ref={canvasRef} role="img" aria-label={label} style={{ width: '100%', height: '100%', display: 'block', opacity: ready ? 1 : 0, transition: 'opacity .6s var(--ease-out)' }} />
      {!ready && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><MascotAvatar expression="idle" size={fallbackSize * 0.6} /></div>}
    </div>
  )
})
export default Mascot3D
