"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

import { StudyChartFrame, useChartMotion } from "./chart-frame"
import { buildHistogramBins } from "./study-chart-model"

import styles from "./study-charts.module.css"

export type StudyChartDatum = Record<string, string | number | null | undefined>

export type StudyChartSeries = {
  key: string
  label?: string
  color?: string
}

type CommonChartProps = {
  title: string
  description?: string
  footnote?: string
  height?: number
  showLegend?: boolean
}

type CartesianChartProps = CommonChartProps & {
  data: readonly StudyChartDatum[]
  xKey: string
  series: readonly StudyChartSeries[]
  yLabel?: string
}

const defaultColors = [
  "var(--study-chart-1)",
  "var(--study-chart-2)",
  "var(--study-chart-3)",
  "var(--study-chart-4)",
  "var(--study-chart-5)",
] as const

function createConfig(series: readonly StudyChartSeries[]): ChartConfig {
  return Object.fromEntries(
    series.map((item, index) => [
      item.key,
      {
        label: item.label ?? item.key,
        color: item.color ?? defaultColors[index % defaultColors.length],
      },
    ]),
  )
}

function chartData(data: readonly StudyChartDatum[]): StudyChartDatum[] {
  return data.map((item) => ({ ...item }))
}

function CommonLegend({ show }: { show: boolean }) {
  if (!show) return null
  return <ChartLegend content={<ChartLegendContent />} />
}

export function StudyBarChart({
  data,
  xKey,
  series,
  title,
  description,
  footnote,
  height = 320,
  showLegend = series.length > 1,
  stacked = false,
  horizontal = false,
  yLabel,
}: CartesianChartProps & {
  stacked?: boolean
  horizontal?: boolean
}) {
  const config = createConfig(series)

  return (
    <StudyChartFrame
      ariaLabel={title}
      description={description}
      footnote={footnote}
      title={title}
    >
      <BarPlot
        config={config}
        data={data}
        height={height}
        horizontal={horizontal}
        series={series}
        showLegend={showLegend}
        stacked={stacked}
        xKey={xKey}
        yLabel={yLabel}
      />
    </StudyChartFrame>
  )
}

