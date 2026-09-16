import type { BenchmarkCell, BenchmarkRow } from "./types"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import styles from "./benchmark-table.module.css"

const tableFootnote = "Fable 5.1 was evaluated with its production safeguards enabled. On tasks where these safeguards intervened, Fable 5.1 and Fable 5 scored a zero on OSWorld 2.0, and Fable 5 scored a zero on AutomationBench. In all other interventions from our safeguards, cybersecurity tasks were completed by Claude Opus 4.8, and biology tasks were completed by Claude Opus 5. This likely reduces the performance of Fable 5.1 and Fable 5 on these benchmarks."

export function BenchmarkTable({
  models,
  rows,
}: {
  models: readonly string[]
  rows: readonly BenchmarkRow[]
}) {
  const tableLabel = `Benchmark comparison for ${models.join(", ")}`

  return (
    <figure className={styles.figure} aria-label="Benchmark comparison table">
      <div className={styles.wrap}>
        <Table className={styles.table} containerClassName={styles.scroll}>
          <TableCaption className={styles.srOnly}>{tableLabel}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className={styles.corner} scope="col" />
              {models.map((model, index) => (
                <TableHead
                  className={`${index === 0 ? styles.ours : styles.rival} ${index === 0 ? styles.subjectEdge : ""}`}
                  key={model}
                  scope="col"
                >
                  {model}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIndex) => {
              const isSplitRow = isSplitBenchmarkRow(row)
              const isSplitContinuation = isSplitRow && isSplitBenchmarkRow(rows[rowIndex - 1])

              return (
                <TableRow className={isSplitRow ? styles.splitRow : undefined} key={`${row.category}-${row.benchmark}-${rowIndex}`}>
                  {!isSplitContinuation ? (
                    <TableHead className={styles.labelCell} rowSpan={isSplitRow ? 2 : undefined} scope="row">
                      <span className={styles.category}>{row.category}</span>
                      <span className={styles.benchmark}>{row.benchmark}</span>
                    </TableHead>
                  ) : null}
                  {row.cells.map((cell, cellIndex) => (
                    <BenchmarkCellView
                      cell={cell}
                      category={row.category}
                      benchmark={row.benchmark}
                      className={`${cellIndex === 0 ? styles.ours : styles.rival} ${cellIndex === 0 ? styles.subjectEdge : ""} ${cellIndex === 0 ? styles.pinned : ""}`}
                      key={`${rowIndex}-${cellIndex}`}
                      valueClassName={cellIndex === 0 ? styles.valueBold : undefined}
                    />
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <figcaption className={styles.caption}>{tableFootnote}</figcaption>
    </figure>
  )
}

function BenchmarkCellView({
  cell,
  category,
  benchmark,
  className,
  valueClassName,
}: {
  cell: BenchmarkCell
  category: string
  benchmark: string
  className: string
  valueClassName?: string
}) {
  return (
    <TableCell className={className}>
      <span className={styles.mobileLabel}>
        <strong>{category}</strong>
        {benchmark}
      </span>
      <span className={valueClassName}>{cell.value}</span>
      {cell.qualifier ? <span className={styles.qualifier}>{cell.qualifier}</span> : null}
    </TableCell>
  )
}

function isSplitBenchmarkRow(row: BenchmarkRow | undefined): boolean {
  return row?.category === "Multidisciplinary reasoning" && row.benchmark === "Humanity's Last Exam"
}
