"use client"

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartTooltip } from "@/components/ui/chart"

import { cloneRows, hasPlottableValues, seriesFill } from "../core/series"
import { toNumber } from "../core/format"
import type { ChartDatum, ChartSeries } from "../core/types"
import { ChartFigure } from "../primitives/chart-figure"
import { useChartMotion } from "../primitives/chart-motion"
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

export type LineCurve = "linear" | "monotone" | "step" | "stepBefore" | "stepAfter" | "natural"

export type StudyLineChartProps = CartesianChartProps & {
  series: readonly ChartSeries[]
  curve?: LineCurve
  /** Point markers: all points, only the last one, or none. Default: all when ≤ 16 points. */
  dots?: "all" | "end" | "none"
  /** Direct label with the value at the end of each line. */
  endLabels?: boolean
}

const curveType = (curve: LineCurve) => (curve === "step" ? "stepAfter" : curve)

/**
 * End labels only work when the lines separate at the right edge. If any two
 * final values sit within `minGap` of the value range, stacking the labels
 * would detach them from their lines, so the legend carries identity instead.
 */
export function endLabelsFit(rows: readonly ChartDatum[], keys: readonly string[], minGap = 0.09): boolean {
  const last = rows.at(-1)
  if (!last || keys.length === 0) return false
  const values = rows.flatMap((row) => keys.map((key) => toNumber(row[key]))).filter((value): value is number => value !== undefined)
  const ends = keys.map((key) => toNumber(last[key])).filter((value): value is number => value !== undefined).sort((a, b) => a - b)
  const range = Math.max(...values) - Math.min(0, ...values) || 1
  return ends.every((value, index) => index === 0 || (value - ends[index - 1]!) / range >= minGap)
}

export function StudyLineChart(props: StudyLineChartProps) {
  const { data, series: input, xKey, xLabel, format, yFormat, locale, showLegend } = props
  const model = useChartSeries(input, "line")
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
      <LinePlot {...props} formatters={formatters} model={model} />
    </ChartFigure>
  )
}

function LinePlot({
  data,
  xKey,
  xLabel,
  yLabel,
  yDomain,
  height = 320,
  curve = "monotone",
  dots,
  endLabels = false,
  referenceLines,
  model,
  formatters,
}: StudyLineChartProps & { model: ChartSeriesModel; formatters: ReturnType<typeof valueFormatters> }) {
  const { shouldAnimate } = useChartMotion()
  const rows = cloneRows(data)
  const dotMode = dots ?? (rows.length <= 16 ? "all" : "none")
  const showEndLabels = endLabels && endLabelsFit(rows, model.visible.map((item) => item.key))
  const lastIndex = rows.length - 1

  return (
    <ChartContainer className={chartStyles.chartBox} config={model.config} style={{ height }}>
      <LineChart accessibilityLayer data={rows} margin={{ top: 12, right: showEndLabels ? 64 : 16, bottom: xLabel ? 24 : 4, left: yLabel ? 12 : 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis {...quietAxis} dataKey={xKey} label={axisTitle(xLabel, "insideBottom", -16)} minTickGap={12} />
        <YAxis
          {...valueAxis}
          domain={resolveDomain(yDomain)}
          label={axisTitle(yLabel, "insideLeft", 4)}
          tickFormatter={(value: number) => formatters.tick(value)}
          width="auto"
        />
        {referenceLines?.map((line, index) => (
          <ReferenceLine
            ifOverflow="extendDomain"
            key={index}
            label={line.label ? { value: line.label, position: "insideTopLeft" } : undefined}
            {...(line.axis === "x" ? { x: line.value } : { y: Number(line.value) })}
          />
        ))}
        <ChartTooltip
          {...tooltipMotionProps}
          content={<ChartTooltipPanel formatter={formatters.value} />}
          cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }}
        />
        {model.series.map((item, index) => (
          <Line
            activeDot={{ r: 5, strokeWidth: 2 }}
            animationBegin={index * 90}
            animationDuration={900}
            animationEasing="ease-out"
            dataKey={item.key}
            dot={
              dotMode === "all"
                ? { r: 3.5, strokeWidth: 2, fill: seriesFill(item) }
                : dotMode === "end"
                  ? (dotProps: { index?: number; cx?: number; cy?: number }) =>
                      dotProps.index === lastIndex && typeof dotProps.cx === "number" && typeof dotProps.cy === "number" ? (
                        <circle cx={dotProps.cx} cy={dotProps.cy} fill={seriesFill(item)} key={`end-${item.key}`} r={4} stroke="var(--chart-surface)" strokeWidth={2} />
                      ) : (
                        <g key={`dot-${item.key}-${dotProps.index}`} />
                      )
                  : false
            }
            hide={model.isHidden(item.key)}
            isAnimationActive={shouldAnimate}
            key={item.key}
            label={
              showEndLabels
                ? (labelProps: { index?: number; x?: number | string; y?: number | string; value?: unknown }) =>
                    labelProps.index === lastIndex ? (
                      <text className={chartStyles.endLabel} dominantBaseline="middle" key={`label-${item.key}`} x={Number(labelProps.x) + 10} y={Number(labelProps.y)}>
                        {item.label}
                      </text>
                    ) : (
                      <g key={`nolabel-${item.key}-${labelProps.index}`} />
                    )
                : false
            }
            name={item.label}
            stroke={seriesFill(item)}
            strokeDasharray={item.dashed ? "6 4" : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            type={curveType(curve)}
          />
        ))}
      </LineChart>
    </ChartContainer>
  )
}
