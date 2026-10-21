/**
 * Shared data contracts for the Study chart family.
 *
 * Everything an MDX author writes is plain JSON-like data: rows, series
 * descriptors and format names. Visual decisions (colour, marks, motion) are
 * resolved from tokens, and interaction state lives inside the components.
 */

export type ChartValue = string | number | null | undefined

export type ChartDatum = Record<string, ChartValue>

export type ChartPattern = "dots" | "hatch"

/** A named token (`"chart-3"`, `"3"`, `"editorial-2"`, `"other"`) or any CSS colour. */
export type ChartColor = string

export type ChartSeries = {
  /** Data key in each row. */
  key: string
  label?: string
  /** Optional secondary text shown after the label, e.g. "(with tools)". */
  qualifier?: string
  color?: ChartColor
  /** Texture fill for marks and legend swatches (print / CVD backup channel). */
  pattern?: ChartPattern
  /** Composed charts only: how this series is drawn. */
  type?: "line" | "bar" | "area"
  dashed?: boolean
  /** Start hidden; readers can toggle it back on from the legend. */
  hidden?: boolean
  /** Stack group for bars and areas. Overrides the chart-level `stacked`. */
  stackId?: string
}

export type ChartTheme = "study" | "editorial"

export type FormatPreset =
  | "number"
  | "integer"
  | "decimal"
  | "compact"
  | "percent"
  | "ratio"
  | "usd"
  | "cny"
  | "multiplier"
  | "minutes"
  | "seconds"

export type FormatSpec = {
  /** Base preset; defaults to "number". */
  preset?: FormatPreset
  prefix?: string
  suffix?: string
  /** Maximum fraction digits. */
  digits?: number
  /** Minimum fraction digits. */
  minDigits?: number
  compact?: boolean
  signed?: boolean
}

export type ValueFormat = FormatPreset | FormatSpec

export type ResolvedSeries = Required<Pick<ChartSeries, "key">> & {
  label: string
  qualifier?: string
  color: string
  pattern?: ChartPattern
  type?: ChartSeries["type"]
  dashed?: boolean
  hidden: boolean
  stackId?: string
  index: number
}
