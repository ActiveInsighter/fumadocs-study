import rawClaudeBenchmarkContent from '@/data/claude-benchmarks/claude-benchmarks.json'
import type {
  BenchmarkPoint,
  BenchmarkRow,
  ChartColor,
  ChartPattern,
  CostBarRow,
  HorizontalBarRow,
  IndexedCostGroup,
  ScatterLabelPosition,
  ScatterSeries,
  ScatterTick,
  ScatterView,
  BenchmarkTab,
} from './charts/types'
import type { Testimonial } from './testimonials/types'
import type { ClaudeBenchmarkData } from './types'

const chartColors = [
  'paper',
  'matcha',
  'cloud',
  'heather',
  'coral',
  'gray',
  'grayHatch',
  'matchaHatch',
  'cloudHatch',
  'heatherHatch',
  'coralHatch',
] as const satisfies readonly ChartColor[]

const chartPatterns = ['dots', 'hatch'] as const satisfies readonly ChartPattern[]
const labelPositions = ['above', 'below'] as const satisfies readonly ScatterLabelPosition[]

type JsonRecord = Record<string, unknown>

function readRecord(value: unknown, path: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`[claude-benchmarks-data] ${path} must be an object`)
  }

  return value as JsonRecord
}

function readRequired(record: JsonRecord, key: string, path: string): unknown {
  if (!(key in record)) {
    throw new Error(`[claude-benchmarks-data] Missing ${path}.${key}`)
  }

  return record[key]
}

function readString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`[claude-benchmarks-data] ${path} must be a non-empty string`)
  }

  return value
}

function readOptionalString(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null) return undefined
  return readString(value, path)
}

function readNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`[claude-benchmarks-data] ${path} must be a finite number`)
  }

  return value
}

function readArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`[claude-benchmarks-data] ${path} must be an array`)
  }

  return value
}

function readTuple(value: unknown, path: string): readonly [number, number] {
  const items = readArray(value, path)
  if (items.length !== 2) {
    throw new Error(`[claude-benchmarks-data] ${path} must contain exactly two numbers`)
  }

  return [readNumber(items[0], `${path}[0]`), readNumber(items[1], `${path}[1]`)]
}

function readEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  path: string,
): T {
  const candidate = readString(value, path)
  if (!values.includes(candidate as T)) {
    throw new Error(`[claude-benchmarks-data] ${path} has unsupported value: ${candidate}`)
  }

  return candidate as T
}

function readStringArray(value: unknown, path: string): readonly string[] {
  return readArray(value, path).map((item, index) => readString(item, `${path}[${index}]`))
}

function assertUnique(values: readonly string[], path: string): void {
  const seen = new Set<string>()
  values.forEach((value, index) => {
    if (seen.has(value)) {
      throw new Error(`[claude-benchmarks-data] Duplicate id in ${path}[${index}]: ${value}`)
    }
    seen.add(value)
  })
}

function parseBenchmarkTab(value: unknown, index: number): BenchmarkTab {
  const path = `benchmarkViews.tabs[${index}]`
  const item = readRecord(value, path)
  return {
    id: readString(readRequired(item, 'id', path), `${path}.id`),
    label: readString(readRequired(item, 'label', path), `${path}.label`),
  }
}

function parseScatterTick(value: unknown, path: string): ScatterTick {
  const item = readRecord(value, path)
  return {
    label: readString(readRequired(item, 'label', path), `${path}.label`),
    value: readNumber(readRequired(item, 'value', path), `${path}.value`),
  }
}

function parseBenchmarkPoint(value: unknown, path: string): BenchmarkPoint {
  const item = readRecord(value, path)
  const labelPositionValue = readOptionalString(item.labelPosition, `${path}.labelPosition`)

  return {
    cost: readNumber(readRequired(item, 'cost', path), `${path}.cost`),
    costLabel: readString(readRequired(item, 'costLabel', path), `${path}.costLabel`),
    score: readNumber(readRequired(item, 'score', path), `${path}.score`),
    scoreLabel: readOptionalString(item.scoreLabel, `${path}.scoreLabel`),
    effort: readString(readRequired(item, 'effort', path), `${path}.effort`),
    labelPosition: labelPositionValue
      ? readEnum(labelPositionValue, labelPositions, `${path}.labelPosition`)
      : undefined,
  }
}

function parseScatterSeries(value: unknown, index: number): ScatterSeries {
  const path = `benchmarkViews.views[].series[${index}]`
  const item = readRecord(value, path)
  const pointValues = readArray(readRequired(item, 'points', path), `${path}.points`)
  const patternValue = readOptionalString(item.pattern, `${path}.pattern`)

  return {
    id: readString(readRequired(item, 'id', path), `${path}.id`),
    label: readString(readRequired(item, 'label', path), `${path}.label`),
    color: readEnum(readRequired(item, 'color', path), chartColors, `${path}.color`),
    pattern: patternValue ? readEnum(patternValue, chartPatterns, `${path}.pattern`) : undefined,
    labelEfforts: item.labelEfforts === undefined
      ? undefined
      : readStringArray(item.labelEfforts, `${path}.labelEfforts`),
    points: pointValues.map((point, pointIndex) =>
      parseBenchmarkPoint(point, `${path}.points[${pointIndex}]`),
    ),
  }
}

