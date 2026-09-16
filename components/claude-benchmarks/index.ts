/**
 * Public entry point for the Claude model benchmark figures used in docs.
 *
 * The chart primitives, parser and source data stay private to this feature so
 * a page only depends on the two documented composition points below.
 */
export { ClaudeBenchmarkCharts } from './charts/benchmark-charts'
export type { ClaudeBenchmarkChartsProps } from './charts/benchmark-charts'
export { ClaudeTestimonialCarousel } from './testimonials/testimonial-carousel'
export type { ClaudeTestimonialCarouselProps } from './testimonials/testimonial-carousel'
export type {
  BenchmarkViewsData,
  ClaudeBenchmarkChartsData,
  ClaudeBenchmarkData,
} from './types'
export type { Testimonial } from './testimonials/types'
