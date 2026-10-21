"use client"

import { useMemo } from "react"
import { Treemap } from "recharts"

import type { ChartConfig } from "@/components/ui/chart"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"

import { createFormatter, toNumber, type Formatter } from "../core/format"
import { estimateTextWidth } from "../core/labels"
import { resolveColor } from "../core/series"
import type { ChartColor, ChartDatum, ValueFormat } from "../core/types"
import { ChartFigure } from "../primitives/chart-figure"
import { useChartMotion } from "../primitives/chart-motion"
import { ChartTooltipPanel, tooltipMotionProps } from "../primitives/chart-tooltip"
import { chartStyles, figureProps, type BaseChartProps } from "./shared"

export type StudyTreemapProps = BaseChartProps & {
  /** Flat rows; nest them with `groupKey`. */
  data: readonly ChartDatum[]
  nameKey?: string
  valueKey?: string
  groupKey?: string
  format?: ValueFormat
  /** Category colours per group (default) or a one-hue ramp by value. */
  colorBy?: "group" | "value"
  colors?: Record<string, ChartColor>
}

type Leaf = { name: string; value: number; group: string; fill: string; color: string }
type GroupNode = { name: string; children: Leaf[]; fill: string }

const SEQUENTIAL = ["var(--chart-seq-2)", "var(--chart-seq-3)", "var(--chart-seq-4)", "var(--chart-seq-5)", "var(--chart-seq-6)"]

export function buildTreemap(
  data: readonly ChartDatum[],
  { nameKey = "name", valueKey = "value", groupKey, colorBy = "group", colors }: Pick<StudyTreemapProps, "nameKey" | "valueKey" | "groupKey" | "colorBy" | "colors">,
): { nodes: (GroupNode | Leaf)[]; leaves: Leaf[]; groups: { name: string; color: string }[] } {
  const rows = data
    .map((row) => ({ name: String(row[nameKey] ?? ""), value: toNumber(row[valueKey]) ?? 0, group: groupKey ? String(row[groupKey] ?? "其他") : "" }))
    .filter((row) => row.value > 0)

  const groupNames = [...new Set(rows.map((row) => row.group))]
  const groupColor = new Map(groupNames.map((name, index) => [name, resolveColor(colors?.[name], index)]))
  const values = rows.map((row) => row.value).sort((a, b) => a - b)
  const quantile = (value: number) => {
    const rank = values.findIndex((candidate) => candidate >= value)
    return SEQUENTIAL[Math.min(SEQUENTIAL.length - 1, Math.floor((rank / Math.max(1, values.length)) * SEQUENTIAL.length))]!
  }

  const leaves: Leaf[] = rows.map((row, index) => {
    const fill =
      colorBy === "value"
        ? quantile(row.value)
        : groupKey
          ? groupColor.get(row.group)!
          : resolveColor(colors?.[row.name], index)
    return { ...row, fill, color: fill }
  })

  if (!groupKey) return { nodes: leaves, leaves, groups: [] }
  const nodes: GroupNode[] = groupNames.map((name) => ({
    name,
    fill: groupColor.get(name)!,
    children: leaves.filter((leaf) => leaf.group === name),
  }))
  return { nodes, leaves, groups: groupNames.map((name) => ({ name, color: groupColor.get(name)! })) }
}

/** Part-to-whole for many categories, optionally grouped one level deep. */
export function StudyTreemap(props: StudyTreemapProps) {
  const { data, nameKey = "name", valueKey = "value", groupKey, colorBy, colors, format, locale } = props
  const model = useMemo(() => buildTreemap(data, { nameKey, valueKey, groupKey, colorBy, colors }), [data, nameKey, valueKey, groupKey, colorBy, colors])
  const formatter = createFormatter(format, locale)

  return (
    <ChartFigure
      {...figureProps(props, {
        empty: model.leaves.length === 0,
        legend: props.showLegend === false || colorBy === "value" ? undefined : model.groups.map((group) => ({ key: group.name, label: group.name, color: group.color, mark: "square" as const })),
        legendAlign: "start",
        table: {
          columns: [
            ...(groupKey ? [{ key: "group", label: groupKey }] : []),
            { key: "name", label: nameKey },
            { key: "value", label: valueKey, numeric: true, formatter },
          ],
          rows: model.leaves,
        },
      })}
    >
      <TreemapPlot formatter={formatter} height={props.height} nodes={model.nodes} />
    </ChartFigure>
  )
}

function TreemapPlot({ nodes, formatter, height = 340 }: { nodes: (GroupNode | Leaf)[]; formatter: Formatter; height?: number }) {
  const { shouldAnimate } = useChartMotion()
  const config: ChartConfig = { value: { label: "数值" } }

  return (
    <ChartContainer className={chartStyles.chartBox} config={config} style={{ height }}>
      <Treemap
        animationDuration={700}
        aspectRatio={4 / 3}
        content={<TreemapCell formatter={formatter} />}
        data={nodes as unknown as Record<string, unknown>[]}
        dataKey="value"
        isAnimationActive={shouldAnimate}
        nameKey="name"
      >
        <ChartTooltip {...tooltipMotionProps} content={<ChartTooltipPanel formatter={formatter} hideLabel nameKey="name" />} />
      </Treemap>
    </ChartContainer>
  )
}

type CellProps = {
  x?: number
  y?: number
  width?: number
  height?: number
  depth?: number
  name?: string
  value?: number
  fill?: string
  children?: unknown
  formatter: Formatter
}

function TreemapCell({ x = 0, y = 0, width = 0, height = 0, depth, name = "", value, fill, children, formatter }: CellProps) {
  const isGroup = Array.isArray(children) && children.length > 0
  if (isGroup || depth === 0) {
    return depth === 0 ? null : <rect className={chartStyles.treemapGroup} height={height} width={width} x={x} y={y} />
  }
  const valueText = typeof value === "number" ? formatter(value) : ""
  const fitsName = width - 16 > estimateTextWidth(name, 12.5) && height > 26
  const fitsValue = fitsName && height > 44 && width - 16 > estimateTextWidth(valueText, 12)

  return (
    <g>
      <rect className={chartStyles.treemapCell} fill={fill} height={Math.max(0, height)} rx={3} width={Math.max(0, width)} x={x} y={y} />
      {fitsName ? (
        <text className={chartStyles.treemapLabel} x={x + 8} y={y + 18}>
          {name}
        </text>
      ) : null}
      {fitsValue ? (
        <text className={chartStyles.treemapValue} x={x + 8} y={y + 35}>
          {valueText}
        </text>
      ) : null}
    </g>
  )
}
