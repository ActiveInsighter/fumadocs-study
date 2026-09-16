import type {
  BenchmarkRow,
  CostBarRow,
  HorizontalBarRow,
  IndexedCostGroup,
  ScatterView,
  BenchmarkTab,
} from './charts/types'
import type { Testimonial } from './testimonials/types'

export interface BenchmarkViewsData {
  readonly tabs: readonly BenchmarkTab[]
  readonly views: readonly ScatterView[]
}

export interface ClaudeBenchmarkChartsData {
  readonly benchmarkViews: BenchmarkViewsData
  readonly benchmarkModels: readonly string[]
  readonly benchmarkTableRows: readonly BenchmarkRow[]
  readonly scientificTabs: readonly BenchmarkTab[]
  readonly inferenceRows: readonly HorizontalBarRow[]
  readonly genomeCostRows: readonly CostBarRow[]
  readonly indexedCostGroups: readonly IndexedCostGroup[]
}

export interface ClaudeBenchmarkData extends ClaudeBenchmarkChartsData {
  readonly testimonials: readonly Testimonial[]
}
