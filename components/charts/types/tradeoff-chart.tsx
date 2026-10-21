"use client"

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis, usePlotArea, useXAxisScale, useYAxisScale } from "recharts"

import { ChartContainer } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

import { createFormatter, type Formatter } from "../core/format"
import { estimateTextWidth, placePointLabels, type LabelPoint, type LabelSegment } from "../core/labels"
import { cssKey, seriesFill } from "../core/series"
import { tradeoffAxes, tradeoffSeriesFromRows, type TradeoffAxes, type TradeoffSeries } from "../core/tradeoff"
import type { ChartDatum, ResolvedSeries, ValueFormat } from "../core/types"
import { ChartFigure } from "../primitives/chart-figure"
import { useChartMotion } from "../primitives/chart-motion"
import { markFill, SeriesPatternDefs } from "../primitives/chart-patterns"
import { useChartSeries, type ChartSeriesModel } from "../primitives/use-chart-series"
import { axisTitle, chartStyles, figureProps, type BaseChartProps } from "./shared"

import styles from "./tradeoff-chart.module.css"

export type StudyTradeoffChartProps = BaseChartProps & {
  /** Series form: each series lists its operating points in order. */
  series?: readonly TradeoffSeries[]
  /** Row form: one row per point, grouped by `seriesKey`. */
  data?: readonly ChartDatum[]
  seriesKey?: string
  xKey?: string
  yKey?: string
  labelKey?: string
  xLabel?: string
  yLabel?: string
  /** Cost axis format. Default "usd". */
  xFormat?: ValueFormat
  /** Score axis format. Default "percent". */
  yFormat?: ValueFormat
  xScale?: "log" | "linear"
  xDomain?: readonly [number, number]
  yDomain?: readonly [number, number]
  /** Break the value axis between zero and the data. Default "auto". */
  yBreak?: boolean | "auto"
  /** Which points get a direct label. Default "all". */
  pointLabels?: "all" | "ends" | "none"
}

type PlotPoint = {
  id: string
  seriesKey: string
  seriesIndex: number
  pointIndex: number
  x: number
  y: number
  dataX: number
  dataY: number
  label?: string
  labelSide?: "above" | "below" | "hide"
}

/**
 * Performance vs cost: connected operating points on a log cost axis, each
 * point labelled with its effort level. Recharts owns the scales, axes, grid
 * and responsive sizing; the marks, direct labels (with collision-aware
 * placement), keyboard navigation and the ink tooltip are drawn by a custom
 * layer that reads the chart's pixel scales.
 */
export function StudyTradeoffChart(props: StudyTradeoffChartProps) {
  const { series: seriesProp, data, seriesKey = "series", xKey = "x", yKey = "y", labelKey = "label", locale, showLegend } = props
  const tradeoffSeries = useMemo<TradeoffSeries[]>(
    () => (seriesProp ? [...seriesProp] : data ? tradeoffSeriesFromRows({ data, seriesKey, xKey, yKey, labelKey }) : []),
    [seriesProp, data, seriesKey, xKey, yKey, labelKey],
  )
  const model = useChartSeries(tradeoffSeries, "dot")
  const formats = {
    x: createFormatter(props.xFormat ?? "usd", locale),
    y: createFormatter(props.yFormat ?? "percent", locale),
    xTick: createFormatter(tickSpec(props.xFormat ?? "usd"), locale),
    yTick: createFormatter(tickSpec(props.yFormat ?? "percent", 0), locale),
  }
  const rows: ChartDatum[] = tradeoffSeries.flatMap((item) =>
    item.points.map((point) => ({ series: item.label ?? item.key, level: point.label ?? "", x: point.x, y: point.y })),
  )

  return (
    <ChartFigure
      {...figureProps(props, {
        empty: rows.length === 0,
        legend: showLegend === false ? undefined : model.legend,
        onLegendToggle: props.toggleable === false ? undefined : model.toggle,
        table: {
          columns: [
            { key: "series", label: "系列" },
            { key: "level", label: "档位" },
            { key: "x", label: props.xLabel ?? "x", numeric: true, formatter: formats.x },
            { key: "y", label: props.yLabel ?? "y", numeric: true, formatter: formats.y },
          ],
          rows,
        },
      })}
    >
      <TradeoffPlot {...props} formats={formats} model={model} tradeoffSeries={tradeoffSeries} />
    </ChartFigure>
  )
}

