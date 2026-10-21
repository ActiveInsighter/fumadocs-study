"use client"

import { useId } from "react"
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

import { createFormatter } from "../core/format"
import { cloneRows, cssKey, hasPlottableValues, seriesFill } from "../core/series"
import type { ChartSeries } from "../core/types"
import { ChartFigure } from "../primitives/chart-figure"
import { useChartMotion } from "../primitives/chart-motion"
import { ChartTooltipPanel, tooltipMotionProps } from "../primitives/chart-tooltip"
import { useChartSeries, type ChartSeriesModel } from "../primitives/use-chart-series"
import type { LineCurve } from "./line-chart"
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

export type StudyAreaChartProps = CartesianChartProps & {
  series: readonly ChartSeries[]
  stacked?: boolean
  /** Stack to 100 % to compare composition instead of totals. */
  percent?: boolean
  curve?: LineCurve
}

export function StudyAreaChart(props: StudyAreaChartProps) {
  const { data, series: input, xKey, xLabel, format, yFormat, locale, showLegend } = props
  const model = useChartSeries(input, "square")
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
      <AreaPlot {...props} formatters={formatters} model={model} />
    </ChartFigure>
  )
}

function AreaPlot({
  data,
  xKey,
  xLabel,
  yLabel,
  yDomain,
  height = 320,
  stacked = false,
  percent = false,
  curve = "monotone",
  referenceLines,
  locale,
  model,
  formatters,
}: StudyAreaChartProps & { model: ChartSeriesModel; formatters: ReturnType<typeof valueFormatters> }) {
  const { shouldAnimate } = useChartMotion()
  const gradientPrefix = useId().replace(/:/g, "")
  const isStacked = stacked || percent
  const percentTick = createFormatter({ preset: "ratio", digits: 0 }, locale)

  return (
    <ChartContainer className={cn(chartStyles.chartBox, isStacked && chartStyles.stackedArea)} config={model.config} style={{ height }}>
      <AreaChart
        accessibilityLayer
        data={cloneRows(data)}
        margin={{ top: 12, right: 16, bottom: xLabel ? 24 : 4, left: yLabel ? 12 : 0 }}
        stackOffset={percent ? "expand" : undefined}
      >
        <defs>
          {model.series.map((item) => (
            <linearGradient id={`${gradientPrefix}-${cssKey(item.key)}`} key={item.key} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={seriesFill(item)} stopOpacity={isStacked ? 0.82 : 0.32} />
              <stop offset="100%" stopColor={seriesFill(item)} stopOpacity={isStacked ? 0.68 : 0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis {...quietAxis} dataKey={xKey} label={axisTitle(xLabel, "insideBottom", -16)} minTickGap={12} />
        <YAxis
          {...valueAxis}
          domain={percent ? [0, 1] : resolveDomain(yDomain)}
          label={axisTitle(yLabel, "insideLeft", 4)}
          tickFormatter={(value: number) => (percent ? percentTick(value) : formatters.tick(value))}
          width="auto"
        />
        {referenceLines?.map((line, index) => (
          <ReferenceLine
            key={index}
            label={line.label ? { value: line.label, position: "insideTopRight" } : undefined}
            {...(line.axis === "x" ? { x: line.value } : { y: Number(line.value) })}
          />
        ))}
        <ChartTooltip
          {...tooltipMotionProps}
          content={<ChartTooltipPanel formatter={formatters.value} showTotal={stacked && !percent} />}
          cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }}
        />
        {model.series.map((item, index) => (
          <Area
            activeDot={{ r: 4.5, strokeWidth: 2 }}
            animationBegin={index * 90}
            animationDuration={900}
            animationEasing="ease-out"
            dataKey={item.key}
            fill={`url(#${gradientPrefix}-${cssKey(item.key)})`}
            hide={model.isHidden(item.key)}
            isAnimationActive={shouldAnimate}
            key={item.key}
            name={item.label}
            stackId={isStacked ? item.stackId ?? "total" : item.stackId}
            stroke={seriesFill(item)}
            strokeDasharray={item.dashed ? "6 4" : undefined}
            strokeWidth={isStacked ? 1.5 : 2}
            type={curve === "step" ? "stepAfter" : curve}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  )
}
