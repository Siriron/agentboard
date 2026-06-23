import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'
import { cn } from '../../lib/utils'

export function NumberTicker({ value, direction = 'up', delay = 0, className, decimalPlaces = 0 }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '0px' })
  const [current, setCurrent] = useState(direction === 'down' ? value : 0)

  useEffect(() => {
    if (!isInView) return
    const timer = setTimeout(() => {
      const start = direction === 'down' ? value : 0
      const end = direction === 'down' ? 0 : value
      const duration = 2000
      const startTime = Date.now()
      const tick = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 4)
        setCurrent(Math.round((start + (end - start) * eased) * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces))
        if (progress < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, delay * 1000)
    return () => clearTimeout(timer)
  }, [isInView, value, direction, delay, decimalPlaces])

  return (
    <span ref={ref} className={cn('inline-block tabular-nums tracking-tighter', className)}>
      {current.toFixed(decimalPlaces)}
    </span>
  )
}
