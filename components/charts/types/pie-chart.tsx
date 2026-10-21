"use client"

import { useMemo, useState } from "react"
import { Cell, Pie, PieChart } from "recharts"

import type { ChartConfig } from "@/components/ui/chart"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"

import { createFormatter, toNumber } from "../core/format"
import { resolveColor, toggleHidden } from "../core/series"
import type { ChartColor, ChartDatum } from "../core/types"
import { ChartFigure } from "../primitives/chart-figure"
import { useChartMotion } from "../primitives/chart-motion"
import { ChartTooltipPanel, tooltipMotionProps } from "../primitives/chart-tooltip"
import { chartStyles, figureProps, valueFormatters, type BaseChartProps } from "./shared"
import type { ValueFormat } from "../core/types"

export type StudyPieChartProps = BaseChartProps & {
  data: readonly ChartDatum[]
  nameKey: string
  valueKey: string
  donut?: boolean
  /** Text in the donut hole; defaults to the formatted total. */
  centerLabel?: string
  centerCaption?: string
  format?: ValueFormat
  /** Category → colour token or CSS colour. */
  colors?: Record<string, ChartColor>
  /** Categories beyond this fold into "其他" (Other). Default 6. */
  maxSlices?: number
  /** Percentage labels outside each slice. */
  showPercent?: boolean
}

type Slice = { name: string; value: number; color: string; key: string }

/** Largest slices first; the tail folds into a single neutral "Other" slice. */
export function foldSlices(
  data: readonly ChartDatum[],
  nameKey: string,
  valueKey: string,
  maxSlices: number,
  colors?: Record<string, ChartColor>,
  otherLabel = "其他",
): Slice[] {
  const slices = data
    .map((row, index) => ({ name: String(row[nameKey] ?? `#${index + 1}`), value: toNumber(row[valueKey]) ?? 0, index }))
    .filter((slice) => slice.value > 0)

  const ordered = slices.length > maxSlices ? [...slices].sort((a, b) => b.value - a.value) : slices
  const head = ordered.slice(0, slices.length > maxSlices ? maxSlices - 1 : maxSlices)
  const tail = ordered.slice(head.length)

  const result: Slice[] = head.map((slice, index) => ({
    name: slice.name,
    value: slice.value,
    key: `slice-${index}`,
    color: resolveColor(colors?.[slice.name], index),
  }))
  if (tail.length > 0) {
    result.push({
      name: otherLabel,
      value: tail.reduce((sum, slice) => sum + slice.value, 0),
      key: "slice-other",
      color: "var(--chart-other)",
    })
  }
  return result
}

export function StudyPieChart(props: StudyPieChartProps) {
  const { data, nameKey, valueKey, format, locale, colors, maxSlices = 6, showLegend } = props
  const slices = useMemo(() => foldSlices(data, nameKey, valueKey, maxSlices, colors), [data, nameKey, valueKey, maxSlices, colors])
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const formatters = valueFormatters(format, locale)
  const keys = slices.map((slice) => slice.key)

  return (
    <ChartFigure
      {...figureProps(props, {
        empty: slices.length === 0,
        legend:
          showLegend === false
            ? undefined
            : slices.map((slice) => ({ key: slice.key, label: slice.name, color: slice.color, hidden: hidden.has(slice.key) })),
        onLegendToggle: props.toggleable === false ? undefined : (key) => setHidden((current) => toggleHidden(current, key, keys)),
        legendAlign: "start",
        table: {
          columns: [
            { key: "name", label: nameKey },
            { key: "value", label: valueKey, numeric: true, formatter: formatters.value },
            { key: "share", label: "占比", numeric: true, formatter: createFormatter({ preset: "ratio", digits: 1 }, locale) },
          ],
          rows: withShares(slices),
        },
      })}
    >
      <PiePlot {...props} formatters={formatters} hidden={hidden} slices={slices} />
    </ChartFigure>
  )
}

function withShares(slices: readonly Slice[]): ChartDatum[] {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1
  return slices.map((slice) => ({ name: slice.name, value: slice.value, share: slice.value / total }))
}

function PiePlot({
  height = 300,
  donut = false,
  centerLabel,
  centerCaption,
  showPercent = false,
  locale,
  slices,
  hidden,
  formatters,
}: StudyPieChartProps & { slices: Slice[]; hidden: Set<string>; formatters: ReturnType<typeof valueFormatters> }) {
  const { shouldAnimate } = useChartMotion()
  const visible = slices.filter((slice) => !hidden.has(slice.key))
  const total = visible.reduce((sum, slice) => sum + slice.value, 0)
  const percent = createFormatter({ preset: "ratio", digits: 0 }, locale)
  const config: ChartConfig = Object.fromEntries(slices.map((slice) => [slice.key, { label: slice.name, color: slice.color }]))

  return (
    <ChartContainer className={chartStyles.chartBox} config={config} style={{ height }}>
      <PieChart accessibilityLayer margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <ChartTooltip {...tooltipMotionProps} content={<ChartTooltipPanel formatter={formatters.value} hideLabel nameKey="name" />} />
        <Pie
          animationDuration={800}
          animationEasing="ease-out"
          cornerRadius={donut ? 4 : 2}
          data={visible}
          dataKey="value"
          innerRadius={donut ? "60%" : 0}
          isAnimationActive={shouldAnimate}
          label={
            showPercent
              ? ({ value }: { value?: number }) => (typeof value === "number" && total > 0 ? percent(value / total) : "")
              : false
          }
          labelLine={showPercent ? { stroke: "var(--chart-axis)" } : false}
          nameKey="name"
          outerRadius={showPercent ? "72%" : "86%"}
          paddingAngle={visible.length > 1 ? 1.5 : 0}
          stroke="var(--chart-panel)"
          strokeWidth={2}
        >
          {visible.map((slice) => (
            <Cell fill={slice.color} key={slice.key} />
          ))}
        </Pie>
        {donut ? (
          <text textAnchor="middle" x="50%" y="50%">
            <tspan className={chartStyles.centerValue} dy={centerCaption === "" ? "0.35em" : "-0.15em"} x="50%">
              {centerLabel ?? formatters.value(total)}
            </tspan>
            {centerCaption !== "" ? (
              <tspan className={chartStyles.centerCaption} dy="1.55em" x="50%">
                {centerCaption ?? "合计"}
              </tspan>
            ) : null}
          </text>
        ) : null}
      </PieChart>
    </ChartContainer>
  )
}
