import { useEffect, useRef, useCallback } from 'react'
import { cn } from '../../lib/utils'

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : { r: 153, g: 69, b: 255 }
}

export function Particles({ className, quantity = 80, staticity = 50, ease = 50, size = 0.4, color = '#9945ff', vx = 0, vy = 0 }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const circles = useRef([])
  const mouse = useRef({ x: 0, y: 0 })
  const canvasSize = useRef({ w: 0, h: 0 })
  const animRef = useRef(null)
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
  const rgb = hexToRgb(color)

  const drawCircle = useCallback((circle, update = false) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y, translateX, translateY, size: s, alpha } = circle
    ctx.translate(translateX, translateY)
    ctx.beginPath()
    ctx.arc(x, y, s, 0, 2 * Math.PI)
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`
    ctx.fill()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (!update) circles.current.push(circle)
  }, [rgb, dpr])

  const newCircle = useCallback(() => ({
    x: Math.floor(Math.random() * canvasSize.current.w),
    y: Math.floor(Math.random() * canvasSize.current.h),
    translateX: 0, translateY: 0,
    size: Math.floor(Math.random() * 2) + size,
    alpha: 0, targetAlpha: parseFloat((Math.random() * 0.6 + 0.1).toFixed(1)),
    dx: (Math.random() - 0.5) * 0.2, dy: (Math.random() - 0.5) * 0.2,
    magnetism: 0.1 + Math.random() * 4,
  }), [size])

  const initCanvas = useCallback(() => {
    if (!containerRef.current || !canvasRef.current) return
    const w = containerRef.current.offsetWidth
    const h = containerRef.current.offsetHeight
    canvasSize.current = { w, h }
    canvasRef.current.width = w * dpr
    canvasRef.current.height = h * dpr
    canvasRef.current.style.width = `${w}px`
    canvasRef.current.style.height = `${h}px`
    const ctx = canvasRef.current.getContext('2d')
    ctx.scale(dpr, dpr)
    circles.current = []
    for (let i = 0; i < quantity; i++) drawCircle(newCircle())
  }, [dpr, quantity, drawCircle, newCircle])

  useEffect(() => {
    initCanvas()

    const animate = () => {
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h)
      circles.current.forEach((c, i) => {
        const edge = [
          c.x + c.translateX - c.size,
          canvasSize.current.w - c.x - c.translateX - c.size,
          c.y + c.translateY - c.size,
          canvasSize.current.h - c.y - c.translateY - c.size,
        ]
        const closest = Math.min(...edge)
        const remapAlpha = Math.max(Math.min(closest / 20, 1), 0) * c.targetAlpha
        c.alpha = c.alpha < remapAlpha ? Math.min(c.alpha + 0.02, remapAlpha) : Math.max(c.alpha - 0.02, 0)
        c.x += c.dx + vx
        c.y += c.dy + vy
        c.translateX += (mouse.current.x / (staticity / c.magnetism) - c.translateX) / ease
        c.translateY += (mouse.current.y / (staticity / c.magnetism) - c.translateY) / ease
        drawCircle(c, true)
        if (c.x < -c.size || c.x > canvasSize.current.w + c.size || c.y < -c.size || c.y > canvasSize.current.h + c.size) {
          circles.current.splice(i, 1)
          drawCircle(newCircle())
        }
      })
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)

    const onMouseMove = (e) => {
      if (!canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      mouse.current = {
        x: e.clientX - rect.left - canvasSize.current.w / 2,
        y: e.clientY - rect.top - canvasSize.current.h / 2,
      }
    }

    const onResize = () => {
      // Cancel animation before reinit to avoid duplicate loops
      if (animRef.current) cancelAnimationFrame(animRef.current)
      initCanvas()
      animRef.current = requestAnimationFrame(animate)
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
    }
  }, [initCanvas, drawCircle, newCircle, ease, staticity, vx, vy])

  return (
    <div ref={containerRef} className={cn('pointer-events-none', className)} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}
