"use client"

import { useMemo } from "react"

import { buildNiceHistogramBins } from "../study-chart-model"
import type { ChartDatum, ValueFormat } from "../core/types"
import { StudyBarChart } from "./bar-chart"
import type { BaseChartProps, ReferenceLineSpec } from "./shared"

export type StudyHistogramProps = BaseChartProps & {
  values: readonly number[]
  bins?: number
  /** Value-axis label (frequency by default). */
  yLabel?: string
  xLabel?: string
  /** Mark the sample mean with a reference line. */
  showMean?: boolean
  format?: ValueFormat
}

/** Distribution of raw samples, binned on the fly into equal, round-numbered bins. */
export function StudyHistogram({ values, bins = 10, yLabel = "频数", xLabel, showMean = false, ...props }: StudyHistogramProps) {
  const data = useMemo<ChartDatum[]>(() => buildNiceHistogramBins(values, bins).map((bin) => ({ ...bin })), [values, bins])
  const finite = values.filter(Number.isFinite)
  const mean = finite.length > 0 ? finite.reduce((sum, value) => sum + value, 0) / finite.length : undefined
  const meanBin = mean === undefined ? undefined : data.find((bin) => typeof bin.start === "number" && typeof bin.end === "number" && mean >= bin.start && mean <= bin.end)
  const referenceLines: ReferenceLineSpec[] =
    showMean && meanBin ? [{ axis: "x", value: String(meanBin.label), label: `均值 ${mean!.toFixed(1)}` }] : []

  return (
    <StudyBarChart
      {...props}
      contiguous
      data={data}
      referenceLines={referenceLines}
      series={[{ key: "count", label: yLabel }]}
      showLegend={false}
      xKey="label"
      xLabel={xLabel}
      yLabel={yLabel}
      format={{ preset: "integer" }}
    />
  )
}
