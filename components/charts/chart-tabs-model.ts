export type ChartTab = {
  id: string
  label: string
}

export type ChartTabVisibilityOptions = {
  compactBreakpoint?: number
  compactVisibleCount?: number
  mediumBreakpoint?: number
  mediumVisibleCount?: number
}

const defaultOptions = {
  compactBreakpoint: 567,
  compactVisibleCount: 1,
  mediumBreakpoint: 991,
  mediumVisibleCount: 3,
} as const

export function getVisibleChartTabIds(
  tabs: readonly ChartTab[],
  viewportWidth: number,
  options: ChartTabVisibilityOptions = {},
): string[] {
  const settings = { ...defaultOptions, ...options }

  let visibleCount = tabs.length
  if (viewportWidth <= settings.compactBreakpoint) {
    visibleCount = settings.compactVisibleCount
  } else if (viewportWidth <= settings.mediumBreakpoint) {
    visibleCount = settings.mediumVisibleCount
  }

  return tabs.slice(0, Math.max(0, Math.min(tabs.length, visibleCount))).map((tab) => tab.id)
}

export function getOverflowChartTabIds(
  tabs: readonly ChartTab[],
  viewportWidth: number,
  options: ChartTabVisibilityOptions = {},
): string[] {
  const visible = new Set(getVisibleChartTabIds(tabs, viewportWidth, options))
  return tabs.filter((tab) => !visible.has(tab.id)).map((tab) => tab.id)
}

export function getNextVisibleChartTabId(
  tabs: readonly ChartTab[],
  currentId: string,
  direction: 1 | -1,
  viewportWidth: number,
  options: ChartTabVisibilityOptions = {},
): string {
  const visibleIds = getVisibleChartTabIds(tabs, viewportWidth, options)
  if (visibleIds.length === 0) return currentId

  const currentIndex = visibleIds.indexOf(currentId)
  const normalizedIndex = currentIndex >= 0 ? currentIndex : 0
  const nextIndex = (normalizedIndex + direction + visibleIds.length) % visibleIds.length

  return visibleIds[nextIndex] ?? currentId
}
