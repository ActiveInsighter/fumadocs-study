import type { ChartConfig } from "@/components/ui/chart"

import type { ChartColor, ChartDatum, ChartSeries, ResolvedSeries } from "./types"

export const CATEGORICAL_SLOTS = 8

/**
 * Maps an author-facing colour to a CSS value.
 *
 * Series take categorical slots in fixed order. There is no cycling: a ninth
 * series gets the neutral "other" colour, because a generated hue would be
 * indistinguishable from an existing one.
 */
export function resolveColor(color: ChartColor | undefined, index: number): string {
  if (color) {
    const token = color.trim()
    if (/^\d+$/.test(token)) return `var(--chart-${token})`
    if (token === "other") return "var(--chart-other)"
    if (/^chart-[\w-]+$/.test(token)) return `var(--${token})`
    if (/^(editorial|seq)-\d+$/.test(token)) return `var(--chart-${token})`
    return token
  }
  return index < CATEGORICAL_SLOTS ? `var(--chart-${index + 1})` : "var(--chart-other)"
}

export function resolveSeries(series: readonly ChartSeries[]): ResolvedSeries[] {
  return series.map((item, index) => ({
    key: item.key,
    label: item.label ?? item.key,
    qualifier: item.qualifier,
    color: resolveColor(item.color, index),
    pattern: item.pattern,
    type: item.type,
    dashed: item.dashed,
    hidden: item.hidden ?? false,
    stackId: item.stackId,
    index,
  }))
}

/**
 * shadcn ChartConfig keyed by data key. ChartContainer turns each entry into
 * a `--color-<key>` variable, so marks reference `var(--color-<key>)` and the
 * tooltip finds labels without extra wiring.
 */
export function toChartConfig(series: readonly ResolvedSeries[]): ChartConfig {
  return Object.fromEntries(
    series.map((item) => [cssKey(item.key), { label: item.label, color: item.color }]),
  )
}

/**
 * Data keys may contain characters that are illegal in custom property names
 * (CJK, spaces, dots). Each one is escaped by code point, so distinct keys
 * such as "新模型" and "旧模型" never collapse onto the same variable.
 */
export function cssKey(key: string): string {
  return key.replace(/[^\w-]/gu, (char) => `_${char.codePointAt(0)!.toString(16)}`)
}

export function seriesFill(item: Pick<ResolvedSeries, "key">): string {
  return `var(--color-${cssKey(item.key)})`
}

/** Plain copies so Recharts can annotate rows without mutating MDX props. */
export function cloneRows(data: readonly ChartDatum[]): ChartDatum[] {
  return data.map((row) => ({ ...row }))
}

export function hasPlottableValues(
  data: readonly ChartDatum[],
  keys: readonly string[],
): boolean {
  return data.some((row) =>
    keys.some((key) => {
      const value = row[key]
      return typeof value === "number" ? Number.isFinite(value) : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))
    }),
  )
}

/**
 * Next hidden-set after the reader toggles `key`. The last visible series can
 * not be hidden, so a chart never collapses into an empty plot.
 */
export function toggleHidden(
  hidden: ReadonlySet<string>,
  key: string,
  allKeys: readonly string[],
): Set<string> {
  const next = new Set(hidden)
  if (next.has(key)) {
    next.delete(key)
    return next
  }
  const visibleCount = allKeys.filter((item) => !next.has(item)).length
  if (visibleCount <= 1) return next
  next.add(key)
  return next
}

/** Pie / funnel / treemap rows: colour per category instead of per series. */
export function categoryColors(
  data: readonly ChartDatum[],
  nameKey: string,
  colors?: Record<string, ChartColor>,
): string[] {
  return data.map((row, index) => {
    const name = String(row[nameKey] ?? "")
    return resolveColor(colors?.[name], index)
  })
}
