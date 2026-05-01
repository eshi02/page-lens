'use client'

import { useEffect, useState } from 'react'

/**
 * Counts up from 0 to `value` over `durationMs` using an ease-out curve.
 * Respects prefers-reduced-motion — those users get the final value
 * immediately, no animation.
 */
export function AnimatedScore({
  value,
  durationMs = 900,
  className,
}: {
  value: number
  durationMs?: number
  className?: string
}) {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setShown(value)
      return
    }

    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - (1 - t) ** 3 // easeOutCubic
      setShown(Math.round(value * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, durationMs])

  return <span className={className}>{shown}</span>
}
