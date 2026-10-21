"use client"

import { useMemo } from "react"
import type { TooltipPayload } from "recharts"
import { CartesianGrid, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts"

import { ChartContainer, ChartTooltip } from "@/components/ui/chart"

import { createFormatter, toNumber } from "../core/format"
import { logTicks, paddedLogDomain } from "../core/scales"
import { seriesFill } from "../core/series"
import type { ChartColor, ChartDatum, ChartSeries, ValueFormat } from "../core/types"
import { ChartFigure } from "../primitives/chart-figure"
import { useChartMotion } from "../primitives/chart-motion"
import { tooltipMotionProps } from "../primitives/chart-tooltip"
import { useChartSeries, type ChartSeriesModel } from "../primitives/use-chart-series"
import { axisTitle, chartStyles, figureProps, quietAxis, valueAxis, type BaseChartProps, type ReferenceLineSpec } from "./shared"

export type StudyScatterChartProps = BaseChartProps & {
  data: readonly ChartDatum[]
  xKey: string
  yKey: string
  /** Bubble size field. Turns the scatter into a bubble chart. */
  sizeKey?: string
  /** Splits rows into coloured groups by this field. */
  groupKey?: string
  /** Optional group order / colours / labels, keyed by group value. */
  groups?: readonly (Omit<ChartSeries, "key"> & { value: string })[]
  /** Row field naming each point in the tooltip and table. */
  nameKey?: string
  /** Single-series label (legacy API). */
  label?: string
  color?: ChartColor
  xLabel?: string
  yLabel?: string
  sizeLabel?: string
  xFormat?: ValueFormat
  yFormat?: ValueFormat
  sizeFormat?: ValueFormat
  xScale?: "linear" | "log"
  referenceLines?: readonly ReferenceLineSpec[]
}

type Group = { key: string; rows: ChartDatum[] }

export function groupRows(data: readonly ChartDatum[], groupKey: string | undefined, order: readonly string[] = []): Group[] {
  if (!groupKey) return [{ key: "__all", rows: [...data] }]
  const groups = new Map<string, ChartDatum[]>()
  for (const value of order) groups.set(value, [])
  for (const row of data) {
    const key = String(row[groupKey] ?? "—")
    const rows = groups.get(key) ?? []
    rows.push(row)
    groups.set(key, rows)
  }
  return [...groups.entries()].filter(([, rows]) => rows.length > 0).map(([key, rows]) => ({ key, rows }))
}

export function StudyScatterChart(props: StudyScatterChartProps) {
  const { data, xKey, yKey, sizeKey, groupKey, groups: groupMeta, nameKey, label, color, xLabel, yLabel, sizeLabel, locale, showLegend } = props
  const groups = useMemo(() => groupRows(data, groupKey, groupMeta?.map((item) => item.value)), [data, groupKey, groupMeta])
  const seriesInput = useMemo<ChartSeries[]>(
    () =>
      groups.map((group) => {
        const meta = groupMeta?.find((item) => item.value === group.key)
        return {
          key: group.key,
          label: meta?.label ?? (group.key === "__all" ? label ?? yLabel ?? yKey : group.key),
          color: meta?.color ?? (group.key === "__all" ? color : undefined),
          hidden: meta?.hidden,
        }
      }),
    [groups, groupMeta, label, yLabel, yKey, color],
  )
  const model = useChartSeries(seriesInput, "dot")
  const formats = {
    x: createFormatter(props.xFormat, locale),
    y: createFormatter(props.yFormat, locale),
    size: createFormatter(props.sizeFormat, locale),
  }
  const empty = !data.some((row) => toNumber(row[xKey]) !== undefined && toNumber(row[yKey]) !== undefined)

  return (
    <ChartFigure
      {...figureProps(props, {
        empty,
        legend: showLegend === false || groups.length < 2 ? undefined : model.legend,
        onLegendToggle: props.toggleable === false ? undefined : model.toggle,
        legendAlign: "start",
        table: {
          columns: [
            ...(nameKey ? [{ key: nameKey, label: nameKey }] : []),
            ...(groupKey ? [{ key: groupKey, label: groupKey }] : []),
            { key: xKey, label: xLabel ?? xKey, numeric: true, formatter: formats.x },
            { key: yKey, label: yLabel ?? yKey, numeric: true, formatter: formats.y },
            ...(sizeKey ? [{ key: sizeKey, label: sizeLabel ?? sizeKey, numeric: true, formatter: formats.size }] : []),
          ],
          rows: data,
        },
      })}
    >
      <ScatterPlot {...props} formats={formats} model={model} plotGroups={groups} />
    </ChartFigure>
  )
}

function ScatterPlot({
  xKey,
  yKey,
  sizeKey,
  nameKey,
  groupKey,
  xLabel,
  yLabel,
  sizeLabel,
  xScale = "linear",
  height = 320,
  referenceLines,
  plotGroups: groups,
  model,
  formats,
}: StudyScatterChartProps & {
  plotGroups: Group[]
  model: ChartSeriesModel
  formats: { x: (value: number) => string; y: (value: number) => string; size: (value: number) => string }
}) {
  const { shouldAnimate } = useChartMotion()
  const xValues = groups.flatMap((group) => group.rows.map((row) => toNumber(row[xKey]))).filter((value): value is number => value !== undefined)
  const logDomain = xScale === "log" ? paddedLogDomain(xValues) : undefined
  const sizes = sizeKey ? groups.flatMap((group) => group.rows.map((row) => toNumber(row[sizeKey]) ?? 0)) : []

  return (
    <ChartContainer className={chartStyles.chartBox} config={model.config} style={{ height }}>
      <ScatterChart accessibilityLayer margin={{ top: 16, right: 20, bottom: xLabel ? 26 : 6, left: yLabel ? 14 : 2 }}>
        <CartesianGrid />
        <XAxis
          {...quietAxis}
          axisLine={{ stroke: "var(--chart-axis)" }}
          dataKey={xKey}
          domain={logDomain ? [logDomain[0], logDomain[1]] : ["auto", "auto"]}
          label={axisTitle(xLabel, "insideBottom", -18)}
          name={xLabel ?? xKey}
          scale={xScale === "log" ? "log" : "auto"}
          tickFormatter={(value: number) => formats.x(value)}
          ticks={logDomain ? logTicks(logDomain) : undefined}
          type="number"
        />
        <YAxis
          {...valueAxis}
          dataKey={yKey}
          domain={["auto", "auto"]}
          label={axisTitle(yLabel, "insideLeft", 4)}
          name={yLabel ?? yKey}
          tickFormatter={(value: number) => formats.y(value)}
          type="number"
          width="auto"
        />
        {sizeKey ? <ZAxis dataKey={sizeKey} domain={[Math.min(...sizes), Math.max(...sizes)]} name={sizeLabel ?? sizeKey} range={[60, 900]} /> : null}
        {referenceLines?.map((line, index) => (
          <ReferenceLine
            key={index}
            label={line.label ? { value: line.label, position: "insideTopRight" } : undefined}
            {...(line.axis === "x" ? { x: Number(line.value) } : { y: Number(line.value) })}
          />
        ))}
        <ChartTooltip
          {...tooltipMotionProps}
          content={<ScatterTooltip formats={formats} groupKey={groupKey} labels={{ x: xLabel ?? xKey, y: yLabel ?? yKey, size: sizeLabel ?? sizeKey }} nameKey={nameKey} sizeKey={sizeKey} xKey={xKey} yKey={yKey} />}
          cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }}
        />
        {groups.map((group, index) => {
          const item = model.series[index]
          if (!item) return null
          return (
            <Scatter
              animationBegin={index * 90}
              animationDuration={700}
              data={group.rows}
              fill={seriesFill(item)}
              fillOpacity={sizeKey ? 0.55 : 0.88}
              hide={model.isHidden(item.key)}
              isAnimationActive={shouldAnimate}
              key={group.key}
              name={item.label}
              shape={sizeKey ? "circle" : renderDot}
              stroke={sizeKey ? seriesFill(item) : "var(--chart-panel)"}
              strokeWidth={sizeKey ? 1.25 : 2}
            />
          )
        })}
      </ScatterChart>
    </ChartContainer>
  )
}

