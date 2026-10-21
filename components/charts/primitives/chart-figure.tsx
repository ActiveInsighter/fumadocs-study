"use client"

import * as React from "react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import {
  buildExportSvg,
  downloadCsv,
  downloadPng,
  downloadSvg,
  exportFileName,
  resolveCssColor,
  toCsv,
} from "../core/export"
import type { ChartTheme } from "../core/types"
import { ChartDataTable, type ChartTableData } from "./chart-data-table"
import { ChartLegend, type ChartLegendItem } from "./chart-legend"
import { ChartMotionProvider, useInViewOnce, useReducedChartMotion } from "./chart-motion"
import { ChartEmpty, ChartErrorBoundary } from "./chart-state"
import { ChartToolbar, type ChartExportFormat } from "./chart-toolbar"

import styles from "./chart-figure.module.css"

export type ChartFigureProps = {
  title: string
  /** Short descriptor under the title, e.g. "准确率 vs 成本". */
  subtitle?: ReactNode
  /** @deprecated alias of `subtitle`, kept for existing MDX. */
  description?: ReactNode
  footnote?: ReactNode
  /** One-sentence takeaway announced to screen readers with the figure. */
  summary?: string
  theme?: ChartTheme
  legend?: readonly ChartLegendItem[]
  onLegendToggle?: (key: string) => void
  legendAlign?: "start" | "end"
  /** Rows behind the chart: powers the table view, CSV export and the sr-only fallback. */
  table?: ChartTableData
  /** Download formats; `false` hides the menu. */
  exportFormats?: readonly ChartExportFormat[] | false
  /** Hide the table toggle (the sr-only table still renders). */
  hideTableToggle?: boolean
  empty?: boolean
  emptyMessage?: string
  /** Height reserved for the plot, so empty / table / loading states never shift layout. */
  plotHeight?: number
  /** Extra controls in the header row, e.g. metric switch. */
  actions?: ReactNode
  id?: string
  className?: string
  children: ReactNode
}

const DEFAULT_FORMATS: readonly ChartExportFormat[] = ["svg", "png", "csv"]

/**
 * The frame every Study chart renders inside: title block, toolbar, legend,
 * plot (or table / empty / error state), sr-only data table and footnote.
 * Also provides the entrance-motion context consumed by the plots.
 */
export function ChartFigure({
  title,
  subtitle,
  description,
  footnote,
  summary,
  theme = "study",
  legend,
  onLegendToggle,
  legendAlign = "end",
  table,
  exportFormats = DEFAULT_FORMATS,
  hideTableToggle = false,
  empty = false,
  emptyMessage,
  plotHeight,
  actions,
  id,
  className,
  children,
}: ChartFigureProps) {
  const generatedId = React.useId().replace(/:/g, "")
  const baseId = id ?? `chart-${generatedId}`
  const titleId = `${baseId}-title`
  const summaryId = `${baseId}-summary`
  const footnoteId = `${baseId}-footnote`
  const tableId = `${baseId}-table`

  const figureRef = React.useRef<HTMLElement>(null)
  const plotRef = React.useRef<HTMLDivElement>(null)
  const isInView = useInViewOnce(plotRef)
  const reducedMotion = useReducedChartMotion()
  const [view, setView] = React.useState<"chart" | "table">("chart")

  const subtitleNode = subtitle ?? description
  const formats = exportFormats === false ? [] : exportFormats.filter((format) => format !== "csv" || table)
  const visibleFormats = empty ? formats.filter((format) => format === "csv") : formats

  const handleExport = async (format: ChartExportFormat) => {
    const figure = figureRef.current
    if (!figure) return
    if (format === "csv") {
      if (table) downloadCsv(toCsv(table.rows, table.columns), exportFileName(title, "csv"))
      return
    }
    const plot = plotRef.current?.querySelector<SVGSVGElement>("svg.recharts-surface, svg[data-chart-plot]")
    if (!plot) throw new Error("当前视图没有可导出的图形")
    const exportLegend = (legend ?? [])
      .filter((item) => !item.hidden)
      .map((item) => ({
        label: item.qualifier ? `${item.label} ${item.qualifier}` : item.label,
        color: resolveCssColor(figure, item.color),
      }))
    figure.setAttribute("data-chart-exporting", "")
    try {
      const result = buildExportSvg(plot, figure, {
        title,
        subtitle: typeof subtitleNode === "string" ? subtitleNode : undefined,
        footnote: typeof footnote === "string" ? footnote : undefined,
        legend: exportLegend,
      })
      if (format === "svg") downloadSvg(result.svg, exportFileName(title, "svg"))
      else await downloadPng(result.svg, result.width, result.height, exportFileName(title, "png"))
    } finally {
      figure.removeAttribute("data-chart-exporting")
    }
  }

  const tableView =
    table && !hideTableToggle
      ? { active: view === "table", onToggle: () => setView((current) => (current === "table" ? "chart" : "table")), controls: tableId }
      : undefined

  return (
    <div className={cn(styles.root, className)} data-chart-theme={theme}>
      <figure
        aria-describedby={[summary ? summaryId : null, footnote ? footnoteId : null].filter(Boolean).join(" ") || undefined}
        aria-labelledby={titleId}
        className={styles.panel}
        id={id}
        ref={figureRef}
      >
        <div className={styles.header}>
          <figcaption className={styles.caption}>
            <span className={styles.title} id={titleId}>
              {title}
            </span>
            {subtitleNode ? <span className={styles.subtitle}>{subtitleNode}</span> : null}
          </figcaption>
          {actions || visibleFormats.length > 0 || tableView ? (
            <div className={styles.headerActions}>
              {actions}
              <ChartToolbar formats={visibleFormats} onExport={handleExport} tableView={tableView} />
            </div>
          ) : null}
        </div>
        {summary ? (
          <p className="sr-only" id={summaryId}>
            {summary}
          </p>
        ) : null}
        {legend && legend.length > 1 && view === "chart" && !empty ? (
          <ChartLegend align={legendAlign} items={legend} onToggle={onLegendToggle} />
        ) : null}
        <ChartMotionProvider value={{ isInView, shouldAnimate: isInView && !reducedMotion }}>
          <div
            className={styles.plot}
            data-in-view={isInView ? "true" : "false"}
            data-view={view}
            ref={plotRef}
            style={plotHeight && (view === "table" || empty) ? { minHeight: plotHeight } : undefined}
          >
            {view === "table" && table ? (
              <ChartDataTable caption={title} id={tableId} table={table} />
            ) : empty ? (
              <ChartEmpty height={plotHeight} message={emptyMessage} />
            ) : (
              <ChartErrorBoundary height={plotHeight} onShowTable={tableView ? () => setView("table") : undefined}>
                {/* Mount the plot on first intersection so its entrance animation is seen;
                    the reserved height keeps the layout stable until then. */}
                {isInView ? children : <div aria-hidden="true" style={{ height: plotHeight ?? 320 }} />}
              </ChartErrorBoundary>
            )}
          </div>
        </ChartMotionProvider>
        {table && view === "chart" ? <ChartDataTable caption={title} id={tableId} table={table} visuallyHidden /> : null}
      </figure>
      {footnote ? (
        <p className={styles.footnote} id={footnoteId}>
          {footnote}
        </p>
      ) : null}
    </div>
  )
}