function tickSpec(format: ValueFormat, digits = 2): ValueFormat {
  return typeof format === "string" ? { preset: format, digits } : { ...format, digits: Math.min(format.digits ?? digits, digits) }
}

type Formats = { x: Formatter; y: Formatter; xTick: Formatter; yTick: Formatter }

function TradeoffPlot({
  tradeoffSeries,
  model,
  formats,
  xLabel,
  yLabel,
  xScale = "log",
  xDomain,
  yDomain,
  yBreak,
  pointLabels = "all",
  height = 400,
  theme = "study",
}: StudyTradeoffChartProps & { tradeoffSeries: TradeoffSeries[]; model: ChartSeriesModel; formats: Formats }) {
  const axes = useMemo(
    () => tradeoffAxes(tradeoffSeries.filter((item) => !model.isHidden(item.key)), { xScale, xDomain, yDomain, yBreak }),
    [tradeoffSeries, model, xScale, xDomain, yDomain, yBreak],
  )
  const prefix = useId().replace(/:/g, "")
  const domainAnchors = [
    { x: axes.xDomain[0], y: axes.yPlotTicks[0]?.plot ?? 0 },
    { x: axes.xDomain[1], y: axes.yPlotTicks.at(-1)?.plot ?? 1 },
  ]
  const tickLabel = new Map(axes.yPlotTicks.map((tick) => [tick.plot, tick.value]))

  return (
    <ChartContainer className={cn(chartStyles.chartBox, styles.box)} config={model.config} style={{ height }}>
      <ScatterChart accessibilityLayer={false} margin={{ top: 18, right: 20, bottom: xLabel ? 34 : 10, left: yLabel ? 18 : 4 }}>
        <SeriesPatternDefs prefix={prefix} series={model.series} />
        <CartesianGrid vertical={false} />
        <XAxis
          allowDataOverflow
          axisLine={{ stroke: "var(--chart-axis)" }}
          dataKey="x"
          domain={[axes.xDomain[0], axes.xDomain[1]]}
          label={axisTitle(xLabel, "insideBottom", -24)}
          scale={xScale === "log" ? "log" : "linear"}
          tickFormatter={(value: number) => formats.xTick(value)}
          tickLine={false}
          tickMargin={10}
          ticks={axes.xTicks}
          type="number"
        />
        <YAxis
          allowDataOverflow
          axisLine={{ stroke: "var(--chart-axis)" }}
          dataKey="y"
          domain={axes.yBreak ? [0, 1] : [axes.yDomain[0], axes.yDomain[1]]}
          interval={0}
          label={axisTitle(yLabel, "insideLeft", 6)}
          tickFormatter={(value: number) => formats.yTick(tickLabel.get(value) ?? value)}
          tickLine={false}
          tickMargin={8}
          ticks={axes.yPlotTicks.map((tick) => tick.plot)}
          type="number"
          width="auto"
        />
        {/* Invisible anchor points: they give Recharts the axis extents. */}
        <Scatter data={domainAnchors} fill="none" isAnimationActive={false} legendType="none" shape={() => <g />} />
        <TradeoffMarks axes={axes} formats={formats} model={model} pointLabels={pointLabels} prefix={prefix} theme={theme} tradeoffSeries={tradeoffSeries} />
      </ScatterChart>
    </ChartContainer>
  )
}