function parseScatterView(value: unknown, index: number): ScatterView {
  const path = `benchmarkViews.views[${index}]`
  const item = readRecord(value, path)
  const seriesValues = readArray(readRequired(item, 'series', path), `${path}.series`)
  const yAxisBreakValue = item.yAxisBreak
  const yAxisBreak = yAxisBreakValue === undefined || yAxisBreakValue === null
    ? undefined
    : (() => {
        const axisBreakPath = `${path}.yAxisBreak`
        const axisBreak = readRecord(yAxisBreakValue, axisBreakPath)
        return {
          lower: readNumber(readRequired(axisBreak, 'lower', axisBreakPath), `${axisBreakPath}.lower`),
          upper: readNumber(readRequired(axisBreak, 'upper', axisBreakPath), `${axisBreakPath}.upper`),
          lowerPlotPosition: readNumber(
            readRequired(axisBreak, 'lowerPlotPosition', axisBreakPath),
            `${axisBreakPath}.lowerPlotPosition`,
          ),
        }
      })()

  const series = seriesValues.map((seriesValue, seriesIndex) =>
    parseScatterSeries(seriesValue, seriesIndex),
  )
  assertUnique(series.map((item) => item.id), `${path}.series`)

  return {
    id: readString(readRequired(item, 'id', path), `${path}.id`),
    title: readString(readRequired(item, 'title', path), `${path}.title`),
    subtitle: readString(readRequired(item, 'subtitle', path), `${path}.subtitle`),
    ariaLabel: readString(readRequired(item, 'ariaLabel', path), `${path}.ariaLabel`),
    yTicks: readArray(readRequired(item, 'yTicks', path), `${path}.yTicks`).map((tick, tickIndex) =>
      parseScatterTick(tick, `${path}.yTicks[${tickIndex}]`),
    ),
    xTicks: readArray(readRequired(item, 'xTicks', path), `${path}.xTicks`).map((tick, tickIndex) =>
      parseScatterTick(tick, `${path}.xTicks[${tickIndex}]`),
    ),
    xDomain: readTuple(readRequired(item, 'xDomain', path), `${path}.xDomain`),
    yDomain: readTuple(readRequired(item, 'yDomain', path), `${path}.yDomain`),
    yAxisBreak,
    yAxisLabel: readString(readRequired(item, 'yAxisLabel', path), `${path}.yAxisLabel`),
    xAxisLabel: readString(readRequired(item, 'xAxisLabel', path), `${path}.xAxisLabel`),
    series,
    legendOrder: item.legendOrder === undefined
      ? undefined
      : readStringArray(item.legendOrder, `${path}.legendOrder`),
    footnote: readString(readRequired(item, 'footnote', path), `${path}.footnote`),
  }
}

function parseBenchmarkCell(value: unknown, path: string) {
  const item = readRecord(value, path)
  return {
    value: readString(readRequired(item, 'value', path), `${path}.value`),
    qualifier: readOptionalString(item.qualifier, `${path}.qualifier`),
  }
}

function parseBenchmarkRow(value: unknown, index: number): BenchmarkRow {
  const path = `benchmarkTableRows[${index}]`
  const item = readRecord(value, path)
  const cells = readArray(readRequired(item, 'cells', path), `${path}.cells`)

  return {
    category: readString(readRequired(item, 'category', path), `${path}.category`),
    benchmark: readString(readRequired(item, 'benchmark', path), `${path}.benchmark`),
    cells: cells.map((cell, cellIndex) => parseBenchmarkCell(cell, `${path}.cells[${cellIndex}]`)),
  }
}

function parseHorizontalBarRow(value: unknown, index: number): HorizontalBarRow {
  const path = `inferenceRows[${index}]`
  const item = readRecord(value, path)
  return {
    label: readString(readRequired(item, 'label', path), `${path}.label`),
    note: readString(readRequired(item, 'note', path), `${path}.note`),
    value: readNumber(readRequired(item, 'value', path), `${path}.value`),
    valueLabel: readString(readRequired(item, 'valueLabel', path), `${path}.valueLabel`),
  }
}

