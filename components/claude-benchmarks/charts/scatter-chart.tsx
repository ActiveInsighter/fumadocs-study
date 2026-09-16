"use client"

import { useId } from "react"
import {
  CartesianGrid,
  Scatter,
  ScatterChart as RechartsScatterChart,
  XAxis,
  YAxis,
  usePlotArea,
} from "recharts"
import type { ScatterShapeProps } from "recharts"
import type { TooltipPayload } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart"

import { ChartFrame, useChartMotion } from "./chart-frame"
import {
  createChartConfig,
  benchmarkTooltipMotionProps,
  formatScatterTooltipValue,
  getChartColorToken,
  getScatterYAxisTicks,
  toRechartsSeries,
} from "./model"
import type { BenchmarkPoint, ScatterTick, ScatterView } from "./types"

import styles from "./benchmark-charts.module.css"

export function ScatterChart({ view }: { view: ScatterView }) {
  const legendSeries = view.legendOrder
    ? view.legendOrder.flatMap((id) => view.series.filter((item) => item.id === id))
    : view.series

  return (
    <ChartFrame
      ariaLabel={view.ariaLabel}
      footnote={view.footnote}
      id={`scatter-${view.id}`}
      legend={legendSeries.map((item) => ({ emphasis: true, label: item.label, color: item.color, pattern: item.pattern }))}
      subtitle={view.subtitle}
      title={view.title}
    >
      <ScatterPlot view={view} />
    </ChartFrame>
  )
}

function ScatterPlot({ view }: { view: ScatterView }) {
  const { shouldAnimate } = useChartMotion()
  const patternPrefix = useId().replace(/:/g, "")
  const config = createChartConfig(view.series)
  const series = toRechartsSeries(view)
  const yTicks = getScatterYAxisTicks(view)

  return (
    <div className={`${styles.scatterStage} ${view.yAxisBreak ? styles.brokenAxis : ""}`}>
      <ChartContainer
        aria-label={view.ariaLabel}
        className={`${styles.chart} ${styles.recharts}`}
        config={config}
        id={`scatter-plot-${view.id}`}
        role="img"
      >
        <RechartsScatterChart
          accessibilityLayer
          margin={{ top: 12, right: 12, bottom: 37, left: 27 }}
        >
          <defs>
            {view.series.filter((item) => item.pattern).map((item) => {
              const patternId = `${patternPrefix}-${item.id}`

              return item.pattern === "dots" ? (
                <pattern id={patternId} key={patternId} width="6" height="6" patternUnits="userSpaceOnUse">
                  <rect width="6" height="6" fill={getChartColorToken(item.color)} />
                  <circle cx="1.5" cy="1.5" r="0.8" fill="var(--claude-chart-ink)" />
                  <circle cx="4.5" cy="4.5" r="0.8" fill="var(--claude-chart-ink)" />
                </pattern>
              ) : (
                <pattern id={patternId} key={patternId} width="6" height="6" patternUnits="userSpaceOnUse">
                  <rect width="6" height="6" fill={getChartColorToken(item.color)} />
                  <path d="M-1 1 l2 -2 M0 6 l6 -6 M5 7 l2 -2" stroke="var(--claude-chart-ink)" strokeWidth="1" />
                </pattern>
              )
            })}
          </defs>
          <CartesianGrid stroke="var(--claude-chart-grid)" />
          <XAxis
            allowDataOverflow
            dataKey="cost"
            domain={view.xDomain}
            name="Cost"
            scale="log"
            stroke="var(--claude-chart-ink)"
            tickFormatter={(value) => getTickLabel(value, view.xTicks)}
            ticks={view.xTicks.map((tick) => tick.value)}
            type="number"
            xAxisId={0}
            label={{
              className: styles.axisLabel,
              offset: 14,
              position: "bottom",
              value: view.xAxisLabel,
            }}
            tickMargin={2}
            tick={{ dy: 6 }}
          />
          <YAxis
            allowDataOverflow
            domain={[0, 1]}
            name="Score"
            stroke="var(--claude-chart-ink)"
            tickFormatter={(value) => getTickLabel(value, yTicks)}
            tickMargin={2}
            tick={{ dx: -2 }}
            ticks={yTicks.map((tick) => tick.value)}
            type="number"
            width={48}
            yAxisId={0}
          />
          <ScatterYAxisLabel value={view.yAxisLabel} />
          {view.yAxisBreak ? <ScatterAxisBreak /> : null}
          <ChartTooltip
            {...benchmarkTooltipMotionProps}
            content={<ScatterTooltipContent />}
            cursor={{ stroke: "var(--claude-chart-grid)" }}
            shared={false}
          />
          {series.map((item, index) => {
            const patternId = `${patternPrefix}-${item.id}`
            const fill = item.pattern
              ? `url(#${patternId})`
              : `var(--color-${item.id})`

            return (
              <Scatter
                animationBegin={index * 80}
                animationDuration={700}
                animationEasing="ease-out"
                data={item.data}
                dataKey="plotScore"
                fill={fill}
                id={item.id}
                isAnimationActive={shouldAnimate}
                key={item.id}
                line={{
                  stroke: "var(--claude-chart-ink)",
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  strokeWidth: 1.5,
                }}
                lineType="joint"
                name={item.label}
                shape={(props) => renderScatterPoint(props, item.label)}
                xAxisId={0}
                yAxisId={0}
              />
            )
          })}
        </RechartsScatterChart>
      </ChartContainer>
    </div>
  )
}

