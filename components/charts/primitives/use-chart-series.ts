"use client"

import { useCallback, useMemo, useState } from "react"

import type { ChartConfig } from "@/components/ui/chart"

import { resolveSeries, toChartConfig, toggleHidden } from "../core/series"
import type { ChartSeries, ResolvedSeries } from "../core/types"
import type { ChartLegendItem, LegendMark } from "./chart-legend"

export type ChartSeriesModel = {
  series: ResolvedSeries[]
  visible: ResolvedSeries[]
  config: ChartConfig
  legend: ChartLegendItem[]
  isHidden: (key: string) => boolean
  toggle: (key: string) => void
}

/**
 * Resolves series colours, owns the reader's show / hide state and builds
 * the legend items, so every chart type gets identical legend behaviour.
 */
export function useChartSeries(
  input: readonly ChartSeries[],
  mark: LegendMark | ((series: ResolvedSeries) => LegendMark) = "dot",
): ChartSeriesModel {
  const series = useMemo(() => resolveSeries(input), [input])
  const allKeys = useMemo(() => series.map((item) => item.key), [series])
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(series.filter((item) => item.hidden).map((item) => item.key)),
  )

  const toggle = useCallback(
    (key: string) => setHidden((current) => toggleHidden(current, key, allKeys)),
    [allKeys],
  )

  return useMemo(() => {
    const isHidden = (key: string) => hidden.has(key)
    return {
      series,
      visible: series.filter((item) => !hidden.has(item.key)),
      config: toChartConfig(series),
      legend: series.map((item) => ({
        key: item.key,
        label: item.label,
        qualifier: item.qualifier,
        color: item.color,
        pattern: item.pattern,
        dashed: item.dashed,
        hidden: hidden.has(item.key),
        mark: typeof mark === "function" ? mark(item) : mark,
      })),
      isHidden,
      toggle,
    }
  }, [series, hidden, mark, toggle])
}
