"use client"

import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts"

import type { ChartConfig } from "@/components/ui/chart"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"

import { createFormatter, toNumber } from "../core/format"
import { resolveColor } from "../core/series"
import type { ChartColor, ChartDatum, ValueFormat } from "../core/types"
import { ChartFigure } from "../primitives/chart-figure"
import { useChartMotion } from "../primitives/chart-motion"
import { ChartTooltipPanel, tooltipMotionProps } from "../primitives/chart-tooltip"
import { chartStyles, figureProps, type BaseChartProps } from "./shared"

export type RadialItem = { label: string; value: number; max?: number; color?: ChartColor }

export type StudyRadialChartProps = BaseChartProps & {
  /** Progress rings, outermost first. */
  items?: readonly RadialItem[]
  /** Row form alternative. */
  data?: readonly ChartDatum[]
  nameKey?: string
  valueKey?: string
  /** Shared maximum for all rings (default 100). */
  max?: number
  format?: ValueFormat
  /** Big number in the centre (single ring) – defaults to the first value. */
  centerLabel?: string
  centerCaption?: string
  /** Half ring (gauge) instead of a full circle. */
  semicircle?: boolean
}

export function normalizeRadialItems(props: Pick<StudyRadialChartProps, "items" | "data" | "nameKey" | "valueKey" | "max">) {
  const source: RadialItem[] = props.items
    ? [...props.items]
    : (props.data ?? []).map((row) => ({
        label: String(row[props.nameKey ?? "label"] ?? ""),
        value: toNumber(row[props.valueKey ?? "value"]) ?? 0,
      }))
  return source.map((item, index) => {
    const max = item.max ?? props.max ?? 100
    return {
      key: `ring-${index}`,
      label: item.label,
      value: item.value,
      max,
      ratio: max > 0 ? Math.max(0, Math.min(1, item.value / max)) : 0,
      fill: resolveColor(item.color, index),
    }
  })
}

/** Progress / completion rings. One ring reads as a KPI with a centre figure. */
export function StudyRadialChart(props: StudyRadialChartProps) {
  const rings = normalizeRadialItems(props)
  const formatter = createFormatter(props.format ?? "percent", props.locale)
  const ratio = createFormatter({ preset: "ratio", digits: 0 }, props.locale)

  return (
    <ChartFigure
      {...figureProps(props, {
        empty: rings.length === 0,
        legend:
          props.showLegend === false || rings.length < 2
            ? undefined
            : rings.map((ring) => ({ key: ring.key, label: ring.label, color: ring.fill })),
        legendAlign: "start",
        table: {
          columns: [
            { key: "label", label: "项目" },
            { key: "value", label: "当前", numeric: true, formatter },
            { key: "max", label: "目标", numeric: true, formatter },
            { key: "ratio", label: "完成度", numeric: true, formatter: ratio },
          ],
          rows: rings.map(({ label, value, max, ratio: progress }) => ({ label, value, max, ratio: progress })),
        },
      })}
    >
      <RadialPlot {...props} formatter={formatter} rings={rings} />
    </ChartFigure>
  )
}

function RadialPlot({
  height = 280,
  semicircle = false,
  centerLabel,
  centerCaption,
  rings,
  formatter,
}: StudyRadialChartProps & { rings: ReturnType<typeof normalizeRadialItems>; formatter: (value: number) => string }) {
  const { shouldAnimate } = useChartMotion()
  const config: ChartConfig = Object.fromEntries(rings.map((ring) => [ring.key, { label: ring.label, color: ring.fill }]))
  const single = rings.length === 1 ? rings[0] : undefined
  const thickness = Math.max(10, Math.min(22, 72 / Math.max(1, rings.length)))
  const data = rings.map((ring) => ({ name: ring.label, ratio: ring.ratio, value: ring.value, fill: ring.fill, color: ring.fill }))

  return (
    <ChartContainer className={chartStyles.chartBox} config={config} style={{ height }}>
      <RadialBarChart
        accessibilityLayer
        barSize={thickness}
        cy={semicircle ? "72%" : "50%"}
        data={data}
        endAngle={semicircle ? 0 : -270}
        innerRadius={single ? "68%" : "30%"}
        outerRadius="96%"
        startAngle={semicircle ? 180 : 90}
      >
        <PolarAngleAxis angleAxisId={0} domain={[0, 1]} tick={false} type="number" />
        <ChartTooltip
          {...tooltipMotionProps}
          content={<ChartTooltipPanel formatter={createFormatter({ preset: "ratio", digits: 0 })} hideLabel nameKey="name" />}
          cursor={false}
        />
        <RadialBar
          animationDuration={900}
          background={{ fill: "var(--chart-cursor)" }}
          cornerRadius={thickness / 2}
          dataKey="ratio"
          isAnimationActive={shouldAnimate}
        />
        {single ? (
          <text textAnchor="middle" x="50%" y={semicircle ? "66%" : "50%"}>
            <tspan className={chartStyles.centerValue} dy={centerCaption === "" ? "0.35em" : "-0.1em"} x="50%">
              {centerLabel ?? formatter(single.value)}
            </tspan>
            {centerCaption !== "" ? (
              <tspan className={chartStyles.centerCaption} dy="1.6em" x="50%">
                {centerCaption ?? single.label}
              </tspan>
            ) : null}
          </text>
        ) : null}
      </RadialBarChart>
    </ChartContainer>
  )
}
