import { useState, useEffect } from 'react'

/**
 * Tracks viewport width reactively, updating on resize.
 * Replaces unreliable one-shot `window.innerWidth` checks in render.
 */
export function useViewport(breakpoint = 700) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', onResize, { passive: true })
    onResize()
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return isMobile
}
