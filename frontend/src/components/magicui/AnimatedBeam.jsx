import { useEffect, useId, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

export function AnimatedBeam({ className, containerRef, fromRef, toRef, curvature = 0, reverse = false, pathColor = 'rgba(124,92,252,0.2)', pathWidth = 2, pathOpacity = 0.2, gradientStartColor = '#7C5CFC', gradientStopColor = '#10b981', delay = 0, duration = Math.random() * 3 + 4, startXOffset = 0, startYOffset = 0, endXOffset = 0, endYOffset = 0 }) {
  const id = useId()
  const [pathD, setPathD] = useState('')
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const updatePath = () => {
      if (!containerRef?.current || !fromRef?.current || !toRef?.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const fromRect = fromRef.current.getBoundingClientRect()
      const toRect = toRef.current.getBoundingClientRect()
      const svgW = containerRect.width
      const svgH = containerRect.height
      setSvgDimensions({ width: svgW, height: svgH })
      const startX = fromRect.left - containerRect.left + fromRect.width / 2 + startXOffset
      const startY = fromRect.top - containerRect.top + fromRect.height / 2 + startYOffset
      const endX = toRect.left - containerRect.left + toRect.width / 2 + endXOffset
      const endY = toRect.top - containerRect.top + toRect.height / 2 + endYOffset
      const cpX = (startX + endX) / 2
      const cpY = (startY + endY) / 2 - curvature
      setPathD(`M ${startX},${startY} Q ${cpX},${cpY} ${endX},${endY}`)
    }
    updatePath()
    const obs = new ResizeObserver(updatePath)
    if (containerRef?.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [containerRef, fromRef, toRef, curvature, startXOffset, startYOffset, endXOffset, endYOffset])

  return (
    <svg fill="none" width={svgDimensions.width} height={svgDimensions.height}
      xmlns="http://www.w3.org/2000/svg" className={cn('pointer-events-none absolute left-0 top-0 transform-gpu stroke-2', className)} viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}>
      <path d={pathD} stroke={pathColor} strokeWidth={pathWidth} strokeOpacity={pathOpacity} strokeLinecap="round" />
      <path d={pathD} strokeWidth={pathWidth} stroke={`url(#${id})`} strokeOpacity="1" strokeLinecap="round" />
      <defs>
        <motion.linearGradient className="transform-gpu" id={id} gradientUnits="userSpaceOnUse"
          initial={{ x1: '0%', x2: '0%', y1: '0%', y2: '0%' }}
          animate={reverse
            ? { x1: ['90%', '-10%'], x2: ['100%', '0%'], y1: ['0%', '0%'], y2: ['0%', '0%'] }
            : { x1: ['10%', '110%'], x2: ['0%', '100%'], y1: ['0%', '0%'], y2: ['0%', '0%'] }}
          transition={{ delay, duration, ease: [0.16, 1, 0.3, 1], repeat: Infinity, repeatDelay: 0 }}>
          <stop stopColor={gradientStartColor} stopOpacity="0" />
          <stop stopColor={gradientStartColor} />
          <stop offset="32.5%" stopColor={gradientStopColor} />
          <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
        </motion.linearGradient>
      </defs>
    </svg>
  )
}

export function Circle({ ref, className, children }) {
  return (
    <div ref={ref} className={cn('z-10 flex h-12 w-12 items-center justify-center rounded-full border bg-white shadow-[0_0_20px_-12px_rgba(0,0,0,0.8)]', className)}>
      {children}
    </div>
  )
}
