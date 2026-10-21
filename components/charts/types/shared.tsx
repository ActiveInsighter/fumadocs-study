"use client"

import type { ReactNode } from "react"

import { createFormatter, type Formatter } from "../core/format"
import type { ChartDatum, ChartTheme, ResolvedSeries, ValueFormat } from "../core/types"
import type { ChartTableData } from "../primitives/chart-data-table"
import type { ChartFigureProps } from "../primitives/chart-figure"
import type { ChartExportFormat } from "../primitives/chart-toolbar"

import styles from "../primitives/chart-figure.module.css"

/** Props every Study chart accepts, regardless of type. */
export type BaseChartProps = {
  title: string
  subtitle?: ReactNode
  /** @deprecated use `subtitle`. */
  description?: ReactNode
  footnote?: ReactNode
  /** One-sentence takeaway for screen readers. */
  summary?: string
  theme?: ChartTheme
  /** Plot height in px. */
  height?: number
  showLegend?: boolean
  /** Allow hiding series from the legend. Default true. */
  toggleable?: boolean
  /** Download formats, or false to hide the download menu. */
  exportable?: boolean | readonly ChartExportFormat[]
  /** Show the table-view toggle. Default true. */
  tableToggle?: boolean
  emptyMessage?: string
  locale?: string
  id?: string
  className?: string
}

export type ReferenceLineSpec = {
  /** Value on the value axis (horizontal line), or category / x value with `axis: "x"`. */
  value: number | string
  axis?: "x" | "y"
  label?: string
}

export type CartesianChartProps = BaseChartProps & {
  data: readonly ChartDatum[]
  xKey: string
  xLabel?: string
  yLabel?: string
  /** Formats the value axis, tooltips and table. */
  format?: ValueFormat
  /** @deprecated alias of `format`. */
  yFormat?: ValueFormat
  yDomain?: readonly [number | "auto", number | "auto"]
  referenceLines?: readonly ReferenceLineSpec[]
}

export function figureProps(
  props: BaseChartProps,
  extra: Partial<ChartFigureProps> = {},
): Omit<ChartFigureProps, "children"> {
  const formats = props.exportable === false ? false : Array.isArray(props.exportable) ? props.exportable : undefined
  return {
    title: props.title,
    subtitle: props.subtitle,
    description: props.description,
    footnote: props.footnote,
    summary: props.summary,
    theme: props.theme,
    emptyMessage: props.emptyMessage,
    plotHeight: props.height,
    hideTableToggle: props.tableToggle === false,
    exportFormats: formats ?? undefined,
    id: props.id,
    className: props.className,
    ...extra,
  }
}

export function valueFormatters(format: ValueFormat | undefined, locale?: string): { value: Formatter; tick: Formatter } {
  return { value: createFormatter(format, locale), tick: createFormatter(tickFormat(format), locale) }
}

function tickFormat(format: ValueFormat | undefined): ValueFormat | undefined {
  if (!format) return undefined
  if (typeof format === "string") return { preset: format, digits: format === "ratio" || format === "percent" ? 0 : 2 }
  return { ...format, digits: Math.min(format.digits ?? 2, 2) }
}

export function seriesTable(
  data: readonly ChartDatum[],
  xKey: string,
  xLabel: string | undefined,
  series: readonly ResolvedSeries[],
  formatter: Formatter,
): ChartTableData {
  return {
    columns: [
      { key: xKey, label: xLabel ?? xKey },
      ...series.map((item) => ({ key: item.key, label: item.label, numeric: true, formatter })),
    ],
    rows: data,
  }
}

/** Width for a value axis so the longest formatted tick never clips. */
export function axisWidth(labels: readonly string[], fontSize = 12): number {
  const longest = labels.reduce((max, label) => Math.max(max, label.length), 1)
  return Math.min(96, Math.max(32, Math.round(longest * fontSize * 0.62) + 12))
}

export const quietAxis = {
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
} as const

/** Value axes snap ticks to 1-2-5 multiples (0, 5, 10… not 0, 7, 14…). */
export const valueAxis = {
  ...quietAxis,
  niceTicks: "snap125",
} as const

export function axisTitle(value: string | undefined, position: "insideLeft" | "insideBottom" | "bottom" | "left", offset = 0) {
  if (!value) return undefined
  return position === "insideLeft" || position === "left"
    ? { value, angle: -90, position, offset, className: styles.axisLabel, style: { textAnchor: "middle" as const } }
    : { value, position, offset, className: styles.axisLabel }
}

export function resolveDomain(domain: CartesianChartProps["yDomain"]): [number | "auto", number | "auto"] | undefined {
  return domain ? [domain[0], domain[1]] : undefined
}

export const chartStyles = styles
