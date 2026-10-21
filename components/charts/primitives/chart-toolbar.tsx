"use client"

import { Download, Table2 } from "lucide-react"
import { useState } from "react"

import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import styles from "./chart-figure.module.css"

export type ChartExportFormat = "svg" | "png" | "csv"

export type ChartToolbarProps = {
  /** Formats offered in the download menu; empty hides the menu. */
  formats: readonly ChartExportFormat[]
  onExport: (format: ChartExportFormat) => Promise<void> | void
  /** Omit to hide the table toggle. */
  tableView?: { active: boolean; onToggle: () => void; controls: string }
}

const formatLabels: Record<ChartExportFormat, string> = {
  svg: "SVG 矢量图",
  png: "PNG 图片（2×）",
  csv: "CSV 数据",
}

export function ChartToolbar({ formats, onExport, tableView }: ChartToolbarProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (format: ChartExportFormat) => {
    setBusy(true)
    setError(null)
    try {
      await onExport(format)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导出失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.toolbar} data-chart-export="ignore">
      {tableView ? (
        <button
          aria-controls={tableView.controls}
          aria-label={tableView.active ? "显示图表" : "以表格查看数据"}
          aria-pressed={tableView.active}
          className={cn(buttonVariants({ size: "icon-sm", variant: "ghost" }), styles.toolButton)}
          onClick={tableView.onToggle}
          title={tableView.active ? "显示图表" : "以表格查看数据"}
          type="button"
        >
          <Table2 aria-hidden="true" />
        </button>
      ) : null}
      {formats.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-busy={busy}
            aria-label="下载图表"
            className={cn(buttonVariants({ size: "icon-sm", variant: "ghost" }), styles.toolButton)}
            disabled={busy}
            title="下载图表"
          >
            <Download aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-40" sideOffset={6}>
            <DropdownMenuGroup>
              <DropdownMenuLabel>下载</DropdownMenuLabel>
              {formats.map((format) => (
                <DropdownMenuItem key={format} onClick={() => void run(format)}>
                  {formatLabels[format]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {error ? (
        <span className={styles.toolError} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  )
}
