import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

export function WobbleCard({ children, containerClassName, className }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left - rect.width / 2) / rect.width
    const y = (e.clientY - rect.top - rect.height / 2) / rect.height
    setMousePos({ x: x * 10, y: y * 10 })
  }

  return (
    <motion.section
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setMousePos({ x: 0, y: 0 }) }}
      style={{ transform: isHovered ? `perspective(800px) rotateX(${-mousePos.y}deg) rotateY(${mousePos.x}deg)` : 'perspective(800px) rotateX(0deg) rotateY(0deg)', transition: 'transform 0.15s ease' }}
      className={cn('relative overflow-hidden rounded-2xl', containerClassName)}
    >
      <div className={cn('relative h-full', className)}>
        {children}
      </div>
    </motion.section>
  )
}
