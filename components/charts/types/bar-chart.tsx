"use client"

import { useId } from "react"
import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartTooltip } from "@/components/ui/chart"

import { createFormatter } from "../core/format"
import { cloneRows, hasPlottableValues, seriesFill } from "../core/series"
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

export type StudyBarChartProps = CartesianChartProps & {
  series: readonly ChartSeries[]
  stacked?: boolean
  /** Stack to 100 %. */
  percent?: boolean
  /** Bars grow to the right; categories read top to bottom. */
  horizontal?: boolean
  /** Value label at each bar tip (not for stacked segments). */
  showValues?: boolean
  /** Category axis width for horizontal bars. */
  categoryWidth?: number
  /** Contiguous bins (histograms): bars touch with a 2px surface gap. */
  contiguous?: boolean
}

/** Bars cap at 24px: the band's leftover is air, not a fatter bar. */
const MAX_BAR = 24
const RADIUS = 4

export function StudyBarChart(props: StudyBarChartProps) {
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
      <BarPlot {...props} formatters={formatters} model={model} />
    </ChartFigure>
  )
}

function BarPlot({
  data,
  xKey,
  xLabel,
  yLabel,
  yDomain,
  height = 320,
  stacked = false,
  percent = false,
  horizontal = false,
  showValues = false,
  categoryWidth = 96,
  contiguous = false,
  referenceLines,
  locale,
  model,
  formatters,
}: StudyBarChartProps & { model: ChartSeriesModel; formatters: ReturnType<typeof valueFormatters> }) {
  const { shouldAnimate } = useChartMotion()
  const patternPrefix = useId().replace(/:/g, "")
  const isStacked = stacked || percent
  const visibleKeys = model.visible.map((item) => item.key)
  const outermost = visibleKeys.at(-1)
  const percentTick = createFormatter({ preset: "ratio", digits: 0 }, locale)
  const valueTick = (value: number) => (percent ? percentTick(value) : formatters.tick(value))
  const roundEnd: [number, number, number, number] = horizontal ? [0, RADIUS, RADIUS, 0] : [RADIUS, RADIUS, 0, 0]

  const valueAxisProps = {
    ...valueAxis,
    domain: percent ? ([0, 1] as [number, number]) : resolveDomain(yDomain),
    tickFormatter: valueTick,
    type: "number" as const,
  }
  const categoryAxis = { ...quietAxis, dataKey: xKey, type: "category" as const }

  return (
    <ChartContainer className={chartStyles.chartBox} config={model.config} style={{ height }}>
      <BarChart
        accessibilityLayer
        barCategoryGap={contiguous ? 2 : "24%"}
        barGap={2}
        data={cloneRows(data)}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: showValues ? 20 : 12, right: horizontal && showValues ? 48 : 16, bottom: xLabel ? 24 : 4, left: yLabel ? 12 : 0 }}
        stackOffset={percent ? "expand" : undefined}
      >
        <SeriesPatternDefs prefix={patternPrefix} series={model.series} />
        <CartesianGrid horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis {...valueAxisProps} label={axisTitle(yLabel, "insideBottom", -16)} />
            <YAxis {...categoryAxis} label={axisTitle(xLabel, "insideLeft", 4)} width={categoryWidth} />
          </>
        ) : (
          <>
            <XAxis {...categoryAxis} label={axisTitle(xLabel, "insideBottom", -16)} minTickGap={4} />
            <YAxis {...valueAxisProps} label={axisTitle(yLabel, "insideLeft", 4)} width="auto" />
          </>
        )}
        {referenceLines?.map((line, index) => (
          <ReferenceLine
            key={index}
            label={line.label ? { value: line.label, position: horizontal ? "insideTopRight" : "insideTopLeft" } : undefined}
            {...((line.axis === "x") !== horizontal ? { x: line.value } : { y: line.value })}
          />
        ))}
        <ChartTooltip
          {...tooltipMotionProps}
          content={<ChartTooltipPanel formatter={formatters.value} showTotal={stacked && !percent} />}
          cursor={{ fill: "var(--chart-cursor)" }}
        />
        {model.series.map((item, index) => (
          <Bar
            animationBegin={index * 70}
            animationDuration={700}
            animationEasing="ease-out"
            dataKey={item.key}
            fill={markFill(patternPrefix, item, seriesFill(item))}
            hide={model.isHidden(item.key)}
            isAnimationActive={shouldAnimate}
            key={item.key}
            maxBarSize={contiguous ? undefined : MAX_BAR}
            name={item.label}
            radius={!isStacked || item.key === outermost ? roundEnd : 0}
            stackId={isStacked ? item.stackId ?? "total" : item.stackId}
            // The surface-coloured stroke is the 2px gap between stacked segments.
            stroke={isStacked ? "var(--chart-panel)" : undefined}
            strokeWidth={isStacked ? 1 : 0}
          >
            {showValues && (!isStacked || item.key === outermost) ? (
              <LabelList
                className={chartStyles.valueLabel}
                dataKey={item.key}
                formatter={(value: unknown) => (typeof value === "number" ? (isStacked ? "" : formatters.value(value)) : "")}
                offset={6}
                position={horizontal ? "right" : "top"}
              />
            ) : null}
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  )
}
