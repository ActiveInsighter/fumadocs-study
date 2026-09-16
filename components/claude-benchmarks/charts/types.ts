export type ChartColor =
  | "paper"
  | "matcha"
  | "cloud"
  | "heather"
  | "coral"
  | "gray"
  | "grayHatch"
  | "matchaHatch"
  | "cloudHatch"
  | "heatherHatch"
  | "coralHatch"

export type ChartPattern = "dots" | "hatch"

export type ScatterLabelPosition = "above" | "below"

export type BenchmarkTab = {
  id: string
  label: string
}

export type BenchmarkPoint = {
  cost: number
  costLabel: string
  score: number
  scoreLabel?: string
  effort: string
  labelPosition?: ScatterLabelPosition
}

export type ScatterSeries = {
  id: string
  label: string
  color: ChartColor
  pattern?: ChartPattern
  labelEfforts?: readonly string[]
  points: readonly BenchmarkPoint[]
}

export type ScatterTick = {
  value: number
  label: string
}

export type ScatterView = {
  id: string
  title: string
  subtitle: string
  ariaLabel: string
  yTicks: readonly ScatterTick[]
  xTicks: readonly ScatterTick[]
  xDomain: readonly [number, number]
  yDomain: readonly [number, number]
  yAxisBreak?: {
    lower: number
    upper: number
    lowerPlotPosition: number
  }
  yAxisLabel: string
  xAxisLabel: string
  series: readonly ScatterSeries[]
  legendOrder?: readonly string[]
  footnote: string
}

export type BenchmarkCell = {
  value: string
  qualifier?: string
}

export type BenchmarkRow = {
  category: string
  benchmark: string
  cells: readonly BenchmarkCell[]
}

export type HorizontalBarRow = {
  label: string
  note: string
  value: number
  valueLabel: string
}

export type CostBarRow = {
  label: string
  note: string
  original: number
  optimized: number
  originalLabel: string
  optimizedLabel: string
}

export type IndexedCostGroup = {
  label: string
  fable5: {
    cacheReads: number
    otherTokens: number
  }
  fable51: {
    cacheReads: number
    otherTokens: number
  }
  savingsLabel: string
}

export type BenchmarkChartConfig = Record<string, {
  label: string
  color: string
}>
