import { useRef, useEffect, useState } from 'react'
import { motion, useScroll, useSpring, useTransform } from 'framer-motion'
import { cn } from '../../lib/utils'

export function TracingBeam({ children, className }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const contentRef = useRef(null)
  const [svgHeight, setSvgHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) setSvgHeight(contentRef.current.offsetHeight)
  }, [])

  const y1 = useSpring(useTransform(scrollYProgress, [0, 0.8], [50, svgHeight]), { stiffness: 500, damping: 90 })
  const y2 = useSpring(useTransform(scrollYProgress, [0, 1], [50, svgHeight - 200]), { stiffness: 500, damping: 90 })

  return (
    <motion.div ref={ref} className={cn('relative mx-auto h-full w-full max-w-4xl', className)}>
      <div className="absolute left-6 top-3" style={{ display: svgHeight > 0 ? 'block' : 'none' }}>
        <svg viewBox={`0 0 20 ${svgHeight}`} width="20" height={svgHeight} className="hidden md:block" aria-hidden>
          <motion.path d={`M 1 0V -36 l 18 24 V ${svgHeight * 0.8} l -18 24V ${svgHeight}`} fill="none" stroke="rgba(153,69,255,0.15)" strokeWidth="1.5" />
          <motion.path d={`M 1 0V -36 l 18 24 V ${svgHeight * 0.8} l -18 24V ${svgHeight}`} fill="none" stroke="url(#gradient)" strokeWidth="1.5"
            strokeDasharray="0 1" strokeDashoffset="0" strokeLinecap="round" />
          <defs>
            <motion.linearGradient id="gradient" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={y1} y2={y2}>
              <stop stopColor="#9945ff" stopOpacity="0" />
              <stop stopColor="#9945ff" />
              <stop offset="0.325" stopColor="#19fb9b" />
              <stop offset="1" stopColor="#19fb9b" stopOpacity="0" />
            </motion.linearGradient>
          </defs>
        </svg>
      </div>
      <div ref={contentRef} className="pl-0 md:pl-14">{children}</div>
    </motion.div>
  )
}
