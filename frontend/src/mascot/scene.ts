import {
  ACESFilmicToneMapping, AmbientLight, CanvasTexture, CylinderGeometry, DirectionalLight, DoubleSide, ExtrudeGeometry, Group, HemisphereLight,
  MathUtils, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PMREMGenerator,
  PlaneGeometry, PointLight, Scene, ShadowMaterial, Shape, SRGBColorSpace, TorusGeometry, Vector3, WebGLRenderer, type Material, type Object3D,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { drawFace, FACE_H, FACE_W, type Expression } from './expressions'

export type Pose = 'hero' | 'face' | 'wide' | 'hidden'
type ThemeName = 'light' | 'dark'

interface PoseState { dist: number; camY: number; lookY: number; bodyYaw: number; headYaw: number; headPitch: number; camX: number }

// Distances are expressed as "units to fit", converted with the live aspect ratio so the robot never crops on narrow screens.
const POSES: Record<Exclude<Pose, 'hidden'>, { fitH: number; fitW: number; camY: number; lookY: number; bodyYaw: number; headYaw: number; headPitch: number; camX: number }> = {
  hero: { fitH: 4.9, fitW: 4.4, camY: 0.95, lookY: 0.25, bodyYaw: -0.34, headYaw: -0.34, headPitch: 0.1, camX: 0 },
  face: { fitH: 3.2, fitW: 3.1, camY: 1.25, lookY: 1.05, bodyYaw: -0.12, headYaw: -0.05, headPitch: 0.03, camX: 0 },
  wide: { fitH: 5.2, fitW: 4.6, camY: 0.8, lookY: 0.2, bodyYaw: 0.05, headYaw: 0.04, headPitch: 0.06, camX: 0 },
}
const FOV = 30

export interface SceneOptions { canvas: HTMLCanvasElement; theme: ThemeName; reducedMotion: boolean; lowPower: boolean; onContextLost?: () => void }

export class MascotScene {
  private renderer: WebGLRenderer
  private scene = new Scene()
  private camera = new PerspectiveCamera(FOV, 1, 0.1, 60)
  private robot = new Group()
  private head = new Group()
  private handL = new Group(); private handR = new Group()
  private leds: MeshStandardMaterial[] = []
  private halo!: MeshStandardMaterial
  private pad!: Mesh
  private hemi = new HemisphereLight(); private key = new DirectionalLight(); private rim = new DirectionalLight(); private fill = new PointLight(); private amb = new AmbientLight()
  private faceCanvas = document.createElement('canvas'); private faceCtx: CanvasRenderingContext2D
  private prevFace = document.createElement('canvas')
  private faceTex: CanvasTexture
  private expr: Expression = 'idle'; private fade = 1
  private blinkAt = 2.2; private blinkT = -1
  private cur: PoseState; private tgt: PoseState
  private pose: Pose = 'hero'; private appear = 0; private appearTarget = 1
  private ptr = { x: 0, y: 0, sx: 0, sy: 0 }
  private impulse = 0
  private raf = 0; private running = false; private last = 0; private time = 0
  private reduced: boolean; private theme: ThemeName; private lowPower: boolean
  private disposables: Array<{ dispose(): void }> = []
  private w = 1; private h = 1
  private envTex: { dispose(): void } | null = null
  private onLost: (e: Event) => void
  private ownedCanvas: HTMLCanvasElement

  constructor(o: SceneOptions) {
    this.reduced = o.reducedMotion; this.theme = o.theme; this.lowPower = o.lowPower; this.ownedCanvas = o.canvas
    this.renderer = new WebGLRenderer({ canvas: o.canvas, antialias: !o.lowPower, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.shadowMap.enabled = !o.lowPower
    this.renderer.shadowMap.type = PCFSoftShadowMap
    this.onLost = e => { e.preventDefault(); this.stop(); o.onContextLost?.() }
    o.canvas.addEventListener('webglcontextlost', this.onLost)

    const pm = new PMREMGenerator(this.renderer)
    const env = pm.fromScene(new RoomEnvironment(), 0.04)
    this.scene.environment = env.texture; this.envTex = env; pm.dispose()

    this.faceCanvas.width = this.prevFace.width = FACE_W; this.faceCanvas.height = this.prevFace.height = FACE_H
    this.faceCtx = this.faceCanvas.getContext('2d')!
    this.faceTex = new CanvasTexture(this.faceCanvas); this.faceTex.colorSpace = SRGBColorSpace; this.faceTex.anisotropy = 4
    this.disposables.push(this.faceTex)

    this.cur = this.target('hero'); this.tgt = this.cur
    this.build()
    this.scene.add(this.robot, this.hemi, this.key, this.rim, this.fill, this.amb)
    this.key.castShadow = !o.lowPower; this.key.shadow.mapSize.set(1024, 1024); this.key.shadow.radius = 6; this.key.shadow.bias = -0.0005
    this.key.shadow.camera.left = -4; this.key.shadow.camera.right = 4; this.key.shadow.camera.top = 4; this.key.shadow.camera.bottom = -4
    this.applyTheme(o.theme)
    this.paintFace(0)
  }

  // ── construction ──
  private mat<T extends Material>(m: T): T { this.disposables.push(m); return m }
  private geo<T extends { dispose(): void }>(g: T): T { this.disposables.push(g); return g }
  private add(parent: Object3D, geometry: import('three').BufferGeometry, material: Material, x = 0, y = 0, z = 0, shadow = true) {
    const m = new Mesh(this.geo(geometry), material); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m
  }

  private build() {
    const ceramic = this.mat(new MeshPhysicalMaterial({ color: 0xebe6dc, roughness: 0.34, clearcoat: 0.5, clearcoatRoughness: 0.28 }))
    const ceramicHi = this.mat(new MeshPhysicalMaterial({ color: 0xf6f2ea, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.25 }))
    const graphite = this.mat(new MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.5, metalness: 0.35 }))
    const deep = this.mat(new MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.4, metalness: 0.1 }))
    this.halo = this.mat(new MeshStandardMaterial({ color: 0xff6c4b, emissive: 0xff6c4b, emissiveIntensity: 0.6, roughness: 0.4 }))

    // head: wide square-screen shell, floating above the body (no neck)
    this.head.position.set(0, 1.12, 0)
    this.add(this.head, new RoundedBoxGeometry(1.74, 1.5, 1.2, 6, 0.3), ceramic)
    this.add(this.head, new RoundedBoxGeometry(1.4, 1.14, 0.9, 5, 0.18), graphite, 0, 0, -0.34) // dark back block
    for (let i = 0; i < 5; i++) this.add(this.head, new RoundedBoxGeometry(0.5 - i * 0.05, 0.05, 0.04, 2, 0.02), deep, 0, -0.32 + i * 0.16, -0.8, false) // vent slats
    // pinned-card tab on top: the identity mark (a listing pinned to a board)
    this.add(this.head, new RoundedBoxGeometry(0.42, 0.28, 0.18, 4, 0.07), this.halo, 0, 0.82, 0.12)
    const hole = this.add(this.head, new CylinderGeometry(0.045, 0.045, 0.2, 16), deep, 0, 0.84, 0.12, false); hole.rotation.x = Math.PI / 2
    // halo frame around the screen
    const outer = rr(1.4, 1.16, 0.22), inner = rr(1.26, 1.02, 0.15); outer.shape.holes.push(inner.shape)
    const frame = new ExtrudeGeometry(outer.shape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 12 })
    this.add(this.head, frame, this.halo, 0, 0, 0.6, false)
    // screen
    this.add(this.head, new RoundedBoxGeometry(1.28, 1.04, 0.1, 3, 0.04), deep, 0, 0, 0.58, false)
    const faceMat = this.mat(new MeshBasicMaterial({ map: this.faceTex, transparent: true, toneMapped: false }))
    const face = new Mesh(this.geo(new PlaneGeometry(1.26, 1.26 * FACE_H / FACE_W)), faceMat); face.position.set(0, 0, 0.635); this.head.add(face)
    // ears
    for (const s of [-1, 1]) {
      const ear = this.add(this.head, new CylinderGeometry(0.22, 0.22, 0.2, 28), graphite, s * 0.95, 0, 0); ear.rotation.z = Math.PI / 2
      const cap = this.add(this.head, new CylinderGeometry(0.15, 0.15, 0.05, 24), ceramicHi, s * 1.07, 0, 0, false); cap.rotation.z = Math.PI / 2
    }
    this.robot.add(this.head)

    // body: badge-shaped torso with a status-LED plate
    this.add(this.robot, new CylinderGeometry(0.2, 0.26, 0.2, 24), graphite, 0, 0.26, 0)
    this.add(this.robot, new RoundedBoxGeometry(1.3, 1.04, 0.82, 6, 0.3), ceramic, 0, -0.3, 0)
    this.add(this.robot, new RoundedBoxGeometry(0.86, 0.34, 0.06, 3, 0.1), graphite, 0, -0.14, 0.42, false)
    const ledColors = [0xffb347, 0xff6c4b, 0x5ee0b0]
    ledColors.forEach((c, i) => {
      const m = this.mat(new MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.15, roughness: 0.4 })); this.leds.push(m)
      this.add(this.robot, new RoundedBoxGeometry(0.2, 0.08, 0.04, 2, 0.03), m, -0.26 + i * 0.26, -0.14, 0.46, false)
    })
    this.add(this.robot, new RoundedBoxGeometry(0.6, 0.06, 0.04, 2, 0.02), deep, 0, -0.56, 0.42, false) // card slot
    this.add(this.robot, new RoundedBoxGeometry(0.9, 0.3, 0.7, 4, 0.12), graphite, 0, -0.88, 0)

    // floating hands (no arms): the agent hovers
    for (const [g, s] of [[this.handL, -1], [this.handR, 1]] as const) {
      g.position.set(s * 1.02, -0.36, 0.08)
      this.add(g, new RoundedBoxGeometry(0.34, 0.4, 0.34, 4, 0.14), ceramicHi)
      this.add(g, new CylinderGeometry(0.17, 0.17, 0.07, 20), graphite, 0, 0.24, 0)
      this.robot.add(g)
    }

    // hover pad + shadow catcher
    const padGeo = this.geo(new TorusGeometry(0.86, 0.014, 10, 96)); const padMat = this.mat(this.halo.clone()); padMat.emissiveIntensity = 0.4; padMat.transparent = true; padMat.opacity = 0.7
    this.pad = new Mesh(padGeo, padMat); this.pad.rotation.x = Math.PI / 2; this.pad.position.y = -1.7; this.scene.add(this.pad)
    const ground = new Mesh(this.geo(new PlaneGeometry(10, 10)), this.mat(new ShadowMaterial({ opacity: 0.16 }))); ground.rotation.x = -Math.PI / 2; ground.position.y = -1.7; ground.receiveShadow = true; this.scene.add(ground)
    this.robot.position.y = 0.1
  }

  // ── public API ──
  setExpression(e: Expression) {
    if (e === this.expr) return
    const pc = this.prevFace.getContext('2d')!; pc.clearRect(0, 0, FACE_W, FACE_H); pc.drawImage(this.faceCanvas, 0, 0)
    this.expr = e; this.fade = 0
    const led = e === 'prompt' ? 0 : e === 'working' ? 1 : e === 'success' || e === 'happy' ? 2 : -1
    this.leds.forEach((m, i) => { m.emissiveIntensity = i === led ? 1.4 : 0.15 })
    this.renderOnce()
  }
  setPose(p: Pose) { this.pose = p; if (p !== 'hidden') this.tgt = this.target(p); this.appearTarget = p === 'hidden' ? 0 : 1; this.renderOnce() }
  /** Scroll-driven camera: 0 = hero framing, ~0.3 = close-up on the face, 1 = full-body wide shot. Continuous, smoothed in step(). */
  setProgress(p: number) {
    const k = Math.min(1, Math.max(0, p))
    const ease = (t: number) => t * t * (3 - 2 * t)
    const mix = (a: PoseState, b: PoseState, t: number): PoseState => {
      const o = {} as PoseState
      for (const key of Object.keys(a) as Array<keyof PoseState>) o[key] = a[key] + (b[key] - a[key]) * t
      return o
    }
    const hero = this.target('hero'), face = this.target('face'), wide = this.target('wide')
    this.tgt = k < 0.32 ? mix(hero, face, ease(k / 0.32)) : k < 0.62 ? face : mix(face, wide, ease((k - 0.62) / 0.38))
    this.appearTarget = 1
    if (!this.running) this.renderOnce()
  }
  setPointer(nx: number, ny: number) { this.ptr.x = nx; this.ptr.y = ny }
  /** Show an expression briefly, then return to the previous one. Used for taps. */
  flash(e: Expression, ms = 1100) {
    const back = this.expr; this.setExpression(e)
    window.setTimeout(() => { if (this.expr === e) this.setExpression(back) }, ms)
  }
  /** A short acknowledgement (head dip). Used for real events only, e.g. a launch button hover or a completed action. */
  react() { this.impulse = 1; this.renderOnce() }
  applyTheme(t: ThemeName) {
    this.theme = t
    const dark = t === 'dark'
    this.scene.environmentIntensity = dark ? 0.32 : 0.9
    this.hemi.color.set(dark ? 0x7a8aa8 : 0xfff6ee); this.hemi.groundColor.set(dark ? 0x15161a : 0xd9d2c8); this.hemi.intensity = dark ? 0.35 : 0.7
    this.key.color.set(dark ? 0xdfe6ff : 0xfff3e6); this.key.intensity = dark ? 1.1 : 1.7; this.key.position.set(-3, 5, 4)
    this.rim.color.set(dark ? 0xff7a5a : 0xfff0e6); this.rim.intensity = dark ? 2.6 : 1.1; this.rim.position.set(4, 2.2, -4)
    this.fill.color.set(dark ? 0xffc9b8 : 0xffd9cc); this.fill.intensity = dark ? 3.2 : 2; this.fill.distance = 9; this.fill.position.set(-3, 1, 1.5)
    this.amb.intensity = dark ? 0.05 : 0.1
    const brand = dark ? 0xfb704f : 0xe54826; this.halo.color.set(brand); this.halo.emissive.set(brand)
    this.halo.emissiveIntensity = dark ? 0.9 : 0.35
    ;(this.pad.material as MeshStandardMaterial).color.set(brand); (this.pad.material as MeshStandardMaterial).emissive.set(brand)
    this.renderOnce()
  }
  resize(w: number, h: number, dpr: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h)
    this.renderer.setPixelRatio(Math.min(dpr, this.lowPower ? 1.5 : 2)); this.renderer.setSize(this.w, this.h, false)
    this.camera.aspect = this.w / this.h; this.camera.updateProjectionMatrix()
    if (this.pose !== 'hidden') { this.tgt = this.target(this.pose); if (this.reduced || !this.running) this.cur = { ...this.tgt } }
    this.renderOnce()
  }
  start() { if (this.running || this.reduced) { this.renderOnce(); return } this.running = true; this.last = performance.now(); this.raf = requestAnimationFrame(this.tick) }
  stop() { this.running = false; cancelAnimationFrame(this.raf) }
  dispose() {
    this.stop()
    this.ownedCanvas.removeEventListener('webglcontextlost', this.onLost)
    this.disposables.forEach(d => d.dispose()); this.envTex?.dispose()
    this.renderer.dispose(); this.renderer.forceContextLoss()
  }

  // ── internals ──
  private target(p: Exclude<Pose, 'hidden'>): PoseState {
    const d = POSES[p]; const k = 1 / (2 * Math.tan(MathUtils.degToRad(FOV / 2)))
    const dist = Math.max(d.fitH * k, (d.fitW * k) / Math.max(0.2, this.camera.aspect))
    return { dist, camY: d.camY, lookY: d.lookY, bodyYaw: d.bodyYaw, headYaw: d.headYaw, headPitch: d.headPitch, camX: d.camX }
  }
  private tick = (now: number) => {
    if (!this.running) return
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.time += dt
    this.step(dt); this.raf = requestAnimationFrame(this.tick)
  }
  private renderOnce() { if (this.running) return; this.step(0.016, true) }
  private paintFace(dt: number) {
    if (this.blinkT >= 0) { this.blinkT += dt; if (this.blinkT > 0.18) this.blinkT = -1 }
    else if (this.time > this.blinkAt) { this.blinkT = 0; this.blinkAt = this.time + 2.5 + Math.random() * 3 }
    const blink = this.blinkT < 0 ? 0 : Math.sin((this.blinkT / 0.18) * Math.PI)
    drawFace(this.faceCtx, this.expr, this.time, this.expr === 'idle' || this.expr === 'curious' ? blink : 0)
    if (this.fade < 1) { this.fade = Math.min(1, this.fade + (dt || 0.016) * 5); this.faceCtx.globalAlpha = 1 - this.fade; this.faceCtx.drawImage(this.prevFace, 0, 0); this.faceCtx.globalAlpha = 1 }
    this.faceTex.needsUpdate = true
  }
  private step(dt: number, force = false) {
    const t = this.time
    const k = this.reduced ? 1 : 1 - Math.pow(0.001, dt * 1.4) // frame-rate independent smoothing
    for (const key of Object.keys(this.cur) as Array<keyof PoseState>) this.cur[key] += (this.tgt[key] - this.cur[key]) * (force && this.reduced ? 1 : k)
    this.ptr.sx += (this.ptr.x - this.ptr.sx) * (this.reduced ? 0 : 0.08); this.ptr.sy += (this.ptr.y - this.ptr.sy) * (this.reduced ? 0 : 0.08)
    this.appear += (this.appearTarget - this.appear) * (this.reduced ? 1 : 0.06)
    this.impulse = Math.max(0, this.impulse - dt * 1.6)
    const idle = this.reduced ? 0 : 1
    this.robot.position.y = 0.1 + Math.sin(t * 1.3) * 0.045 * idle
    this.robot.rotation.y = this.cur.bodyYaw + this.ptr.sx * 0.1
    this.head.rotation.y = this.cur.headYaw - this.cur.bodyYaw + this.ptr.sx * 0.42
    this.head.rotation.x = -(this.cur.headPitch) - this.ptr.sy * 0.16 + Math.sin(t * 0.9) * 0.02 * idle + Math.sin(this.impulse * Math.PI) * 0.16
    this.head.rotation.z = Math.sin(t * 0.7) * 0.02 * idle
    this.handL.position.y = -0.36 + Math.sin(t * 1.3 + 1) * 0.04 * idle; this.handR.position.y = -0.36 + Math.sin(t * 1.3 + 2.2) * 0.04 * idle
    this.handR.rotation.z = Math.sin(t * 1.1) * 0.06 * idle
    ;(this.pad.material as MeshStandardMaterial).emissiveIntensity = (this.theme === 'dark' ? 0.55 : 0.3) + Math.sin(t * 1.6) * 0.12 * idle
    const s = 0.9 + 0.1 * this.appear; this.robot.scale.setScalar(s); this.robot.visible = this.appear > 0.01
    this.camera.position.set(this.cur.camX + this.ptr.sx * 0.22, this.cur.camY - this.ptr.sy * 0.08, this.cur.dist)
    this.camera.lookAt(new Vector3(0, this.cur.lookY, 0))
    this.paintFace(dt)
    this.renderer.render(this.scene, this.camera)
  }
}

function rr(w: number, h: number, r: number) {
  const x = -w / 2, y = -h / 2
  const path = new Shape()
  path.moveTo(x + r, y); path.lineTo(x + w - r, y); path.quadraticCurveTo(x + w, y, x + w, y + r); path.lineTo(x + w, y + h - r)
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h); path.lineTo(x + r, y + h); path.quadraticCurveTo(x, y + h, x, y + h - r)
  path.lineTo(x, y + r); path.quadraticCurveTo(x, y, x + r, y)
  return { shape: path, path: path.clone() as unknown as import('three').Path }
}
void DoubleSide
