"use client"

import type { ReactNode } from "react"
import type { TooltipPayload, TooltipPayloadEntry } from "recharts"

import { useChart } from "@/components/ui/chart"

import { formatValue, type Formatter } from "../core/format"
import { cssKey } from "../core/series"

import styles from "./chart-figure.module.css"

export type ChartTooltipPanelProps = {
  active?: boolean
  payload?: TooltipPayload
  label?: ReactNode
  /** Formats each value; receives the raw value and the payload entry. */
  formatter?: Formatter
  labelFormatter?: (label: unknown, payload: TooltipPayload) => ReactNode
  /** Row field to use as the header instead of the category label. */
  labelKey?: string
  /** Row field holding the item name (pie / funnel / treemap). */
  nameKey?: string
  hideLabel?: boolean
  /** Adds a total row for stacked charts. */
  showTotal?: boolean
  totalLabel?: string
}

/**
 * The shared hover card: ink surface, muted header, one row per visible
 * series with a colour key, values right-aligned in tabular figures.
 */
export function ChartTooltipPanel({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
  labelKey,
  nameKey,
  hideLabel,
  showTotal,
  totalLabel = "合计",
}: ChartTooltipPanelProps) {
  const { config } = useChart()
  if (!active || !payload?.length) return null

  const rows = payload.filter((item) => item.value !== undefined && item.value !== null && item.type !== "none")
  const first = rows[0]?.payload as Record<string, unknown> | undefined
  const rawLabel = labelKey && first ? first[labelKey] : label
  const header = labelFormatter ? labelFormatter(rawLabel, payload) : (rawLabel as ReactNode)
  const format = (value: unknown) => (formatter ? formatValue(value, formatter) : String(value ?? "–"))
  const total = showTotal
    ? rows.reduce((sum, item) => sum + (typeof item.value === "number" ? item.value : 0), 0)
    : undefined

  return (
    <div className={styles.tooltip} role="status">
      {!hideLabel && header !== undefined && header !== "" ? <div className={styles.tooltipLabel}>{header}</div> : null}
      <div className={styles.tooltipRows}>
        {rows.map((item, index) => (
          <TooltipRow config={config} format={format} index={index} item={item} key={`${String(item.dataKey)}-${index}`} nameKey={nameKey} />
        ))}
        {total !== undefined && rows.length > 1 ? (
          <div className={`${styles.tooltipRow} ${styles.tooltipTotal}`}>
            <span className={styles.tooltipName}>{totalLabel}</span>
            <span className={styles.tooltipValue}>{format(total)}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function TooltipRow({
  item,
  index,
  config,
  format,
  nameKey,
}: {
  item: TooltipPayloadEntry
  index: number
  config: ReturnType<typeof useChart>["config"]
  format: (value: unknown) => string
  nameKey?: string
}) {
  const dataKey = typeof item.dataKey === "string" ? item.dataKey : undefined
  const row = item.payload as Record<string, unknown> | undefined
  const configured = dataKey ? config[cssKey(dataKey)] : undefined
  const name = (nameKey && row ? row[nameKey] : undefined) ?? configured?.label ?? item.name ?? dataKey ?? `#${index + 1}`
  const rowColor = typeof row?.color === "string" ? row.color : typeof row?.fill === "string" ? row.fill : undefined
  const color = rowColor ?? item.color ?? "currentColor"

  return (
    <div className={styles.tooltipRow}>
      <span aria-hidden="true" className={styles.tooltipKey} style={{ background: color }} />
      <span className={styles.tooltipName}>{name as ReactNode}</span>
      <span className={styles.tooltipValue}>{format(item.value)}</span>
    </div>
  )
}

/** Recharts tooltip motion: follow the pointer immediately, never tween. */
export const tooltipMotionProps = {
  animationDuration: 0,
  isAnimationActive: false,
} as const