/** Fixed 5.5px dots with a surface ring: visible, and large enough to hit. */
function renderDot(props: { cx?: number; cy?: number; fill?: string }) {
  if (typeof props.cx !== "number" || typeof props.cy !== "number") return <g />
  return <circle cx={props.cx} cy={props.cy} fill={props.fill} r={5.5} stroke="var(--chart-panel)" strokeWidth={2} />
}

function ScatterTooltip({
  active,
  payload,
  xKey,
  yKey,
  sizeKey,
  nameKey,
  groupKey,
  labels,
  formats,
}: {
  active?: boolean
  payload?: TooltipPayload
  xKey: string
  yKey: string
  sizeKey?: string
  nameKey?: string
  groupKey?: string
  labels: { x: string; y: string; size?: string }
  formats: { x: (value: number) => string; y: (value: number) => string; size: (value: number) => string }
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as ChartDatum | undefined
  if (!row) return null
  // Name the point, else its group; never the axis name Recharts puts in `name`.
  const header = nameKey ? row[nameKey] : groupKey ? row[groupKey] : undefined
  const line = (label: string, value: unknown, format: (value: number) => string) => (
    <div className={chartStyles.tooltipRow} key={label} style={{ gridTemplateColumns: "1fr auto" }}>
      <span className={chartStyles.tooltipName}>{label}</span>
      <span className={chartStyles.tooltipValue}>{typeof value === "number" ? format(value) : String(value ?? "–")}</span>
    </div>
  )

  return (
    <div className={chartStyles.tooltip} role="status">
      {header !== undefined ? <div className={chartStyles.tooltipLabel}>{String(header)}</div> : null}
      <div className={chartStyles.tooltipRows}>
        {line(labels.x, row[xKey], formats.x)}
        {line(labels.y, row[yKey], formats.y)}
        {sizeKey ? line(labels.size ?? sizeKey, row[sizeKey], formats.size) : null}
      </div>
    </div>
  )
}
