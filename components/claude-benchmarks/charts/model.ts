import type {
  BenchmarkPoint,
  ScatterSeries,
  ScatterTick,
  ScatterView,
  BenchmarkChartConfig,
  BenchmarkTab,
} from "./types"

export type RechartsSeries = {
  id: string
  label: string
  color: ScatterSeries["color"]
  pattern?: ScatterSeries["pattern"]
  labelEfforts?: ScatterSeries["labelEfforts"]
  data: readonly RechartsPoint[]
}

export type RechartsPoint = BenchmarkPoint & {
  plotScore: number
  seriesLabel: string
  showLabel: boolean
}

/**
 * Tooltip content follows the pointer, so a position tween makes fast hover
 * changes feel delayed. Keep the data transition animated, but make tooltip
 * repositioning immediate.
 */
export const benchmarkTooltipMotionProps = {
  animationDuration: 0,
  isAnimationActive: false,
} as const

export function formatChartValue(value: number, suffix: string): string {
  const compact = Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")

  return suffix === "$" ? `$${compact}` : `${compact}${suffix}`
}

export function formatScatterTooltipValue(point: Pick<BenchmarkPoint, "costLabel" | "score" | "scoreLabel">): string {
  return `${point.scoreLabel ?? `${point.score.toFixed(1)}%`} · ${point.costLabel}`
}

export function toRechartsSeries(view: ScatterView): readonly RechartsSeries[] {
  return view.series.map((series) => ({
    id: series.id,
    label: series.label,
    color: series.color,
    pattern: series.pattern,
    labelEfforts: series.labelEfforts,
    data: series.points.map((point) => ({
      ...point,
      plotScore: getScatterPlotValue(point.score, view),
      seriesLabel: series.label,
      showLabel: !series.labelEfforts || series.labelEfforts.includes(point.effort),
    })),
  }))
}

export function createChartConfig(series: readonly ScatterSeries[]): BenchmarkChartConfig {
  return Object.fromEntries(
    series.map((item) => [
      item.id,
      {
        label: item.label,
        color: getChartColorToken(item.color),
      },
    ]),
  )
}

export function getChartColorToken(color: ScatterSeries["color"]): string {
  return `var(--claude-chart-${color.replace("Hatch", "")})`
}

export function getScatterPlotValue(value: number, view: ScatterView): number {
  const axisBreak = view.yAxisBreak

  if (!axisBreak) {
    return normalize(value, view.yDomain)
  }

  if (value <= axisBreak.lower) {
    return value <= 0 ? 0 : axisBreak.lowerPlotPosition
  }

  const upperPosition = normalize(value, [axisBreak.lower, axisBreak.upper])
  return axisBreak.lowerPlotPosition + upperPosition * (1 - axisBreak.lowerPlotPosition)
}

export function getScatterYAxisTicks(view: ScatterView): readonly ScatterTick[] {
  const ticks = view.series.length > 0 && view.yAxisBreak
    ? [{ label: "0", value: 0 }, ...view.yTicks]
    : view.yTicks

  return ticks.map((tick) => ({
    label: tick.label,
    value: getScatterPlotValue(tick.value, view),
  }))
}

export function getLogPosition(value: number, domain: readonly [number, number]): number {
  const [minimum, maximum] = domain

  if (minimum <= 0 || maximum <= minimum || value <= 0) {
    return 0
  }

  const position = (Math.log(value) - Math.log(minimum)) / (Math.log(maximum) - Math.log(minimum))
  return Math.min(1, Math.max(0, position))
}

export function isHatchedColor(color: ScatterSeries["color"]): boolean {
  return color.endsWith("Hatch")
}

function normalize(value: number, domain: readonly [number, number]): number {
  const [minimum, maximum] = domain

  if (maximum <= minimum) {
    return 0
  }

  return Math.min(1, Math.max(0, (value - minimum) / (maximum - minimum)))
}

export function getVisibleTabIds(tabs: readonly BenchmarkTab[], viewportWidth: number): string[] {
  const visibleCount = getVisibleTabCount(tabs.length, viewportWidth)
  return tabs.slice(0, visibleCount).map((tab) => tab.id)
}

export function getOverflowTabIds(tabs: readonly BenchmarkTab[], viewportWidth: number): string[] {
  const visibleCount = getVisibleTabCount(tabs.length, viewportWidth)
  return tabs.slice(visibleCount).map((tab) => tab.id)
}

export function getNextTabId(
  tabs: readonly BenchmarkTab[],
  currentId: string,
  direction: 1 | -1,
  viewportWidth: number,
): string {
  const visibleIds = getVisibleTabIds(tabs, viewportWidth)
  const visibleTabs = tabs.filter((tab) => visibleIds.includes(tab.id))

  if (visibleTabs.length === 0) {
    return currentId
  }

  const currentIndex = Math.max(
    0,
    visibleTabs.findIndex((tab) => tab.id === currentId),
  )
  const nextIndex = (currentIndex + direction + visibleTabs.length) % visibleTabs.length
  return visibleTabs[nextIndex]?.id ?? currentId
}

function getVisibleTabCount(tabCount: number, viewportWidth: number): number {
  if (viewportWidth <= 567) {
    return Math.min(tabCount, 1)
  }

  if (viewportWidth <= 991 && tabCount > 3) {
    return 3
  }

  return tabCount
}
