import { describe, expect, it } from "vitest"

import {
  getNextVisibleChartTabId,
  getOverflowChartTabIds,
  getVisibleChartTabIds,
} from "../components/charts/chart-tabs-model"
import { buildHistogramBins } from "../components/charts/study-chart-model"

describe("generic chart tabs", () => {
  const tabs = [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
    { id: "c", label: "C" },
    { id: "d", label: "D" },
    { id: "e", label: "E" },
  ] as const

  it("keeps responsive overflow data-driven for any tab count", () => {
    expect(getVisibleChartTabIds(tabs, 1200)).toEqual(["a", "b", "c", "d", "e"])
    expect(getVisibleChartTabIds(tabs, 800)).toEqual(["a", "b", "c"])
    expect(getOverflowChartTabIds(tabs, 800)).toEqual(["d", "e"])
    expect(getVisibleChartTabIds(tabs, 390)).toEqual(["a"])
    expect(getOverflowChartTabIds(tabs, 390)).toEqual(["b", "c", "d", "e"])
  })

  it("wraps keyboard navigation within visible tabs", () => {
    expect(getNextVisibleChartTabId(tabs, "c", 1, 800)).toBe("a")
    expect(getNextVisibleChartTabId(tabs, "a", -1, 800)).toBe("c")
  })
})

describe("histogram model", () => {
  it("bins finite values and preserves the total sample count", () => {
    const bins = buildHistogramBins([1, 2, 2, 3, 4, 5, Number.NaN], 4)

    expect(bins).toHaveLength(4)
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(6)
    expect(bins[0]?.start).toBe(1)
    expect(bins.at(-1)?.end).toBe(5)
  })

  it("handles a constant sample without zero-width division", () => {
    expect(buildHistogramBins([3, 3, 3], 8)).toEqual([
      { label: "3", count: 3, start: 3, end: 3 },
    ])
  })
})
