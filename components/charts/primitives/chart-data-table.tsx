import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

import { formatValue, type Formatter } from "../core/format"
import type { ChartDatum } from "../core/types"

import styles from "./chart-figure.module.css"

export type ChartTableColumn = {
  key: string
  label: string
  /** Numeric columns are right-aligned and formatted. */
  numeric?: boolean
  formatter?: Formatter
}

export type ChartTableData = {
  columns: readonly ChartTableColumn[]
  rows: readonly ChartDatum[]
}

/**
 * Semantic fallback for every chart: the same rows as a real table. Rendered
 * visually hidden for assistive technology and search engines, and shown
 * when the reader switches the figure to table view.
 */
export function ChartDataTable({
  caption,
  table,
  visuallyHidden = false,
  id,
}: {
  caption: string
  table: ChartTableData
  visuallyHidden?: boolean
  id?: string
}) {
  return (
    <div className={cn(visuallyHidden ? "sr-only" : styles.tableWrap)} id={id}>
      <Table className={cn("not-prose", styles.table)}>
        <caption className="sr-only">{caption}</caption>
        <TableHeader>
          <TableRow>
            {table.columns.map((column) => (
              <TableHead className={cn(column.numeric && styles.numeric)} key={column.key} scope="col">
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {table.columns.map((column, columnIndex) => {
                const value = row[column.key]
                const text = column.numeric && column.formatter ? formatValue(value, column.formatter) : value === null || value === undefined ? "–" : String(value)
                return columnIndex === 0 ? (
                  <TableHead className={styles.rowHeader} key={column.key} scope="row">
                    {text}
                  </TableHead>
                ) : (
                  <TableCell className={cn(column.numeric && styles.numeric)} key={column.key}>
                    {text}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
