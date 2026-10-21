import { cssKey } from "../core/series"
import type { ChartPattern, ResolvedSeries } from "../core/types"

/**
 * Texture fills: the backup identity channel for print, grayscale and colour
 * vision deficiencies. Hatch runs at 45° only, dots on a 6px grid; both are
 * inked with the chart ink so they read on light and dark surfaces.
 */
export function patternId(prefix: string, key: string): string {
  return `${prefix}-pattern-${cssKey(key)}`
}

export function PatternDef({ id, pattern, color }: { id: string; pattern: ChartPattern; color: string }) {
  return (
    <pattern height="6" id={id} patternUnits="userSpaceOnUse" width="6">
      <rect fill={color} height="6" width="6" />
      {pattern === "dots" ? (
        <>
          <circle cx="1.5" cy="1.5" fill="var(--chart-ink)" opacity="0.85" r="0.8" />
          <circle cx="4.5" cy="4.5" fill="var(--chart-ink)" opacity="0.85" r="0.8" />
        </>
      ) : (
        <path d="M-1 1 l2 -2 M0 6 l6 -6 M5 7 l2 -2" stroke="var(--chart-ink)" strokeOpacity="0.8" strokeWidth="1" />
      )}
    </pattern>
  )
}

export function SeriesPatternDefs({ prefix, series }: { prefix: string; series: readonly ResolvedSeries[] }) {
  const patterned = series.filter((item) => item.pattern)
  if (patterned.length === 0) return null
  return (
    <defs>
      {patterned.map((item) => (
        <PatternDef color={item.color} id={patternId(prefix, item.key)} key={item.key} pattern={item.pattern!} />
      ))}
    </defs>
  )
}

/** Fill for a series mark: its texture when it has one, else its colour var. */
export function markFill(prefix: string, item: ResolvedSeries, colorVar: string): string {
  return item.pattern ? `url(#${patternId(prefix, item.key)})` : colorVar
}
