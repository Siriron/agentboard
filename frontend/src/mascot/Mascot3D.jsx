import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTheme } from '../theme/useTheme'
import MascotAvatar from './MascotAvatar'
import RobotPoster from './RobotPoster'

// Mounts the three.js scene. This file (and three itself) is only loaded through React.lazy.
// Falls back to the 2D avatar if WebGL is unavailable or the context keeps getting lost. Pauses when off-screen or the tab is hidden.
//
// Scene pool: building a scene (geometry, environment map, shader compile) is the slow part, so it is not tied to the
// component. When a robot unmounts (route change, network switch) its scene and canvas are parked for a while and the
// next robot picks them up instantly, with no teardown, no rebuild and no 2D/poster flash. Parked scenes are disposed
// after IDLE_MS. prewarmMascot() builds one ahead of time so the first robot on a page is ready as early as possible.
const IDLE_MS = 30_000
let parked = null // { scene, canvas, timer, dead, shown, onLost }
let building = null // in-flight creation, so a prewarm and a mount never build two scenes

const currentTheme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

async function createEntry(theme) {
  const { MascotScene } = await import('./scene')
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const lowPower = !!(coarse || (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4))
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'width:100%;height:100%;display:block'
  const entry = { scene: null, canvas, timer: 0, dead: false, shown: false, onLost: null }
  entry.scene = new MascotScene({ canvas, theme, reducedMotion: reduced, lowPower, onContextLost: () => { entry.dead = true; entry.onLost?.() } })
  return entry
}

function disposeEntry(e) { clearTimeout(e.timer); try { e.scene.dispose() } catch { /* already gone */ } e.canvas.remove() }

function park(e) {
  if (parked && parked !== e) disposeEntry(parked)
  parked = e; clearTimeout(e.timer)
  e.timer = setTimeout(() => { if (parked === e) { parked = null; disposeEntry(e) } }, IDLE_MS)
}

async function acquire(theme) {
  if (building) { try { await building } catch { /* fall through and try again */ } }
  if (parked && !parked.dead) { const e = parked; parked = null; clearTimeout(e.timer); return e }
  if (parked) { disposeEntry(parked); parked = null }
  return createEntry(theme)
}

function release(e) {
  e.onLost = null
  try { e.scene.stop() } catch { /* ignore */ }
  e.canvas.remove()
  if (e.dead) disposeEntry(e); else park(e)
}

/** Build a scene in the background and park it, including the first render so shaders are already compiled. */
export function prewarmMascot() {
  if (typeof document === 'undefined' || parked || building) return
  building = createEntry(currentTheme())
    .then(e => { try { e.scene.resize(640, 640, 1) } catch { /* ignore */ } if (parked) disposeEntry(e); else park(e) })
    .catch(() => { /* no WebGL: the mounted component reports it and shows the fallback */ })
    .finally(() => { building = null })
}

