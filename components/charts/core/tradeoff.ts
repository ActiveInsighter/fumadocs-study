/**
 * Data model for performance-vs-cost ("tradeoff") curves: each series is an
 * ordered list of operating points (effort levels, model sizes, budgets…)
 * plotted on a usually-logarithmic cost axis.
 */

import { toNumber } from "./format"
import {
  createBrokenScale,
  linearTicks,
  logTicks,
  niceLinearDomain,
  paddedLogDomain,
  snapLogDomain,
  shouldBreakAxis,
  type BrokenScale,
  type Domain,
} from "./scales"
import type { ChartDatum, ChartSeries } from "./types"

export type TradeoffPoint = {
  x: number
  y: number
  /** Direct label, e.g. "low" / "high" / "max". */
  label?: string
  labelSide?: "above" | "below" | "hide"
}

export type TradeoffSeries = ChartSeries & {
  points: readonly TradeoffPoint[]
}

export type TradeoffRowsInput = {
  data: readonly ChartDatum[]
  seriesKey: string
  xKey: string
  yKey: string
  labelKey?: string
  /** Optional display metadata per series value. */
  series?: readonly (Omit<ChartSeries, "key"> & { key: string })[]
}

/** Row form → series form. Series keep first-seen order unless metadata orders them. */
export function tradeoffSeriesFromRows({ data, seriesKey, xKey, yKey, labelKey, series }: TradeoffRowsInput): TradeoffSeries[] {
  const groups = new Map<string, TradeoffPoint[]>()
  for (const meta of series ?? []) groups.set(meta.key, [])
  for (const row of data) {
    const key = String(row[seriesKey] ?? "")
    const x = toNumber(row[xKey])
    const y = toNumber(row[yKey])
    if (!key || x === undefined || y === undefined) continue
    const points = groups.get(key) ?? []
    points.push({ x, y, label: labelKey && row[labelKey] !== undefined ? String(row[labelKey]) : undefined })
    groups.set(key, points)
  }
  return [...groups.entries()].map(([key, points]) => {
    const meta = series?.find((item) => item.key === key)
    return { ...meta, key, label: meta?.label ?? key, points }
  })
}

export type TradeoffAxes = {
  xDomain: Domain
  xTicks: number[]
  yDomain: Domain
  yTicks: number[]
  /** Present when the value axis is broken between zero and the data. */
  yBreak?: BrokenScale
  /** Plot-space y (after the break transform) for a data value. */
  toPlotY: (value: number) => number
  /** Plot-space ticks with the data value they represent. */
  yPlotTicks: { plot: number; value: number }[]
}

export type TradeoffAxesOptions = {
  xScale?: "log" | "linear"
  xDomain?: readonly [number, number]
  yDomain?: readonly [number, number]
  /** "auto" breaks when the data sits far from zero. */
  yBreak?: boolean | "auto"
}

export function tradeoffAxes(series: readonly TradeoffSeries[], options: TradeoffAxesOptions = {}): TradeoffAxes {
  const xs = series.flatMap((item) => item.points.map((point) => point.x))
  const ys = series.flatMap((item) => item.points.map((point) => point.y))
  const isLog = (options.xScale ?? "log") === "log"

  const xDomain: Domain = options.xDomain
    ? [options.xDomain[0], options.xDomain[1]]
    : isLog
      ? snapLogDomain(paddedLogDomain(xs, 0.05))
      : niceLinearDomain(xs, { includeZero: false })
  const xTicks = isLog ? logTicks(xDomain) : linearTicks(xDomain)

  const fitted = options.yDomain ? ([options.yDomain[0], options.yDomain[1]] as Domain) : niceLinearDomain(ys, { includeZero: false, tickCount: 6 })
  const breakMode = options.yBreak ?? "auto"
  const wantsBreak = fitted[0] > 0 && (breakMode === true || (breakMode === "auto" && shouldBreakAxis(fitted)))
  const yDomain: Domain =
    wantsBreak || breakMode === false || fitted[0] <= 0 || options.yDomain ? fitted : niceLinearDomain(ys, { includeZero: true, tickCount: 6 })
  const yTicks = linearTicks(yDomain, 6)

  if (!wantsBreak) {
    return {
      xDomain,
      xTicks,
      yDomain,
      yTicks,
      toPlotY: (value) => value,
      yPlotTicks: yTicks.map((value) => ({ plot: value, value })),
    }
  }

  const yBreak = createBrokenScale(yDomain[0], yDomain[1])
  return {
    xDomain,
    xTicks,
    yDomain,
    yTicks,
    yBreak,
    toPlotY: yBreak.toPlot,
    yPlotTicks: [{ plot: 0, value: 0 }, ...yTicks.map((value) => ({ plot: yBreak.toPlot(value), value }))],
  }
}

/** Operating points no other point beats on both axes (lower x, higher y). */
export function paretoFrontier(points: readonly TradeoffPoint[]): TradeoffPoint[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || b.y - a.y)
  const frontier: TradeoffPoint[] = []
  let best = Number.NEGATIVE_INFINITY
  for (const point of sorted) {
    if (point.y > best) {
      frontier.push(point)
      best = point.y
    }
  }
  return frontier
}
