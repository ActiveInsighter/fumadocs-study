"use client"

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts"

import { ChartContainer, ChartTooltip } from "@/components/ui/chart"

import { cloneRows, hasPlottableValues, seriesFill } from "../core/series"
import type { ChartDatum, ChartSeries, ValueFormat } from "../core/types"
import { ChartFigure } from "../primitives/chart-figure"
import { useChartMotion } from "../primitives/chart-motion"
import { ChartTooltipPanel, tooltipMotionProps } from "../primitives/chart-tooltip"
import { useChartSeries, type ChartSeriesModel } from "../primitives/use-chart-series"
import { chartStyles, figureProps, seriesTable, valueFormatters, type BaseChartProps } from "./shared"

export type StudyRadarChartProps = BaseChartProps & {
  /** One row per axis (dimension); `angleKey` names it. */
  data: readonly ChartDatum[]
  angleKey: string
  series: readonly ChartSeries[]
  /** Upper bound of the radial scale. Defaults to the data maximum. */
  max?: number
  format?: ValueFormat
  /** Polygon grid (default) or concentric circles. */
  grid?: "polygon" | "circle"
}

/**
 * Profile comparison across a handful of dimensions (≤ 8 axes, ≤ 3 series).
 * Beyond that a grouped bar chart reads better; the table view is always there.
 */
export function StudyRadarChart(props: StudyRadarChartProps) {
  const { data, series: input, angleKey, format, locale, showLegend } = props
  const model = useChartSeries(input, "square")
  const formatters = valueFormatters(format, locale)

  return (
    <ChartFigure
      {...figureProps(props, {
        empty: !hasPlottableValues(data, model.series.map((item) => item.key)),
        legend: showLegend === false ? undefined : model.legend,
        onLegendToggle: props.toggleable === false ? undefined : model.toggle,
        legendAlign: "start",
        table: seriesTable(data, angleKey, angleKey, model.series, formatters.value),
      })}
    >
      <RadarPlot {...props} formatters={formatters} model={model} />
    </ChartFigure>
  )
}

function RadarPlot({
  data,
  angleKey,
  max,
  grid = "polygon",
  height = 340,
  model,
  formatters,
}: StudyRadarChartProps & { model: ChartSeriesModel; formatters: ReturnType<typeof valueFormatters> }) {
  const { shouldAnimate } = useChartMotion()

  return (
    <ChartContainer className={chartStyles.chartBox} config={model.config} style={{ height }}>
      <RadarChart accessibilityLayer data={cloneRows(data)} margin={{ top: 12, right: 28, bottom: 12, left: 28 }} outerRadius="74%">
        <PolarGrid gridType={grid} />
        <PolarAngleAxis dataKey={angleKey} tick={{ fontSize: 12 }} />
        <PolarRadiusAxis angle={90} axisLine={false} domain={[0, max ?? "auto"]} tick={false} tickCount={5} />
        <ChartTooltip {...tooltipMotionProps} content={<ChartTooltipPanel formatter={formatters.value} />} />
        {model.series.map((item, index) => (
          <Radar
            animationBegin={index * 100}
            animationDuration={800}
            dataKey={item.key}
            dot={{ r: 3, fillOpacity: 1 }}
            fill={seriesFill(item)}
            fillOpacity={0.16}
            hide={model.isHidden(item.key)}
            isAnimationActive={shouldAnimate}
            key={item.key}
            name={item.label}
            stroke={seriesFill(item)}
            strokeWidth={2}
          />
        ))}
      </RadarChart>
    </ChartContainer>
  )
}
