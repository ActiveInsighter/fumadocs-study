"use client"

import { useId } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
  usePlotArea,
} from "recharts"
import type { BarShapeProps } from "recharts"
import type { TooltipPayload } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"

import { ChartFrame, useChartMotion } from "./chart-frame"
import { benchmarkTooltipMotionProps } from "./model"
import type { IndexedCostGroup } from "./types"

import styles from "./benchmark-charts.module.css"

type IndexedCostDatum = {
  id: string
  model: "Fable 5" | "Fable 5.1"
  cacheReads: number
  otherTokens: number
  total: number
  annotation: string
}

const indexedCostConfig = {
  cacheReads: {
    label: "Cache reads",
    color: "var(--claude-chart-ink)",
  },
  otherTokens: {
    label: "All other tokens",
    color: "var(--claude-chart-ink)",
  },
} satisfies ChartConfig

export function IndexedCostChart({ groups }: { groups: readonly IndexedCostGroup[] }) {
  return (
    <ChartFrame
      ariaLabel="Indexed cost of Fable usage"
      footnote="Indexed cost of running the same workloads on Fable 5 and Fable 5.1, at usage-based pricing measured at default effort over four weeks of actual usage in August 2026. Typical workload covers Fable usage across Claude Enterprise, Claude Code, and the API. Highly agentic workload covers context-heavy, tool-heavy work, where cache reads make up most of the cost."
      id="indexed-cost"
      legend={[{ label: "Cache reads", color: "paper", pattern: "hatch" }, { label: "All other tokens", color: "paper" }]}
      title="Indexed cost of Fable usage"
    >
      <IndexedCostPlot groups={groups} />
    </ChartFrame>
  )
}

function IndexedCostPlot({ groups }: { groups: readonly IndexedCostGroup[] }) {
  const { shouldAnimate } = useChartMotion()
  const patternPrefix = useId().replace(/:/g, "")

  return (
    <div className={styles.indexedStage}>
      <div className={styles.indexedSubplots}>
        {groups.map((group, groupIndex) => (
          <IndexedCostSubplot
            group={group}
            groupIndex={groupIndex}
            isAnimationActive={shouldAnimate}
            key={group.label}
            patternPrefix={patternPrefix}
          />
        ))}
      </div>
    </div>
  )
}

function IndexedCostSubplot({
  group,
  groupIndex,
  isAnimationActive,
  patternPrefix,
}: {
  group: IndexedCostGroup
  groupIndex: number
  isAnimationActive: boolean
  patternPrefix: string
}) {
  const data = toIndexedCostData(group, groupIndex)
  const cloudPatternId = `${patternPrefix}-cloud-${groupIndex}`
  const matchaPatternId = `${patternPrefix}-matcha-${groupIndex}`

  return (
    <ChartContainer
      aria-label={`${group.label} indexed cost`}
      className={`${styles.chart} ${styles.indexedChart} ${styles.recharts}`}
      config={indexedCostConfig}
      id={`indexed-cost-${groupIndex}`}
      role="img"
    >
      <BarChart
        accessibilityLayer
        barSize={86.615}
        data={data}
        margin={{ top: 36, right: 12, bottom: 19, left: 0 }}
      >
        <defs>
          <pattern height="8" id={cloudPatternId} patternUnits="userSpaceOnUse" width="8">
            <rect fill="var(--claude-chart-cloud)" height="8" width="8" />
            <path d="M-1 1 l2 -2 M0 8 l8 -8 M7 9 l2 -2" stroke="var(--claude-chart-ink)" strokeWidth="1" />
          </pattern>
          <pattern height="8" id={matchaPatternId} patternUnits="userSpaceOnUse" width="8">
            <rect fill="var(--claude-chart-matcha)" height="8" width="8" />
            <path d="M-1 1 l2 -2 M0 8 l8 -8 M7 9 l2 -2" stroke="var(--claude-chart-ink)" strokeWidth="1" />
          </pattern>
        </defs>
        <CartesianGrid horizontal stroke="var(--claude-chart-grid)" vertical={false} />
        <XAxis
          axisLine={{ stroke: "var(--claude-chart-ink)" }}
          dataKey="model"
          height={0}
          tick={false}
          tickLine={false}
          xAxisId={0}
        />
        <YAxis
          axisLine={{ stroke: "var(--claude-chart-ink)" }}
          domain={[0, 110]}
          ticks={[0, 25, 50, 75, 100]}
          tick={<IndexedYAxisTick />}
          tickLine={false}
          type="number"
          width={43}
          yAxisId={0}
        />
        <ChartTooltip
          {...benchmarkTooltipMotionProps}
          content={<IndexedTooltipContent />}
          cursor={{ fill: "var(--claude-chart-gray)", opacity: 0.45 }}
          shared={false}
        />
        <Bar
          animationDuration={700}
          animationEasing="ease-out"
          dataKey="cacheReads"
          isAnimationActive={isAnimationActive}
          stackId="cost"
          shape={(props) => <IndexedBarShape {...props} segmentKey="cacheReads" segmentLabel="Cache reads" />}
          stroke="var(--claude-chart-ink)"
          strokeWidth={1}
          xAxisId={0}
          yAxisId={0}
        >
          {data.map((item) => (
            <Cell
              fill={item.model === "Fable 5" ? `url(#${cloudPatternId})` : `url(#${matchaPatternId})`}
              key={item.id}
            />
          ))}
        </Bar>
        <Bar
          animationDuration={700}
          animationEasing="ease-out"
          dataKey="otherTokens"
          isAnimationActive={isAnimationActive}
          stackId="cost"
          shape={(props) => <IndexedBarShape {...props} segmentKey="otherTokens" segmentLabel="All other tokens" />}
          stroke="var(--claude-chart-ink)"
          strokeWidth={1}
          xAxisId={0}
          yAxisId={0}
        >
          {data.map((item) => (
            <Cell
              fill={item.model === "Fable 5" ? "var(--claude-chart-cloud)" : "var(--claude-chart-matcha)"}
              key={item.id}
            />
          ))}
        </Bar>
        <IndexedSubplotOverlay data={data} title={group.label} />
      </BarChart>
    </ChartContainer>
  )
}