function parseCostBarRow(value: unknown, index: number): CostBarRow {
  const path = `genomeCostRows[${index}]`
  const item = readRecord(value, path)
  return {
    label: readString(readRequired(item, 'label', path), `${path}.label`),
    note: readString(readRequired(item, 'note', path), `${path}.note`),
    original: readNumber(readRequired(item, 'original', path), `${path}.original`),
    optimized: readNumber(readRequired(item, 'optimized', path), `${path}.optimized`),
    originalLabel: readString(readRequired(item, 'originalLabel', path), `${path}.originalLabel`),
    optimizedLabel: readString(readRequired(item, 'optimizedLabel', path), `${path}.optimizedLabel`),
  }
}

function parseIndexedCostGroup(value: unknown, index: number): IndexedCostGroup {
  const path = `indexedCostGroups[${index}]`
  const item = readRecord(value, path)
  const parseTokens = (key: 'fable5' | 'fable51') => {
    const tokenPath = `${path}.${key}`
    const tokens = readRecord(readRequired(item, key, path), tokenPath)
    return {
      cacheReads: readNumber(readRequired(tokens, 'cacheReads', tokenPath), `${tokenPath}.cacheReads`),
      otherTokens: readNumber(readRequired(tokens, 'otherTokens', tokenPath), `${tokenPath}.otherTokens`),
    }
  }

  return {
    label: readString(readRequired(item, 'label', path), `${path}.label`),
    fable5: parseTokens('fable5'),
    fable51: parseTokens('fable51'),
    savingsLabel: readString(readRequired(item, 'savingsLabel', path), `${path}.savingsLabel`),
  }
}

function parseTestimonial(value: unknown, index: number): Testimonial {
  const path = `testimonials[${index}]`
  const item = readRecord(value, path)
  return {
    quote: readString(readRequired(item, 'quote', path), `${path}.quote`),
    company: readString(readRequired(item, 'company', path), `${path}.company`),
    author: readString(readRequired(item, 'author', path), `${path}.author`),
  }
}

export function parseClaudeBenchmarkContent(value: unknown): ClaudeBenchmarkData {
  const root = readRecord(value, 'root')
  const benchmarkValue = readRecord(
    readRequired(root, 'benchmarkViews', 'root'),
    'benchmarkViews',
  )
  const tabs = readArray(
    readRequired(benchmarkValue, 'tabs', 'benchmarkViews'),
    'benchmarkViews.tabs',
  ).map(parseBenchmarkTab)
  const views = readArray(
    readRequired(benchmarkValue, 'views', 'benchmarkViews'),
    'benchmarkViews.views',
  ).map(parseScatterView)

  assertUnique(tabs.map((tab) => tab.id), 'benchmarkViews.tabs')
  assertUnique(views.map((view) => view.id), 'benchmarkViews.views')

  const benchmarkModels = readStringArray(
    readRequired(root, 'benchmarkModels', 'root'),
    'benchmarkModels',
  )
  if (benchmarkModels.length === 0) {
    throw new Error('[claude-benchmarks-data] benchmarkModels must not be empty')
  }
  assertUnique(benchmarkModels, 'benchmarkModels')

  const benchmarkTableRows = readArray(
    readRequired(root, 'benchmarkTableRows', 'root'),
    'benchmarkTableRows',
  ).map(parseBenchmarkRow)

  benchmarkTableRows.forEach((row, index) => {
    if (row.cells.length !== benchmarkModels.length) {
      throw new Error(
        `[claude-benchmarks-data] benchmarkTableRows[${index}].cells must contain exactly ${benchmarkModels.length} values`,
      )
    }
  })

  return {
    benchmarkViews: { tabs, views },
    benchmarkModels,
    benchmarkTableRows,
    scientificTabs: readArray(
      readRequired(root, 'scientificTabs', 'root'),
      'scientificTabs',
    ).map((tab, index) => parseBenchmarkTab(tab, index)),
    inferenceRows: readArray(
      readRequired(root, 'inferenceRows', 'root'),
      'inferenceRows',
    ).map(parseHorizontalBarRow),
    genomeCostRows: readArray(
      readRequired(root, 'genomeCostRows', 'root'),
      'genomeCostRows',
    ).map(parseCostBarRow),
    indexedCostGroups: readArray(
      readRequired(root, 'indexedCostGroups', 'root'),
      'indexedCostGroups',
    ).map(parseIndexedCostGroup),
    testimonials: readArray(
      readRequired(root, 'testimonials', 'root'),
      'testimonials',
    ).map(parseTestimonial),
  }
}

export const claudeBenchmarkData = parseClaudeBenchmarkContent(rawClaudeBenchmarkContent)

export const benchmarkViews = claudeBenchmarkData.benchmarkViews
export const benchmarkTableRows = claudeBenchmarkData.benchmarkTableRows
export const scientificTabs = claudeBenchmarkData.scientificTabs
export const inferenceRows = claudeBenchmarkData.inferenceRows
export const genomeCostRows = claudeBenchmarkData.genomeCostRows
export const indexedCostGroups = claudeBenchmarkData.indexedCostGroups
export const claudeTestimonials = claudeBenchmarkData.testimonials