function TradeoffMarks({
  tradeoffSeries,
  model,
  axes,
  formats,
  pointLabels,
  prefix,
  theme,
}: {
  tradeoffSeries: TradeoffSeries[]
  model: ChartSeriesModel
  axes: TradeoffAxes
  formats: Formats
  pointLabels: "all" | "ends" | "none"
  prefix: string
  theme: string
}) {
  const xScale = useXAxisScale()
  const yScale = useYAxisScale()
  const plot = usePlotArea()
  const { shouldAnimate } = useChartMotion()
  const [armed, setArmed] = useState(shouldAnimate)
  const [active, setActive] = useState<string | null>(null)
  const pointRefs = useRef(new Map<string, SVGGElement>())

  useEffect(() => {
    if (!armed) return
    // Two frames: let the armed (undrawn) state paint before transitioning.
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setArmed(false))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [armed])

  const editorial = theme === "editorial"
  const radius = editorial ? 7 : 5.5
  const fontSize = plot && plot.width < 420 ? 10.5 : 12

  const layout = useMemo(() => {
    if (!xScale || !yScale) return undefined
    const series = model.series
      .map((item, seriesIndex) => {
        const source = tradeoffSeries.find((candidate) => candidate.key === item.key)
        if (!source || model.isHidden(item.key)) return undefined
        const points: PlotPoint[] = source.points.flatMap((point, pointIndex) => {
          const x = xScale(point.x)
          const y = yScale(axes.toPlotY(point.y))
          if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return []
          const showLabel =
            pointLabels === "all" || (pointLabels === "ends" && (pointIndex === 0 || pointIndex === source.points.length - 1))
          return [
            {
              id: `${item.key}-${pointIndex}`,
              seriesKey: item.key,
              seriesIndex,
              pointIndex,
              x,
              y,
              dataX: point.x,
              dataY: point.y,
              label: showLabel ? point.label : undefined,
              labelSide: point.labelSide,
            },
          ]
        })
        return { item, points }
      })
      .filter((entry): entry is { item: ResolvedSeries; points: PlotPoint[] } => Boolean(entry))

    const segments: LabelSegment[] = series.flatMap(({ points }) =>
      points.slice(1).map((point, index) => ({ x1: points[index]!.x, y1: points[index]!.y, x2: point.x, y2: point.y })),
    )
    const labelPoints: LabelPoint[] = series.flatMap(({ points }) =>
      points.map((point) => ({
        id: point.id,
        x: point.x,
        y: point.y,
        text: point.label ?? "",
        group: point.seriesKey,
        side: point.label ? point.labelSide : "hide",
      })),
    )
    const labels = placePointLabels(labelPoints, { segments, bounds: plot, radius, fontSize })
    return { series, labels, flat: series.flatMap((entry) => entry.points) }
  }, [xScale, yScale, model, tradeoffSeries, axes, pointLabels, plot, radius, fontSize])

  if (!layout || !plot) return null

  const activePoint = layout.flat.find((point) => point.id === active)
  const activeSeries = activePoint ? model.series.find((item) => item.key === activePoint.seriesKey) : undefined

  const focusPoint = (id: string | undefined) => {
    if (!id) return
    setActive(id)
    pointRefs.current.get(id)?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<SVGGElement>, point: PlotPoint) => {
    const seriesPoints = layout.series.find((entry) => entry.item.key === point.seriesKey)?.points ?? []
    const seriesOrder = layout.series.map((entry) => entry.item.key)
    const currentSeries = seriesOrder.indexOf(point.seriesKey)
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault()
      const next = seriesPoints[point.pointIndex + (event.key === "ArrowRight" ? 1 : -1)]
      focusPoint(next?.id)
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const targetKey = seriesOrder[(currentSeries + (event.key === "ArrowDown" ? 1 : -1) + seriesOrder.length) % seriesOrder.length]
      const target = layout.series.find((entry) => entry.item.key === targetKey)?.points
      focusPoint(target?.[Math.min(point.pointIndex, (target?.length ?? 1) - 1)]?.id)
    } else if (event.key === "Escape") {
      setActive(null)
      ;(event.currentTarget as SVGGElement).blur()
    }
  }

  const describe = (point: PlotPoint, item: ResolvedSeries) =>
    `${item.label}${point.label ? ` · ${point.label}` : ""}：${formats.y(point.dataY)}，${formats.x(point.dataX)}`

  return (
    <g className={styles.layer} data-armed={armed ? "" : undefined} data-theme={theme}>
      {axes.yBreak ? <AxisBreak plotX={plot.x} y={yScale ? (yScale(axes.yBreak.breakPosition / 2) ?? 0) : 0} /> : null}

      {layout.series.map(({ item, points }, seriesIndex) => {
        const dimmed = activeSeries && activeSeries.key !== item.key
        const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join("")
        return (
          <g className={cn(styles.series, dimmed && styles.dimmed)} key={item.key} style={{ ["--delay" as string]: `${seriesIndex * 120}ms` }}>
            <path
              className={cn(styles.line, item.dashed && styles.lineDashed)}
              d={path}
              pathLength={1}
              style={{ stroke: lineStroke(item, editorial), ...(item.dashed ? { strokeDasharray: "0.012 0.01" } : null) }}
            />
          </g>
        )
      })}

      {layout.series.map(({ item, points }, seriesIndex) => (
        <g className={cn(styles.marks, activeSeries && activeSeries.key !== item.key && styles.dimmed)} key={`marks-${item.key}`} style={{ ["--delay" as string]: `${seriesIndex * 120}ms` }}>
          {points.map((point) => {
            const placed = layout.labels.get(point.id)
            const isActive = point.id === active
            return (
              <g
                aria-label={describe(point, item)}
                className={styles.point}
                data-active={isActive ? "" : undefined}
                key={point.id}
                onBlur={() => setActive((current) => (current === point.id ? null : current))}
                onClick={() => setActive(point.id)}
                onFocus={() => setActive(point.id)}
                onKeyDown={(event) => onKeyDown(event, point)}
                onPointerEnter={() => setActive(point.id)}
                onPointerLeave={(event) => {
                  if (event.pointerType === "mouse") setActive((current) => (current === point.id ? null : current))
                }}
                ref={(node) => {
                  if (node) pointRefs.current.set(point.id, node)
                  else pointRefs.current.delete(point.id)
                }}
                role="img"
                tabIndex={0}
              >
                <circle className={styles.hit} cx={point.x} cy={point.y} r={Math.max(14, radius + 8)} />
                {isActive ? <circle className={styles.focusRing} cx={point.x} cy={point.y} r={radius + 4} /> : null}
                <circle className={styles.mark} cx={point.x} cy={point.y} fill={markFill(prefix, item, `var(--color-${cssKey(item.key)})`)} r={radius} />
                {placed && point.label ? (
                  <text className={styles.label} style={{ fontSize }} textAnchor="middle" x={placed.x} y={placed.y}>
                    {point.label}
                  </text>
                ) : null}
              </g>
            )
          })}
        </g>
      ))}

      {activePoint && activeSeries ? (
        <TooltipMark
          bounds={plot}
          label={`${activeSeries.label}${activePoint.label ? ` · ${activePoint.label}` : ""}`}
          point={activePoint}
          radius={radius}
          value={`${formats.y(activePoint.dataY)} · ${formats.x(activePoint.dataX)}`}
        />
      ) : null}
    </g>
  )
}

