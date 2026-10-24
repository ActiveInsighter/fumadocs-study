"use client"

import { useMemo, useState, type Key } from "react"
import { cn } from "@/lib/utils"
import { Cell, Pie, PieChart, Sector, type PieSectorShapeProps } from "recharts"

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
  /**
   * "inline" draws the bare plot for another surface (a card, a modal):
   * no frame or toolbar, no tooltip, slices separated by gaps instead of a
   * panel-coloured stroke. Pair it with a legend of your own.
   */
  variant?: "figure" | "inline"
  /** Controlled highlight: figure slices expand; inline slices only fade, without changing geometry. */
  activeName?: string | null
  /** Hovering a slice reports its name, and null on leaving. */
  onActiveNameChange?: (name: string | null) => void
  onSliceClick?: (name: string) => void
  /** Hole size of a donut, as a share of the outer radius. Default "62%", inline "74%". */
  innerRadius?: string
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
  const { data, nameKey, valueKey, format, locale, colors, maxSlices = 6, showLegend, variant = "figure" } = props
  const slices = useMemo(() => foldSlices(data, nameKey, valueKey, maxSlices, colors), [data, nameKey, valueKey, maxSlices, colors])
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const formatters = useMemo(() => valueFormatters(format, locale), [format, locale])
  const keys = slices.map((slice) => slice.key)

  return (
    <ChartFigure
      {...figureProps(props, {
        variant,
        empty: slices.length === 0,
        legend:
          showLegend === false || (variant === "inline" && showLegend !== true)
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
  variant = "figure",
  activeName = null,
  onActiveNameChange,
  onSliceClick,
  innerRadius,
  locale,
  slices,
  hidden,
  formatters,
}: StudyPieChartProps & { slices: Slice[]; hidden: Set<string>; formatters: ReturnType<typeof valueFormatters> }) {
  const { shouldAnimate } = useChartMotion()
  const inline = variant === "inline"
  const visible = useMemo(() => slices.filter((slice) => !hidden.has(slice.key)), [slices, hidden])
  const total = visible.reduce((sum, slice) => sum + slice.value, 0)
  const percent = createFormatter({ preset: "ratio", digits: 0 }, locale)
  const config = useMemo<ChartConfig>(() => Object.fromEntries(slices.map((slice) => [slice.key, { label: slice.name, color: slice.color }])), [slices])
  // Inline donuts leave room for the highlighted slice to grow outwards.
  const margin = inline ? 7 : 8
  const nameAt = (index: number) => visible[index]?.name ?? null
  const renderSlice = (props: PieSectorShapeProps, index?: string | number) => {
    const name = nameAt(Number(index))
    const active = activeName != null && name === activeName
    // Recharts hands the key inside the props; React wants it passed on its own.
    const { key, ...sector } = props as PieSectorShapeProps & { key?: Key }
    return (
      <Sector
        key={key}
        {...sector}
        fillOpacity={activeName != null && !active ? 0.5 : 1}
        innerRadius={active && !inline ? sector.innerRadius - 1 : sector.innerRadius}
        outerRadius={active && !inline ? sector.outerRadius + 6 : sector.outerRadius}
      />
    )
  }

  return (
    <ChartContainer className={chartStyles.chartBox} config={config} style={{ height }}>
      <PieChart accessibilityLayer margin={{ top: margin, right: margin, bottom: margin, left: margin }}>
        {inline ? null : (
          <ChartTooltip {...tooltipMotionProps} content={<ChartTooltipPanel formatter={formatters.value} hideLabel nameKey="name" />} />
        )}
        <Pie
          animationDuration={800}
          animationEasing="ease-out"
          cornerRadius={donut ? (inline ? 8 : 5) : 2}
          data={visible}
          dataKey="value"
          endAngle={-270}
          innerRadius={donut ? innerRadius ?? (inline ? "74%" : "62%") : 0}
          isAnimationActive={inline ? false : shouldAnimate}
          label={
            showPercent
              ? ({ value }: { value?: number }) => (typeof value === "number" && total > 0 ? percent(value / total) : "")
              : false
          }
          labelLine={showPercent ? { stroke: "var(--chart-axis)" } : false}
          nameKey="name"
          onClick={onSliceClick ? (_: unknown, index: number) => { const name = nameAt(index); if (name) onSliceClick(name) } : undefined}
          onMouseEnter={onActiveNameChange ? (_: unknown, index: number) => onActiveNameChange(nameAt(index)) : undefined}
          onMouseLeave={onActiveNameChange ? () => onActiveNameChange(null) : undefined}
          outerRadius={showPercent ? "72%" : inline ? "100%" : "86%"}
          paddingAngle={visible.length > 1 ? (inline ? 5 : 2) : 0}
          shape={renderSlice}
          startAngle={90}
          stroke={inline ? "none" : "var(--chart-panel)"}
          strokeWidth={inline ? 0 : 2}
        >
          {visible.map((slice) => (
            <Cell
              className={cn(chartStyles.slice, onSliceClick && chartStyles.sliceInteractive)}
              fill={slice.color}
              key={slice.key}
            />
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
