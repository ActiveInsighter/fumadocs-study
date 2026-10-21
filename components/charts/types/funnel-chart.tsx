"use client"

import { Funnel, FunnelChart, LabelList } from "recharts"

import type { ChartConfig } from "@/components/ui/chart"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"

import { createFormatter, toNumber } from "../core/format"
import type { ChartDatum, ValueFormat } from "../core/types"
import { ChartFigure } from "../primitives/chart-figure"
import { useChartMotion } from "../primitives/chart-motion"
import { ChartTooltipPanel, tooltipMotionProps } from "../primitives/chart-tooltip"
import { chartStyles, figureProps, type BaseChartProps } from "./shared"

export type StudyFunnelChartProps = BaseChartProps & {
  /** Ordered stages, widest first. */
  data: readonly ChartDatum[]
  nameKey?: string
  valueKey?: string
  format?: ValueFormat
}

/** Ordinal ramp: darkest first stage, lighter as the funnel narrows. */
const ORDINAL = ["var(--chart-seq-6)", "var(--chart-seq-5)", "var(--chart-seq-4)", "var(--chart-seq-3)", "var(--chart-seq-2)"]

export function funnelStages(data: readonly ChartDatum[], nameKey = "name", valueKey = "value") {
  const stages = data.map((row) => ({ name: String(row[nameKey] ?? ""), value: toNumber(row[valueKey]) ?? 0 }))
  const first = stages[0]?.value ?? 0
  return stages.map((stage, index) => {
    const previous = index > 0 ? stages[index - 1]!.value : stage.value
    const fill = ORDINAL[Math.min(ORDINAL.length - 1, Math.round((index / Math.max(1, stages.length - 1)) * (ORDINAL.length - 1)))]!
    return {
      ...stage,
      fill,
      color: fill,
      ofFirst: first > 0 ? stage.value / first : 0,
      ofPrevious: previous > 0 ? stage.value / previous : 0,
    }
  })
}

/** Stage-by-stage conversion. Each stage shows its share of the first stage. */
export function StudyFunnelChart(props: StudyFunnelChartProps) {
  const { data, nameKey = "name", valueKey = "value", format, locale } = props
  const stages = funnelStages(data, nameKey, valueKey)
  const formatter = createFormatter(format ?? "integer", locale)
  const ratio = createFormatter({ preset: "ratio", digits: 1 }, locale)

  return (
    <ChartFigure
      {...figureProps(props, {
        empty: stages.every((stage) => stage.value <= 0),
        table: {
          columns: [
            { key: "name", label: nameKey },
            { key: "value", label: valueKey, numeric: true, formatter },
            { key: "ofPrevious", label: "环节转化", numeric: true, formatter: ratio },
            { key: "ofFirst", label: "整体转化", numeric: true, formatter: ratio },
          ],
          rows: stages,
        },
      })}
    >
      <FunnelPlot formatter={formatter} height={props.height} ratio={ratio} stages={stages} />
    </ChartFigure>
  )
}

function FunnelPlot({
  stages,
  formatter,
  ratio,
  height = 320,
}: {
  stages: ReturnType<typeof funnelStages>
  formatter: (value: number) => string
  ratio: (value: number) => string
  height?: number
}) {
  const { shouldAnimate } = useChartMotion()
  const config: ChartConfig = { value: { label: "数量" } }
  const rows = stages.map((stage) => ({ ...stage, caption: `${stage.name} · ${ratio(stage.ofFirst)}` }))

  return (
    <ChartContainer className={chartStyles.chartBox} config={config} style={{ height }}>
      <FunnelChart accessibilityLayer margin={{ top: 8, right: 150, bottom: 8, left: 8 }}>
        <ChartTooltip {...tooltipMotionProps} content={<ChartTooltipPanel formatter={formatter} hideLabel nameKey="name" />} />
        <Funnel animationDuration={800} data={rows} dataKey="value" isAnimationActive={shouldAnimate} lastShapeType="rectangle" nameKey="name" stroke="var(--chart-panel)" strokeWidth={2}>
          <LabelList className={chartStyles.funnelValue} dataKey="value" formatter={(value: unknown) => (typeof value === "number" ? formatter(value) : "")} position="center" />
          <LabelList className={chartStyles.funnelCaption} dataKey="caption" offset={14} position="right" />
        </Funnel>
      </FunnelChart>
    </ChartContainer>
  )
}