/**
 * Study theme draws lines in the series colour. The editorial theme uses
 * paper-soft fills for the marks, so its lines are a darker mix toward ink;
 * textured series (e.g. "with tools") get a near-ink line to stay distinct.
 */
function lineStroke(item: ResolvedSeries, editorial: boolean): string {
  const color = seriesFill(item)
  if (!editorial) return color
  return item.pattern
    ? `color-mix(in oklch, ${color} 28%, var(--chart-ink))`
    : `color-mix(in oklch, ${color} 80%, var(--chart-ink))`
}

function TooltipMark({
  point,
  label,
  value,
  bounds,
  radius,
}: {
  point: PlotPoint
  label: string
  value: string
  bounds: { x: number; y: number; width: number; height: number }
  radius: number
}) {
  const width = Math.max(estimateTextWidth(label, 12.5), estimateTextWidth(value, 12.5)) + 24
  const height = 50
  let x = point.x - width / 2
  let y = point.y - radius - 12 - height
  if (y < bounds.y - 10) y = point.y + radius + 12
  x = Math.max(bounds.x - 8, Math.min(x, bounds.x + bounds.width - width + 8))

  return (
    <g aria-hidden="true" className={styles.tooltip} data-chart-export="ignore" pointerEvents="none" transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`}>
      <rect className={styles.tooltipBox} height={height} rx={6} width={width} />
      <text className={styles.tooltipLabel} x={12} y={20}>
        {label}
      </text>
      <text className={styles.tooltipValue} x={12} y={38}>
        {value}
      </text>
    </g>
  )
}

function AxisBreak({ plotX, y }: { plotX: number; y: number }) {
  return (
    <g aria-hidden="true" className={styles.axisBreak}>
      <line x1={plotX} x2={plotX} y1={y - 5} y2={y + 5} />
      <polyline points={`${plotX - 6},${y - 4} ${plotX + 6},${y - 2} ${plotX - 6},${y + 2} ${plotX + 6},${y + 4}`} />
    </g>
  )
}
