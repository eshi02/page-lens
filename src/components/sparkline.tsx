/**
 * Tiny SVG sparkline. No data dependency on a charting lib — keeps the
 * bundle small and the visual identical across light/dark via currentColor.
 *
 * Values are rendered left → right in the order received.
 */
export function Sparkline({
  values,
  height = 48,
  className,
  ariaLabel,
}: {
  values: number[]
  height?: number
  className?: string
  ariaLabel?: string
}) {
  if (values.length === 0) return null

  const w = 200
  const h = height
  const pad = 4
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 100)
  const span = Math.max(1, max - min)

  const xStep = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0
  const points = values.map((v, i) => {
    const x = pad + i * xStep
    const y = pad + (1 - (v - min) / span) * (h - pad * 2)
    return [x, y] as const
  })

  const path = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ')

  // Closed area path for the gradient fill underneath.
  const lastPoint = points[points.length - 1]
  const firstPoint = points[0]
  if (!lastPoint || !firstPoint) return null
  const areaPath =
    `${path} L ${lastPoint[0].toFixed(1)} ${(h - pad).toFixed(1)} ` +
    `L ${firstPoint[0].toFixed(1)} ${(h - pad).toFixed(1)} Z`

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={`text-primary ${className ?? ''}`}
      role={ariaLabel ? 'img' : 'presentation'}
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#spark-fill)" />
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === points.length - 1 ? 2.5 : 1.5}
          fill="currentColor"
        />
      ))}
    </svg>
  )
}