const Mascot3D = forwardRef(function Mascot3D({ expression = 'idle', pose = 'hero', fallbackSize = 220, label = 'AgentBoard agent' }, ref) {
  const wrapRef = useRef(null)
  const hostRef = useRef(null)
  const sceneRef = useRef(null)
  const { resolved } = useTheme()
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [attempt, setAttempt] = useState(0) // a lost WebGL context gets two fresh starts before the 2D robot takes over
  const lost = useRef(0)
  const themeRef = useRef(resolved); themeRef.current = resolved
  const exprRef = useRef(expression); exprRef.current = expression
  const poseRef = useRef(pose); poseRef.current = pose
  // Imperative handle so scroll progress can be fed every frame without re-rendering React.
  useImperativeHandle(ref, () => ({ setProgress: p => sceneRef.current?.setProgress(p), react: () => sceneRef.current?.react() }), [])

  useEffect(() => {
    let disposed = false, entry = null, undo = null
    const wrap = wrapRef.current, host = hostRef.current
    ;(async () => {
      try {
        entry = await acquire(themeRef.current)
        if (disposed) { release(entry); entry = null; return }
        const scene = entry.scene
        entry.onLost = () => { if (++lost.current <= 2) { setReady(false); setAttempt(n => n + 1) } else setFailed(true) }
        sceneRef.current = scene
        // State first, then size: resize snaps the camera to the pose while the scene is stopped, so a reused scene
        // never glides in from wherever the previous page left it. The face change still cross-fades.
        scene.applyTheme(themeRef.current); scene.setPose(poseRef.current); scene.setExpression(exprRef.current)
        if (entry.shown) { entry.canvas.style.transition = 'none'; entry.canvas.style.opacity = '1'; host.appendChild(entry.canvas) }
        else { entry.canvas.style.opacity = '0'; host.appendChild(entry.canvas) }
        const fit = () => { const r = wrap.getBoundingClientRect(); scene.resize(r.width, r.height, window.devicePixelRatio || 1) }
        fit()
        if (!entry.shown) { void entry.canvas.offsetWidth; entry.canvas.style.transition = 'opacity .5s var(--ease-out)'; entry.canvas.style.opacity = '1'; entry.shown = true }
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const ro = new ResizeObserver(fit); ro.observe(wrap)
        let visible = true
        const update = () => { (visible && !document.hidden) ? scene.start() : scene.stop() }
        const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; update() }, { threshold: 0.01 }); io.observe(wrap)
        document.addEventListener('visibilitychange', update)
        let onMove, onEnd
        if (!reduced) {
          // Mouse: the head follows the cursor anywhere on the page. Touch: only while a finger is on the mascot, and
          // vertical scrolling is never blocked (touch-action: pan-y; the browser fires pointercancel when a scroll starts).
          onMove = e => {
            if (e.pointerType === 'touch') { const r = wrap.getBoundingClientRect(); scene.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1) }
            else scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
          }
          window.addEventListener('pointermove', onMove, { passive: true })
          onEnd = e => { if (e.pointerType === 'touch') scene.setPointer(0, 0) } // a finger lifted or a scroll began anywhere: head back to centre
          window.addEventListener('pointerup', onEnd); window.addEventListener('pointercancel', onEnd)
        }
        // Drag to spin: horizontal movement rotates the robot (about 520px = one full turn). Vertical movement is left to the
        // browser so the page still scrolls on touch; the browser then fires pointercancel and the spin is released.
        const drag = { id: -1, x: 0, y: 0, t: 0, on: false }
        const onDown = e => {
          scene.react(); scene.flash(e.pointerType === 'touch' ? 'happy' : 'curious'); if (e.pointerType === 'touch') onMove?.(e)
          drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY; drag.t = performance.now(); drag.on = false
        }
        const onDrag = e => {
          if (e.pointerId !== drag.id) return
          const dx = e.clientX - drag.x, dy = e.clientY - drag.y
          if (!drag.on) {
            if (Math.abs(dx) < 5 || Math.abs(dx) < Math.abs(dy)) return
            drag.on = true; try { wrap.setPointerCapture(e.pointerId) } catch { /* ignore */ }
            wrap.style.cursor = 'grabbing'
          }
          const now = performance.now(); scene.dragBy(dx * 0.012, (now - drag.t) / 1000)
          drag.x = e.clientX; drag.y = e.clientY; drag.t = now
        }
        const onUp = () => { drag.id = -1; if (drag.on) { drag.on = false; scene.endDrag(); wrap.style.cursor = '' } scene.setPointer(0, 0) }
        wrap.addEventListener('pointerdown', onDown); wrap.addEventListener('pointermove', onDrag, { passive: true })
        wrap.addEventListener('pointerup', onUp); wrap.addEventListener('pointercancel', onUp)
        undo = () => {
          ro.disconnect(); io.disconnect()
          document.removeEventListener('visibilitychange', update)
          if (onMove) window.removeEventListener('pointermove', onMove)
          if (onEnd) { window.removeEventListener('pointerup', onEnd); window.removeEventListener('pointercancel', onEnd) }
          wrap.removeEventListener('pointerdown', onDown); wrap.removeEventListener('pointermove', onDrag)
          wrap.removeEventListener('pointerup', onUp); wrap.removeEventListener('pointercancel', onUp)
          wrap.style.cursor = ''; scene.endDrag(); scene.setPointer(0, 0)
        }
        update(); setReady(true)
      } catch (err) {
        console.warn('[mascot] WebGL unavailable, using 2D fallback:', err)
        if (entry) { disposeEntry(entry); entry = null }
        if (!disposed) setFailed(true)
      }
    })()
    return () => {
      disposed = true
      undo?.(); sceneRef.current = null
      if (entry) release(entry)
    }
  }, [attempt])

  useEffect(() => { sceneRef.current?.applyTheme(resolved) }, [resolved])
  useEffect(() => { sceneRef.current?.setExpression(expression) }, [expression, ready])
  useEffect(() => { sceneRef.current?.setPose(pose) }, [pose, ready])

  // Until the live 3D scene is ready show a snapshot of the same 3D robot (never the 2D cartoon), so nothing visibly
  // swaps when the real one fades in. If WebGL can never start, the idle face keeps the snapshot; other faces use the
  // 2D avatar because they carry state (working, success, alert).
  if (failed) return <div className="mascot-fallback" style={{ position: 'relative', width: '100%', height: '100%' }}>{expression === 'idle' ? <RobotPoster /> : <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%' }}><MascotAvatar expression={expression} size={fallbackSize} label={label} /></div>}</div>
  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%', position: 'relative', touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', cursor: 'grab' }}>
      <div ref={hostRef} role="img" aria-label={label} style={{ position: 'absolute', inset: 0 }} />
      <RobotPoster gone={ready} />
    </div>
  )
})
export default Mascot3D
