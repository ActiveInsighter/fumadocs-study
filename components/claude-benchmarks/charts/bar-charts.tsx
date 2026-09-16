"use client"

import { useSyncExternalStore } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
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
import type { CostBarRow, HorizontalBarRow } from "./types"

import styles from "./benchmark-charts.module.css"

const mobileChartMediaQuery = "(max-width: 567px)"

function subscribeToMobileChart(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia(mobileChartMediaQuery)
  mediaQuery.addEventListener("change", onStoreChange)
  return () => mediaQuery.removeEventListener("change", onStoreChange)
}

function getIsMobileChart(): boolean {
  return window.matchMedia(mobileChartMediaQuery).matches
}

function getServerIsMobileChart(): boolean {
  return false
}

type BarData = {
  id: string
  label: string
  note: string
  value?: number
  valueLabel?: string
  original?: number
  optimized?: number
  originalLabel?: string
  optimizedLabel?: string
}

type BarSpec = {
  dataKey: "value" | "original" | "optimized"
  labelKey: "valueLabel" | "originalLabel" | "optimizedLabel"
  configKey: "value" | "original" | "optimized"
}

const inferenceConfig = {
  value: {
    label: "Optimized",
    color: "var(--claude-chart-heather)",
  },
} satisfies ChartConfig

const genomeConfig = {
  original: {
    label: "Original implementation",
    color: "var(--claude-chart-coral)",
  },
  optimized: {
    label: "Optimized",
    color: "var(--claude-chart-heather)",
  },
} satisfies ChartConfig

export function InferenceSpeedupChart({ rows }: { rows: readonly HorizontalBarRow[] }) {
  return (
    <ChartFrame
      ariaLabel="Inference speedup"
      footnote="Inference speedup for seven open-source protein and genomics models on an NVIDIA H100"
      id="inference-speedup"
      title="Inference speedup"
    >
      <HorizontalBarPlot
        ariaLabel="Inference speedup"
        bars={[{ configKey: "value", dataKey: "value", labelKey: "valueLabel" }]}
        config={inferenceConfig}
        data={rows.map((row, index) => ({ ...row, id: `inference-${index}` }))}
        domain={[0, 3]}
        id="inference-speedup"
        axisLabel="Speedup on an NVIDIA H100 (×)"
        mobileAxisLabel="Speedup (×)"
        ticks={[0, 1, 2, 3]}
        referenceValue={1}
        variant="inference"
      />
    </ChartFrame>
  )
}

export function GenomeCostChart({ rows }: { rows: readonly CostBarRow[] }) {
  return (
    <ChartFrame
      ariaLabel="Estimated cost savings on genome-wide analyses"
      footnote="Estimated GPU cost of three genome-wide analyses before and after optimization, at cloud list price. Evo 2 40B saves more on a whole job (2.3x) than per forward (1.4x) because some of its optimizations only pay off across many sequences."
      id="genome-cost"
      legend={[{ label: "Original implementation", color: "coral" }, { label: "Optimized", color: "heather" }]}
      title="Estimated cost savings on genome-wide analyses"
    >
      <HorizontalBarPlot
        ariaLabel="Estimated cost savings on genome-wide analyses"
        bars={[
          { configKey: "original", dataKey: "original", labelKey: "originalLabel" },
          { configKey: "optimized", dataKey: "optimized", labelKey: "optimizedLabel" },
        ]}
        config={genomeConfig}
        data={rows.map((row, index) => ({ ...row, id: `genome-${index}` }))}
        domain={[0, 35]}
        id="genome-cost"
        axisLabel="Estimated GPU cost (NVIDIA H100, cloud list price, USD thousands)"
        mobileAxisLabel="Estimated GPU cost (USD thousands)"
        ticks={[0, 10, 20, 30]}
        variant="genome"
      />
    </ChartFrame>
  )
}

function HorizontalBarPlot({
  data,
  config,
  bars,
  ariaLabel,
  domain,
  id,
  axisLabel,
  mobileAxisLabel,
  ticks,
  variant = "inference",
  referenceValue,
}: {
  data: readonly BarData[]
  config: ChartConfig
  bars: readonly BarSpec[]
  ariaLabel: string
  domain: readonly [number, number]
  id: string
  axisLabel: string
  mobileAxisLabel: string
  ticks: readonly number[]
  variant?: "inference" | "genome"
  referenceValue?: number
}) {
  const { shouldAnimate } = useChartMotion()
  const isMobile = useSyncExternalStore(subscribeToMobileChart, getIsMobileChart, getServerIsMobileChart)
  const notes = Object.fromEntries(data.map((row) => [row.label, row.note]))
  const chartClassName = isMobile
    ? variant === "genome" ? styles.barChartMobileCompact : styles.barChartMobile
    : variant === "genome" ? styles.barChartCompact : styles.barChart

  return (
    <div className={styles.barStage}>
      <BarChartVariant
        animate={shouldAnimate}
        bars={bars}
        className={chartClassName}
        config={config}
        data={data}
        domain={domain}
        id={id}
        axisLabel={axisLabel}
        ariaLabel={ariaLabel}
        mobileAxisLabel={mobileAxisLabel}
        mobile={isMobile}
        notes={notes}
        referenceValue={referenceValue}
        ticks={ticks}
        variant={variant}
      />
    </div>
  )
}

