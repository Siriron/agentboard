import { useState, useEffect } from 'react'

/**
 * Tracks the user's OS-level "reduce motion" preference reactively.
 * CSS keyframe/transition animations are already frozen globally via the
 * prefers-reduced-motion media query in index.css — this hook is for
 * JS-driven motion that a media query can't reach directly: GSAP
 * ScrollTrigger reveals, requestAnimationFrame loops, and timed
 * auto-advance intervals (like the landing page carousel).
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}
