/*
 * Study chart family.
 *
 *   core/        pure logic: formatting, scales, series, label placement, export
 *   primitives/  figure shell, legend, tooltip, toolbar, data table, states
 *   types/       one component per chart type (the MDX-facing API)
 */

// Chart types (registered globally for MDX in components/mdx.tsx).
export { StudyAreaChart } from "./types/area-chart"
export type { StudyAreaChartProps } from "./types/area-chart"
export { StudyBarChart } from "./types/bar-chart"
export type { StudyBarChartProps } from "./types/bar-chart"
export { StudyChartSwitcher } from "./types/chart-switcher"
export type { StudyChartSwitcherProps } from "./types/chart-switcher"
export { StudyComposedChart } from "./types/composed-chart"
export type { StudyComposedChartProps } from "./types/composed-chart"
export { StudyFunnelChart } from "./types/funnel-chart"
export type { StudyFunnelChartProps } from "./types/funnel-chart"
export { StudyHistogram } from "./types/histogram"
export type { StudyHistogramProps } from "./types/histogram"
export { StudyLineChart } from "./types/line-chart"
export type { StudyLineChartProps } from "./types/line-chart"
export { StudyPieChart } from "./types/pie-chart"
export type { StudyPieChartProps } from "./types/pie-chart"
export { StudyRadarChart } from "./types/radar-chart"
export type { StudyRadarChartProps } from "./types/radar-chart"
export { StudyRadialChart } from "./types/radial-chart"
export type { StudyRadialChartProps } from "./types/radial-chart"
export { StudyScatterChart } from "./types/scatter-chart"
export type { StudyScatterChartProps } from "./types/scatter-chart"
export { StudyTradeoffChart } from "./types/tradeoff-chart"
export type { StudyTradeoffChartProps } from "./types/tradeoff-chart"
export { StudyTreemap } from "./types/treemap-chart"
export type { StudyTreemapProps } from "./types/treemap-chart"

// Building blocks for feature-specific charts.
export { ChartFigure } from "./primitives/chart-figure"
export type { ChartFigureProps } from "./primitives/chart-figure"
export { ChartLegend } from "./primitives/chart-legend"
export type { ChartLegendItem } from "./primitives/chart-legend"
export { ChartTooltipPanel } from "./primitives/chart-tooltip"
export { ChartDataTable } from "./primitives/chart-data-table"
export { useChartSeries } from "./primitives/use-chart-series"
export { StudyChartFrame, useChartMotion } from "./chart-frame"
export { ChartTabs } from "./chart-tabs"
export type { ChartTabsProps, ChartTabsClassNames } from "./chart-tabs"
export type { ChartTab, ChartTabVisibilityOptions } from "./chart-tabs-model"
export {
  getNextVisibleChartTabId,
  getOverflowChartTabIds,
  getVisibleChartTabIds,
} from "./chart-tabs-model"

// Data contracts and pure helpers.
export { buildHistogramBins, buildNiceHistogramBins } from "./study-chart-model"
export type { HistogramBin } from "./study-chart-model"
export { createFormatter } from "./core/format"
export type {
  ChartDatum,
  ChartPattern,
  ChartSeries,
  ChartTheme,
  FormatSpec,
  ValueFormat,
} from "./core/types"
export type { TradeoffPoint, TradeoffSeries } from "./core/tradeoff"

/** @deprecated use ChartDatum */
export type StudyChartDatum = import("./core/types").ChartDatum
/** @deprecated use ChartSeries */
export type StudyChartSeries = import("./core/types").ChartSeries