function BarPlot({
  config,
  data,
  height,
  horizontal,
  series,
  showLegend,
  stacked,
  xKey,
  yLabel,
}: {
  config: ChartConfig
  data: readonly StudyChartDatum[]
  height: number
  horizontal: boolean
  series: readonly StudyChartSeries[]
  showLegend: boolean
  stacked: boolean
  xKey: string
  yLabel?: string
}) {
  const { shouldAnimate } = useChartMotion()

  return (
    <ChartContainer
      className={styles.chart}
      config={config}
      style={{ height }}
    >
      <BarChart
        accessibilityLayer
        data={chartData(data)}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 12, right: 14, bottom: 8, left: horizontal ? 20 : 4 }}
      >
        <CartesianGrid vertical={!horizontal} horizontal={horizontal} strokeDasharray="3 3" />
        {horizontal ? (
          <>
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis
              dataKey={xKey}
              type="category"
              tickLine={false}
              axisLine={false}
              width={96}
            />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              label={
                yLabel
                  ? { value: yLabel, angle: -90, position: "insideLeft" }
                  : undefined
              }
            />
          </>
        )}
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.55 }}
          content={<ChartTooltipContent />}
        />
        <CommonLegend show={showLegend} />
        {series.map((item, index) => (
          <Bar
            dataKey={item.key}
            fill={`var(--color-${item.key})`}
            isAnimationActive={shouldAnimate}
            key={item.key}
            radius={stacked ? 0 : [5, 5, 0, 0]}
            stackId={stacked ? "total" : undefined}
            animationBegin={index * 60}
            animationDuration={650}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

export function StudyLineChart({
  data,
  xKey,
  series,
  title,
  description,
  footnote,
  height = 320,
  showLegend = series.length > 1,
  yLabel,
  curve = "monotone",
}: CartesianChartProps & {
  curve?: "linear" | "monotone" | "step"
}) {
  const config = createConfig(series)

  return (
    <StudyChartFrame
      ariaLabel={title}
      description={description}
      footnote={footnote}
      title={title}
    >
      <LinePlot
        config={config}
        curve={curve}
        data={data}
        height={height}
        series={series}
        showLegend={showLegend}
        xKey={xKey}
        yLabel={yLabel}
      />
    </StudyChartFrame>
  )
}

function LinePlot({
  config,
  curve,
  data,
  height,
  series,
  showLegend,
  xKey,
  yLabel,
}: {
  config: ChartConfig
  curve: "linear" | "monotone" | "step"
  data: readonly StudyChartDatum[]
  height: number
  series: readonly StudyChartSeries[]
  showLegend: boolean
  xKey: string
  yLabel?: string
}) {
  const { shouldAnimate } = useChartMotion()

  return (
    <ChartContainer className={styles.chart} config={config} style={{ height }}>
      <LineChart
        accessibilityLayer
        data={chartData(data)}
        margin={{ top: 12, right: 14, bottom: 8, left: 4 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          label={
            yLabel
              ? { value: yLabel, angle: -90, position: "insideLeft" }
              : undefined
          }
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <CommonLegend show={showLegend} />
        {series.map((item, index) => (
          <Line
            dataKey={item.key}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            isAnimationActive={shouldAnimate}
            key={item.key}
            stroke={`var(--color-${item.key})`}
            strokeWidth={2}
            type={curve}
            animationBegin={index * 60}
            animationDuration={650}
          />
        ))}
      </LineChart>
    </ChartContainer>
  )
}

export function StudyAreaChart({
  data,
  xKey,
  series,
  title,
  description,
  footnote,
  height = 320,
  showLegend = series.length > 1,
  stacked = false,
  yLabel,
}: CartesianChartProps & {
  stacked?: boolean
}) {
  const config = createConfig(series)

  return (
    <StudyChartFrame
      ariaLabel={title}
      description={description}
      footnote={footnote}
      title={title}
    >
      <AreaPlot
        config={config}
        data={data}
        height={height}
        series={series}
        showLegend={showLegend}
        stacked={stacked}
        xKey={xKey}
        yLabel={yLabel}
      />
    </StudyChartFrame>
  )
}

function AreaPlot({
  config,
  data,
  height,
  series,
  showLegend,
  stacked,
  xKey,
  yLabel,
}: {
  config: ChartConfig
  data: readonly StudyChartDatum[]
  height: number
  series: readonly StudyChartSeries[]
  showLegend: boolean
  stacked: boolean
  xKey: string
  yLabel?: string
}) {
  const { shouldAnimate } = useChartMotion()

  return (
    <ChartContainer className={styles.chart} config={config} style={{ height }}>
      <AreaChart
        accessibilityLayer
        data={chartData(data)}
        margin={{ top: 12, right: 14, bottom: 8, left: 4 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          label={
            yLabel
              ? { value: yLabel, angle: -90, position: "insideLeft" }
              : undefined
          }
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <CommonLegend show={showLegend} />
        {series.map((item, index) => (
          <Area
            dataKey={item.key}
            fill={`var(--color-${item.key})`}
            fillOpacity={0.22}
            isAnimationActive={shouldAnimate}
            key={item.key}
            stackId={stacked ? "total" : undefined}
            stroke={`var(--color-${item.key})`}
            strokeWidth={2}
            type="monotone"
            animationBegin={index * 60}
            animationDuration={650}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  )
}

export function StudyPieChart({
  data,
  nameKey,
  valueKey,
  title,
  description,
  footnote,
  height = 320,
  donut = false,
  showLegend = true,
}: CommonChartProps & {
  data: readonly StudyChartDatum[]
  nameKey: string
  valueKey: string
  donut?: boolean
}) {
  const config = {
    [valueKey]: {
      label: valueKey,
      color: defaultColors[0],
    },
  } satisfies ChartConfig

  return (
    <StudyChartFrame
      ariaLabel={title}
      description={description}
      footnote={footnote}
      title={title}
    >
      <PiePlot
        config={config}
        data={data}
        donut={donut}
        height={height}
        nameKey={nameKey}
        showLegend={showLegend}
        valueKey={valueKey}
      />
    </StudyChartFrame>
  )
}

function PiePlot({
  config,
  data,
  donut,
  height,
  nameKey,
  showLegend,
  valueKey,
}: {
  config: ChartConfig
  data: readonly StudyChartDatum[]
  donut: boolean
  height: number
  nameKey: string
  showLegend: boolean
  valueKey: string
}) {
  const { shouldAnimate } = useChartMotion()

  return (
    <ChartContainer className={styles.chart} config={config} style={{ height }}>
      <PieChart accessibilityLayer>
        <ChartTooltip content={<ChartTooltipContent nameKey={nameKey} />} />
        <CommonLegend show={showLegend} />
        <Pie
          data={chartData(data)}
          dataKey={valueKey}
          innerRadius={donut ? "52%" : 0}
          isAnimationActive={shouldAnimate}
          nameKey={nameKey}
          outerRadius="78%"
          paddingAngle={2}
          stroke="var(--background)"
          strokeWidth={2}
          animationDuration={650}
        >
          {data.map((item, index) => (
            <Cell
              fill={defaultColors[index % defaultColors.length]}
              key={`${String(item[nameKey] ?? "slice")}-${index}`}
            />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}

export function StudyScatterChart({
  data,
  xKey,
  yKey,
  title,
  description,
  footnote,
  height = 320,
  xLabel,
  yLabel,
  label,
}: CommonChartProps & {
  data: readonly StudyChartDatum[]
  xKey: string
  yKey: string
  xLabel?: string
  yLabel?: string
  label?: string
}) {
  const config = {
    [yKey]: {
      label: label ?? yKey,
      color: defaultColors[0],
    },
  } satisfies ChartConfig

  return (
    <StudyChartFrame
      ariaLabel={title}
      description={description}
      footnote={footnote}
      title={title}
    >
      <ScatterPlot
        config={config}
        data={data}
        height={height}
        label={label ?? yKey}
        xKey={xKey}
        xLabel={xLabel}
        yKey={yKey}
        yLabel={yLabel}
      />
    </StudyChartFrame>
  )
}

function ScatterPlot({
  config,
  data,
  height,
  label,
  xKey,
  xLabel,
  yKey,
  yLabel,
}: {
  config: ChartConfig
  data: readonly StudyChartDatum[]
  height: number
  label: string
  xKey: string
  xLabel?: string
  yKey: string
  yLabel?: string
}) {
  const { shouldAnimate } = useChartMotion()

  return (
    <ChartContainer className={styles.chart} config={config} style={{ height }}>
      <ScatterChart
        accessibilityLayer
        margin={{ top: 12, right: 14, bottom: xLabel ? 26 : 8, left: yLabel ? 22 : 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey={xKey}
          name={xLabel ?? xKey}
          type="number"
          tickLine={false}
          axisLine={false}
          label={xLabel ? { value: xLabel, position: "bottom", offset: 8 } : undefined}
        />
        <YAxis
          dataKey={yKey}
          name={yLabel ?? yKey}
          type="number"
          tickLine={false}
          axisLine={false}
          label={
            yLabel
              ? { value: yLabel, angle: -90, position: "insideLeft" }
              : undefined
          }
        />
        <ChartTooltip
          cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
          content={<ChartTooltipContent />}
        />
        <Scatter
          data={chartData(data)}
          fill={`var(--color-${yKey})`}
          isAnimationActive={shouldAnimate}
          name={label}
          animationDuration={650}
        />
      </ScatterChart>
    </ChartContainer>
  )
}

export function StudyHistogram({
  values,
  bins = 10,
  title,
  description,
  footnote,
  height = 320,
}: CommonChartProps & {
  values: readonly number[]
  bins?: number
}) {
  const data: StudyChartDatum[] = buildHistogramBins(values, bins).map((bin) => ({ ...bin }))

  return (
    <StudyBarChart
      data={data}
      description={description}
      footnote={footnote}
      height={height}
      series={[{ key: "count", label: "Frequency" }]}
      showLegend={false}
      title={title}
      xKey="label"
      yLabel="Frequency"
    />
  )
}
