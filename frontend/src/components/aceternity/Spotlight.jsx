import { useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

export function Spotlight({ className, fill = 'rgba(153,69,255,0.15)' }) {
  const divRef = useRef(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [opacity, setOpacity] = useState(0)

  useEffect(() => {
    const handleMove = (e) => {
      if (!divRef.current) return
      const rect = divRef.current.getBoundingClientRect()
      setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
      setOpacity(1)
    }
    const el = divRef.current
    el?.addEventListener('mousemove', handleMove)
    return () => el?.removeEventListener('mousemove', handleMove)
  }, [])

  return (
    <div ref={divRef} className={cn('pointer-events-none absolute inset-0', className)}>
      <motion.div
        animate={{ opacity }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'absolute', borderRadius: '50%',
          width: 600, height: 600,
          left: pos.x - 300, top: pos.y - 300,
          background: `radial-gradient(circle, ${fill} 0%, transparent 70%)`,
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
