import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

export function BackgroundBeams({ className }) {
  const beams = [
    { top: '20%', left: '10%', delay: 0, duration: 7 },
    { top: '60%', left: '20%', delay: 1.5, duration: 9 },
    { top: '10%', left: '60%', delay: 2, duration: 6 },
    { top: '70%', left: '80%', delay: 0.5, duration: 8 },
    { top: '40%', left: '50%', delay: 3, duration: 10 },
  ]
  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)}>
      {beams.map((b, i) => (
        <motion.div key={i}
          style={{ top: b.top, left: b.left, position: 'absolute' }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0.15, 0], scale: [0.5, 1.5, 0.5] }}
          transition={{ delay: b.delay, duration: b.duration, repeat: Infinity, ease: 'easeInOut' }}>
          <div style={{ width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,92,252,0.3) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        </motion.div>
      ))}
      {/* Grid overlay */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(124,92,252,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(124,92,252,0.03) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
    </div>
  )
}