function IndexedSubplotOverlay({
  data,
  title,
}: {
  data: readonly IndexedCostDatum[]
  title: string
}) {
  const plotArea = usePlotArea()

  if (!plotArea) {
    return null
  }

  const categoryWidth = plotArea.width / data.length
  const baseline = plotArea.y + plotArea.height
  const valueScale = plotArea.height / 110

  return (
    <g>
      <text className={styles.indexedPanelTitle} textAnchor="middle" x={plotArea.x + plotArea.width / 2} y={14}>
        {title}
      </text>
      <text
        className={styles.axisLabel}
        dy="1em"
        textAnchor="middle"
        transform={`translate(${plotArea.x - 41}, ${plotArea.y + plotArea.height / 2}) rotate(-90)`}
      >
        Indexed cost (Fable 5 = 100)
      </text>
      {data.map((item, index) => {
        const x = plotArea.x + categoryWidth * (index + 0.5)
        const valueY = baseline - item.total * valueScale - 8

        return (
          <g key={item.id}>
            <text className={styles.indexedCategoryLabel} dy="1em" textAnchor="middle" x={x} y={baseline + 4}>
              <tspan className={styles.emphasis}>{item.model}</tspan>
            </text>
            <text className={styles.indexedValueLabel} textAnchor="middle" x={x} y={valueY}>
              <tspan x={x}>{item.annotation}</tspan>
            </text>
          </g>
        )
      })}
    </g>
  )
}

function IndexedYAxisTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number
  y?: number
  payload?: { value?: unknown }
}) {
  return (
    <text className={styles.indexedTick} dy="0.35em" textAnchor="end" x={x + 4} y={y}>
      {typeof payload?.value === "number" ? payload.value : String(payload?.value ?? "")}
    </text>
  )
}

function IndexedTooltipContent({
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
  const data = getIndexedCostDatum(item?.payload)
  const dataKey = getIndexedDataKey(item?.dataKey)
  const segmentLabel = dataKey === "cacheReads" ? "Cache reads" : "All other tokens"
  const value = data && dataKey ? data[dataKey] : undefined

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{data ? `${segmentLabel} · ${data.model}` : segmentLabel}</div>
      <div className={styles.tooltipValue}>{typeof value === "number" ? value.toFixed(1) : String(item?.value ?? "")}</div>
    </div>
  )
}

function IndexedBarShape({
  x,
  y,
  width,
  height,
  fill,
  payload,
  segmentKey,
  segmentLabel,
}: BarShapeProps & {
  segmentKey: "cacheReads" | "otherTokens"
  segmentLabel: string
}) {
  const data = getIndexedCostDatum(payload)
  const value = data?.[segmentKey]

  return (
    <rect
      aria-label={data ? `${segmentLabel} · ${data.model}: ${value?.toFixed(1) ?? "0.0"}` : segmentLabel}
      className={styles.barMark}
      fill={fill}
      height={height}
      stroke="var(--claude-chart-ink)"
      strokeWidth={1}
      tabIndex={0}
      width={width}
      x={x}
      y={y}
    />
  )
}

function getIndexedCostDatum(value: unknown): IndexedCostDatum | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const candidate = value as Partial<IndexedCostDatum>
  return typeof candidate.model === "string" && typeof candidate.cacheReads === "number" && typeof candidate.otherTokens === "number"
    ? candidate as IndexedCostDatum
    : undefined
}

function getIndexedDataKey(value: unknown): "cacheReads" | "otherTokens" | undefined {
  return value === "cacheReads" || value === "otherTokens" ? value : undefined
}

function toIndexedCostData(group: IndexedCostGroup, groupIndex: number): readonly IndexedCostDatum[] {
  const fable5Total = group.fable5.cacheReads + group.fable5.otherTokens
  const fable51Total = group.fable51.cacheReads + group.fable51.otherTokens

  return [
    {
      id: `${groupIndex}-fable-5`,
      model: "Fable 5",
      cacheReads: group.fable5.cacheReads,
      otherTokens: group.fable5.otherTokens,
      total: fable5Total,
      annotation: String(fable5Total),
    },
    {
      id: `${groupIndex}-fable-51`,
      model: "Fable 5.1",
      cacheReads: group.fable51.cacheReads,
      otherTokens: group.fable51.otherTokens,
      total: fable51Total,
      annotation: group.savingsLabel,
    },
  ]
}
