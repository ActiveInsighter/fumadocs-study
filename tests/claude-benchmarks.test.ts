import { describe, expect, it } from 'vitest'

import {
  benchmarkViews,
  claudeBenchmarkData,
  claudeTestimonials,
  parseClaudeBenchmarkContent,
  scientificTabs,
} from '../components/claude-benchmarks/data'
import {
  benchmarkTooltipMotionProps,
  createChartConfig,
  formatScatterTooltipValue,
  getNextTabId,
  getVisibleTabIds,
  toRechartsSeries,
} from '../components/claude-benchmarks/charts/model'
import {
  clampCarouselIndex,
  getAdjacentSlideState,
  getNextCarouselIndex,
  getPreviousCarouselIndex,
} from '../components/claude-benchmarks/testimonials/model'

describe('Claude benchmark JSON content contract', () => {
  it('loads the complete benchmark and carousel payload from JSON', () => {
    expect(claudeBenchmarkData.benchmarkViews.tabs).toHaveLength(4)
    expect(claudeBenchmarkData.benchmarkViews.views).toHaveLength(4)
    expect(claudeBenchmarkData.benchmarkModels).toEqual([
      'Fable 5.1',
      'Fable 5',
      'Opus 5',
      'GPT-5.6 Sol',
    ])
    expect(claudeBenchmarkData.benchmarkTableRows).toHaveLength(9)
    expect(claudeBenchmarkData.inferenceRows).toHaveLength(7)
    expect(claudeBenchmarkData.genomeCostRows).toHaveLength(3)
    expect(claudeBenchmarkData.indexedCostGroups).toHaveLength(2)
    expect(claudeTestimonials).toHaveLength(22)
    expect(scientificTabs.map((tab) => tab.id)).toEqual(['inference', 'genome-cost'])
  })

  it('rejects malformed JSON at the data boundary with a useful path', () => {
    expect(() => parseClaudeBenchmarkContent({})).toThrow(
      '[claude-benchmarks-data] Missing root.benchmarkViews',
    )
  })
})

describe('benchmark chart model', () => {
  it('normalizes source points without storing pixel coordinates', () => {
    const scientific = benchmarkViews.views[0]
    const series = toRechartsSeries(scientific)
    const point = series[0]?.data[0]

    expect(point?.cost).toBe(11.1)
    expect(point?.score).toBe(26.3)
    expect(point?.plotScore).toBeCloseTo(26.3 / 60)
    expect('x' in (scientific.series[0]?.points[0] ?? {})).toBe(false)
    expect(formatScatterTooltipValue(point)).toBe('26.3% · $11.1')
  })

  it('creates the shadcn chart config from JSON series metadata', () => {
    expect(createChartConfig(benchmarkViews.views[0].series)['fable-51']).toEqual({
      label: 'Fable 5.1',
      color: 'var(--claude-chart-matcha)',
    })
  })

  it('keeps tooltip position changes immediate while the pointer moves', () => {
    expect(benchmarkTooltipMotionProps).toEqual({
      animationDuration: 0,
      isAnimationActive: false,
    })
  })

  it('keeps responsive tab overflow and keyboard focus within visible tabs', () => {
    const tabs = benchmarkViews.tabs
    expect(getVisibleTabIds(tabs, 768)).toEqual(['scientific', 'terminal', 'reasoning'])
    expect(getVisibleTabIds(tabs, 390)).toEqual(['scientific'])
    expect(getNextTabId(tabs, 'reasoning', 1, 768)).toBe('scientific')
    expect(getNextTabId(tabs, 'scientific', -1, 390)).toBe('scientific')
  })
})

describe('testimonial carousel model', () => {
  it('clamps navigation and exposes adjacent desktop slide states', () => {
    expect(clampCarouselIndex(-2, 22)).toBe(0)
    expect(clampCarouselIndex(40, 22)).toBe(21)
    expect(getPreviousCarouselIndex(0, 22)).toBe(0)
    expect(getNextCarouselIndex(21, 22)).toBe(21)
    expect(getAdjacentSlideState(0, 0, 22)).toBe('active')
    expect(getAdjacentSlideState(1, 0, 22)).toBe('next')
    expect(getAdjacentSlideState(21, 0, 22)).toBe('far-next')
  })
})
