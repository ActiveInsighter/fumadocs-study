"use client"

import { useId } from "react"

import { cn } from "@/lib/utils"

import { cssKey } from "../core/series"
import type { ChartPattern } from "../core/types"
import { PatternDef } from "./chart-patterns"

import styles from "./chart-figure.module.css"

export type LegendMark = "dot" | "line" | "square"

export type ChartLegendItem = {
  key: string
  label: string
  qualifier?: string
  color: string
  pattern?: ChartPattern
  hidden?: boolean
  dashed?: boolean
  mark?: LegendMark
}

export type ChartLegendProps = {
  items: readonly ChartLegendItem[]
  /** When provided, items become toggle buttons that hide / show a series. */
  onToggle?: (key: string) => void
  align?: "start" | "end"
  className?: string
}

/**
 * Series legend. Labels use text tokens; the swatch beside them carries the
 * series colour, so identity is never colour-on-text. Toggle buttons expose
 * aria-pressed and keep at least one series visible (enforced by the caller).
 */
export function ChartLegend({ items, onToggle, align = "end", className }: ChartLegendProps) {
  const prefix = useId().replace(/:/g, "")
  if (items.length === 0) return null

  return (
    <ul aria-label="图例" className={cn(styles.legend, align === "start" && styles.legendStart, className)}>
      {items.map((item) => {
        const content = (
          <>
            <LegendSwatch item={item} prefix={prefix} />
            <span className={styles.legendText}>
              <span className={styles.legendLabel}>{item.label}</span>
              {item.qualifier ? <span className={styles.legendQualifier}> {item.qualifier}</span> : null}
            </span>
          </>
        )

        return (
          <li
            className={cn(styles.legendItem, item.hidden && styles.legendItemHidden)}
            data-chart-legend-item=""
            data-color={item.color}
            data-hidden={item.hidden ? "true" : undefined}
            data-label={item.qualifier ? `${item.label} ${item.qualifier}` : item.label}
            key={item.key}
          >
            {onToggle ? (
              <button
                aria-label={`${item.hidden ? "显示" : "隐藏"}系列 ${item.label}`}
                aria-pressed={!item.hidden}
                className={styles.legendButton}
                onClick={() => onToggle(item.key)}
                type="button"
              >
                {content}
              </button>
            ) : (
              <span className={styles.legendStatic}>{content}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function LegendSwatch({ item, prefix }: { item: ChartLegendItem; prefix: string }) {
  const id = `${prefix}-${cssKey(item.key)}`
  const fill = item.pattern ? `url(#${id})` : item.color
  const mark = item.mark ?? "dot"

  return (
    <svg aria-hidden="true" className={styles.swatch} viewBox="0 0 14 14">
      {item.pattern ? (
        <defs>
          <PatternDef color={item.color} id={id} pattern={item.pattern} />
        </defs>
      ) : null}
      {mark === "line" ? (
        <line
          stroke={item.color}
          strokeDasharray={item.dashed ? "3 2" : undefined}
          strokeLinecap="round"
          strokeWidth="2.5"
          x1="1.5"
          x2="12.5"
          y1="7"
          y2="7"
        />
      ) : mark === "square" ? (
        <rect className={styles.swatchMark} fill={fill} height="11" rx="2.5" width="11" x="1.5" y="1.5" />
      ) : (
        <circle className={styles.swatchMark} cx="7" cy="7" fill={fill} r="5.5" />
      )}
    </svg>
  )
}