function BarChartVariant({
  data,
  config,
  bars,
  ariaLabel,
  domain,
  id,
  axisLabel,
  mobileAxisLabel,
  ticks,
  notes,
  animate,
  className,
  mobile,
  variant,
  referenceValue,
}: {
  data: readonly BarData[]
  config: ChartConfig
  bars: readonly BarSpec[]
  ariaLabel: string
  domain: readonly [number, number]
  id: string
  axisLabel: string
  mobileAxisLabel: string
  mobile: boolean
  ticks: readonly number[]
  notes: Readonly<Record<string, string>>
  animate: boolean
  className: string
  variant: "inference" | "genome"
  referenceValue?: number
}) {
  const compact = variant === "genome"

  return (
    <ChartContainer
      aria-label={ariaLabel}
      className={`${styles.chart} ${styles.recharts} ${className}`}
      config={config}
      id={`${id}-${mobile ? "mobile" : "desktop"}`}
      role="img"
    >
      <BarChart
        accessibilityLayer
        barGap={compact ? 7.333 : 4}
        data={data}
        layout="vertical"
        margin={{
          top: mobile ? compact ? 18 : 32 : compact ? 12 : 30,
          right: mobile ? compact ? 18 : 30 : 12,
          bottom: mobile ? 36 : 37,
          left: 0,
        }}
      >
        <CartesianGrid horizontal={false} stroke="var(--claude-chart-grid)" vertical />
        {referenceValue !== undefined ? <BarReferenceLine value={referenceValue} domain={domain} /> : null}
        <XAxis
          domain={domain}
          stroke="var(--claude-chart-ink)"
          tickFormatter={(value) => String(value)}
          ticks={ticks}
          type="number"
          xAxisId={0}
          label={{
            className: styles.axisLabel,
            offset: 14,
            position: "bottom",
            value: mobile ? mobileAxisLabel : axisLabel,
          }}
          tick={{ dy: 6 }}
        />
        <YAxis
          axisLine={false}
          dataKey="label"
          hide={mobile}
          interval={0}
          tick={mobile ? false : <BarCategoryTick compact={compact} notes={notes} />}
          tickLine={false}
          type="category"
          width={mobile ? 0 : compact ? 224 : 168}
          yAxisId={0}
        />
          <ChartTooltip
            {...benchmarkTooltipMotionProps}
            content={<BarTooltipContent bars={bars} config={config} />}
          cursor={{ fill: "var(--claude-chart-gray)", opacity: 0.45 }}
          shared={false}
        />
        {bars.map((bar) => (
          <Bar
            animationBegin={0}
            animationDuration={700}
            animationEasing="ease-out"
            barSize={mobile ? 18 : 26}
            dataKey={bar.dataKey}
            fill={`var(--color-${bar.configKey})`}
            isAnimationActive={animate}
            key={bar.dataKey}
            radius={0}
            shape={(props) =>
              mobile ? (
                <MobileBarShape {...props} labelKey={bar.labelKey} seriesLabel={getSeriesLabel(config, bar.configKey)} />
              ) : (
                <AccessibleBarShape {...props} labelKey={bar.labelKey} seriesLabel={getSeriesLabel(config, bar.configKey)} />
              )
            }
            stroke="var(--claude-chart-ink)"
            strokeWidth={1}
            yAxisId={0}
          >
            {!mobile ? (
              <LabelList
                className={styles.barValueLabel}
                dataKey={bar.labelKey}
                offset={8}
                position="right"
              />
            ) : null}
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  )
}

function BarCategoryTick({
  x = 0,
  y = 0,
  payload,
  notes,
  compact = false,
}: {
  x?: number
  y?: number
  payload?: { value?: unknown }
  notes: Readonly<Record<string, string>>
  compact?: boolean
}) {
  const label = typeof payload?.value === "string" ? payload.value : ""
  const note = notes[label] ?? ""
  const labelX = x - 2
  const wrapsNote = compact && note.includes("around 20,000 genes")
  const labelY = y - (wrapsNote ? 19 : 11.5)
  const noteY = y + (wrapsNote ? 4 : 11.5)

  return (
    <>
      <text className={styles.barCategoryLabel} textAnchor="end" x={labelX} y={labelY} dy="0.35em">
        {renderCategoryLabel(label)}
      </text>
      <text className={styles.barCategoryNote} textAnchor="end" x={labelX} y={noteY} dy="0.35em">
        {wrapsNote ? (
          <>
            <tspan x={labelX}>{note.replace(" 20,000 genes", "")}</tspan>
            <tspan dy="15" x={labelX}>20,000 genes</tspan>
          </>
        ) : note}
      </text>
    </>
  )
}

function BarReferenceLine({
  domain,
  value,
}: {
  domain: readonly [number, number]
  value: number
}) {
  const plotArea = usePlotArea()

  if (!plotArea) {
    return null
  }

  const [minimum, maximum] = domain
  const ratio = maximum <= minimum ? 0 : (value - minimum) / (maximum - minimum)
  const x = plotArea.x + Math.min(1, Math.max(0, ratio)) * plotArea.width

  return (
    <g>
      <line className={styles.referenceLine} strokeDasharray="6 4" x1={x} x2={x} y1={plotArea.y} y2={plotArea.y + plotArea.height} />
      <text className={styles.referenceLabel} textAnchor="middle" x={x} y={plotArea.y - 8}>
        Original implementation
      </text>
    </g>
  )
}

function BarTooltipContent({
  active,
  bars,
  config,
  payload,
}: {
  active?: boolean
  bars: readonly BarSpec[]
  config: ChartConfig
  payload?: TooltipPayload
}) {
  if (!active || !payload?.length) {
    return null
  }

  const item = payload[0]
  const dataKey = typeof item?.dataKey === "string" ? item.dataKey : undefined
  const bar = bars.find((candidate) => candidate.dataKey === dataKey)
  const data = getBarData(item?.payload)
  const seriesLabel = bar ? getSeriesLabel(config, bar.configKey) : dataKey ?? "Value"
  const valueText = bar ? getBarValueLabel(data, bar.labelKey) : String(item?.value ?? "")

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{getBarTooltipLabel(seriesLabel, data)}</div>
      <div className={styles.tooltipValue}>{valueText}</div>
    </div>
  )
}

function renderCategoryLabel(label: string) {
  const separator = label.indexOf(" (")

  if (separator < 0) {
    return label
  }

  return (
    <>
      <tspan className={styles.emphasis}>{label.slice(0, separator)}</tspan>
      {label.slice(separator)}
    </>
  )
}

function MobileBarShape({
  x = 0,
  y = 0,
  width,
  height,
  fill,
  payload,
  labelKey,
  seriesLabel,
}: BarShapeProps & { labelKey: BarSpec["labelKey"]; seriesLabel: string }) {
  const data = getBarData(payload)
  const valueText = getBarValueLabel(data, labelKey)

  return (
    <g>
      <text className={styles.mobileBarLabel} x={0} y={y - 13}>{data?.label ?? ""}</text>
      <text className={styles.mobileBarNote} x={0} y={y - 1}>{data?.note ?? ""}</text>
      <rect
        aria-label={getBarAriaLabel(seriesLabel, data, valueText)}
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
      <text className={styles.mobileBarValue} x={x + width + 7} y={y + height - 4}>{valueText}</text>
    </g>
  )
}

function AccessibleBarShape({
  x,
  y,
  width,
  height,
  fill,
  payload,
  labelKey,
  seriesLabel,
}: BarShapeProps & { labelKey: BarSpec["labelKey"]; seriesLabel: string }) {
  const data = getBarData(payload)
  const valueText = getBarValueLabel(data, labelKey)

  return (
    <rect
      aria-label={getBarAriaLabel(seriesLabel, data, valueText)}
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

function getSeriesLabel(config: ChartConfig, key: BarSpec["configKey"]): string {
  const label = config[key]?.label
  return typeof label === "string" ? label : key
}

function getBarValueLabel(data: BarData | undefined, labelKey: BarSpec["labelKey"]): string {
  const valueLabel = data ? data[labelKey] : undefined
  return typeof valueLabel === "string" ? valueLabel : ""
}

function getBarAriaLabel(seriesLabel: string, data: BarData | undefined, valueText: string): string {
  if (!data) {
    return seriesLabel
  }

  return `${seriesLabel} · ${data.label}: ${valueText}`
}

function getBarTooltipLabel(seriesLabel: string, data: BarData | undefined): string {
  return data ? `${seriesLabel} · ${data.label}` : seriesLabel
}

function getBarData(value: unknown): BarData | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const candidate = value as Partial<BarData>
  return typeof candidate.label === "string" && typeof candidate.note === "string" ? candidate as BarData : undefined
}
