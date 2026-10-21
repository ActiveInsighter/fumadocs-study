"use client"

import { useId } from "react"
import { Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartTooltip } from "@/components/ui/chart"

import { cloneRows, cssKey, hasPlottableValues, seriesFill } from "../core/series"
import type { ChartSeries } from "../core/types"
import { ChartFigure } from "../primitives/chart-figure"
import { useChartMotion } from "../primitives/chart-motion"
import { markFill, SeriesPatternDefs } from "../primitives/chart-patterns"
import { ChartTooltipPanel, tooltipMotionProps } from "../primitives/chart-tooltip"
import { useChartSeries, type ChartSeriesModel } from "../primitives/use-chart-series"
import {
  axisTitle,
  chartStyles,
  figureProps,
  quietAxis,
  valueAxis,
  resolveDomain,
  seriesTable,
  valueFormatters,
  type CartesianChartProps,
} from "./shared"

export type StudyComposedChartProps = CartesianChartProps & {
  /** Each series picks `type: "bar" | "line" | "area"` (default "bar"). */
  series: readonly ChartSeries[]
}

/**
 * Bars, lines and areas on one shared value axis. Deliberately no second
 * y-axis: two measures of different scale belong in two charts or an
 * indexed series, never in a dual-axis plot.
 */
export function StudyComposedChart(props: StudyComposedChartProps) {
  const { data, series: input, xKey, xLabel, format, yFormat, locale, showLegend } = props
  const model = useChartSeries(input, (item) => (item.type === "line" ? "line" : "square"))
  const formatters = valueFormatters(format ?? yFormat, locale)
  const empty = !hasPlottableValues(data, model.series.map((item) => item.key))

  return (
    <ChartFigure
      {...figureProps(props, {
        empty,
        legend: showLegend === false ? undefined : model.legend,
        onLegendToggle: props.toggleable === false ? undefined : model.toggle,
        table: seriesTable(data, xKey, xLabel, model.series, formatters.value),
      })}
    >
      <ComposedPlot {...props} formatters={formatters} model={model} />
    </ChartFigure>
  )
}

function ComposedPlot({
  data,
  xKey,
  xLabel,
  yLabel,
  yDomain,
  height = 320,
  referenceLines,
  model,
  formatters,
}: StudyComposedChartProps & { model: ChartSeriesModel; formatters: ReturnType<typeof valueFormatters> }) {
  const { shouldAnimate } = useChartMotion()
  const prefix = useId().replace(/:/g, "")

  return (
    <ChartContainer className={chartStyles.chartBox} config={model.config} style={{ height }}>
      <ComposedChart accessibilityLayer barGap={2} data={cloneRows(data)} margin={{ top: 12, right: 16, bottom: xLabel ? 24 : 4, left: yLabel ? 12 : 0 }}>
        <SeriesPatternDefs prefix={prefix} series={model.series} />
        <defs>
          {model.series
            .filter((item) => item.type === "area")
            .map((item) => (
              <linearGradient id={`${prefix}-area-${cssKey(item.key)}`} key={item.key} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={seriesFill(item)} stopOpacity={0.3} />
                <stop offset="100%" stopColor={seriesFill(item)} stopOpacity={0.02} />
              </linearGradient>
            ))}
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis {...quietAxis} dataKey={xKey} label={axisTitle(xLabel, "insideBottom", -16)} />
        <YAxis
          {...valueAxis}
          domain={resolveDomain(yDomain)}
          label={axisTitle(yLabel, "insideLeft", 4)}
          tickFormatter={(value: number) => formatters.tick(value)}
          width="auto"
        />
        {referenceLines?.map((line, index) => (
          <ReferenceLine
            key={index}
            label={line.label ? { value: line.label, position: "insideTopRight" } : undefined}
            {...(line.axis === "x" ? { x: line.value } : { y: Number(line.value) })}
          />
        ))}
        <ChartTooltip {...tooltipMotionProps} content={<ChartTooltipPanel formatter={formatters.value} />} cursor={{ fill: "var(--chart-cursor)" }} />
        {model.series.map((item, index) => {
          const common = {
            animationBegin: index * 80,
            animationDuration: 800,
            animationEasing: "ease-out" as const,
            dataKey: item.key,
            hide: model.isHidden(item.key),
            isAnimationActive: shouldAnimate,
            name: item.label,
          }
          if (item.type === "line") {
            return (
              <Line
                {...common}
                activeDot={{ r: 5, strokeWidth: 2 }}
                dot={{ r: 3.5, strokeWidth: 2, fill: seriesFill(item) }}
                key={item.key}
                stroke={seriesFill(item)}
                strokeDasharray={item.dashed ? "6 4" : undefined}
                strokeWidth={2}
                type="monotone"
              />
            )
          }
          if (item.type === "area") {
            return (
              <Area
                {...common}
                fill={`url(#${prefix}-area-${cssKey(item.key)})`}
                key={item.key}
                stroke={seriesFill(item)}
                strokeWidth={2}
                type="monotone"
              />
            )
          }
          return (
            <Bar
              {...common}
              fill={markFill(prefix, item, seriesFill(item))}
              key={item.key}
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
              stackId={item.stackId}
            />
          )
        })}
      </ComposedChart>
    </ChartContainer>
  )
}