function renderScatterPoint(props: ScatterShapeProps, seriesLabel: string) {
  const point = getTooltipPoint(props.payload)

  if (typeof props.cx !== "number" || typeof props.cy !== "number") {
    return null
  }

  const labelY = point?.labelPosition === "below" ? props.cy + 25 : props.cy - 15

  return (
    <g
      aria-label={point ? `${seriesLabel} · ${point.effort}: ${point.scoreLabel ?? `${point.score.toFixed(1)}%`} ${point.costLabel}` : seriesLabel}
      className={styles.pointNode}
      tabIndex={0}
    >
      <circle
        className={styles.pointMark}
        cx={props.cx}
        cy={props.cy}
        fill={getPointFill(props)}
        r={7}
      />
      {point && point.showLabel !== false ? (
        <text className={styles.pointLabel} textAnchor="middle" x={props.cx} y={labelY}>
          {point.effort}
        </text>
      ) : null}
    </g>
  )
}

function ScatterTooltipContent({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipPayload
}) {
  if (!active || !payload?.length) {
    return null
  }

  const item = payload[0]
  const point = getTooltipPoint(item?.payload)
  const seriesLabel = point?.seriesLabel ?? (typeof item?.name === "string" ? item.name : "Series")

  return (
    <div className={`${styles.tooltip} ${styles.scatterTooltip}`}>
      <div className={styles.tooltipLabel}>{point ? `${seriesLabel} · ${point.effort}` : seriesLabel}</div>
      <div className={styles.tooltipValue}>
        {point ? formatScatterTooltipValue(point) : String(item?.value ?? "")}
      </div>
    </div>
  )
}

function getPointFill(props: ScatterShapeProps): string {
  const fill = (props as ScatterShapeProps & { fill?: string }).fill
  return typeof fill === "string" ? fill : "var(--claude-chart-ink)"
}

function ScatterAxisBreak() {
  const plotArea = usePlotArea()

  if (!plotArea) {
    return null
  }

  const markerTop = plotArea.y + plotArea.height - 19

  return (
    <g className={styles.axisBreak}>
      <line x1={plotArea.x} x2={plotArea.x} y1={markerTop} y2={markerTop + 10} />
      <polyline points={`${plotArea.x - 6},${markerTop + 1} ${plotArea.x + 6},${markerTop + 3} ${plotArea.x - 6},${markerTop + 7} ${plotArea.x + 6},${markerTop + 9}`} />
    </g>
  )
}

function ScatterYAxisLabel({ value }: { value: string }) {
  const plotArea = usePlotArea()

  if (!plotArea) {
    return null
  }

  return (
    <text
      className={styles.axisLabel}
      dy="1em"
      textAnchor="middle"
      transform={`translate(${plotArea.x - 63}, ${plotArea.y + plotArea.height / 2}) rotate(-90)`}
    >
      {value}
    </text>
  )
}

function getTickLabel(value: number | string, ticks: readonly ScatterTick[]): string {
  const numericValue = Number(value)
  return ticks.find((tick) => tick.value === numericValue)?.label ?? String(value)
}

type TooltipPoint = BenchmarkPoint & { seriesLabel?: string; showLabel?: boolean }

function getTooltipPoint(value: unknown): TooltipPoint | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const candidate = value as Partial<TooltipPoint>
  if (
    typeof candidate.effort === "string" &&
    typeof candidate.cost === "number" &&
    typeof candidate.costLabel === "string" &&
    typeof candidate.score === "number"
  ) {
  return candidate as TooltipPoint
}

  return undefined
}
