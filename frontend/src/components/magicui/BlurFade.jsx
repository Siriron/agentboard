import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { cn } from '../../lib/utils'

export function BlurFade({ children, className, variant, duration = 0.4, delay = 0, yOffset = 16, inView = false, inViewMargin = '-50px', blur = '6px' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: inViewMargin })
  const defaultVariants = {
    hidden: { y: yOffset, opacity: 0, filter: `blur(${blur})` },
    visible: { y: 0, opacity: 1, filter: 'blur(0px)' },
  }
  const combinedVariants = variant || defaultVariants
  const isVisible = !inView || isInView
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isVisible ? 'visible' : 'hidden'}
      variants={combinedVariants}
      transition={{ delay: 0.04 + delay, duration, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
