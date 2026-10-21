import { niceStep } from "./core/scales"

export type HistogramBin = {
  label: string
  count: number
  start: number
  end: number
}

export function buildHistogramBins(
  values: readonly number[],
  binCount = 10,
): HistogramBin[] {
  const finiteValues = values.filter(Number.isFinite)
  if (finiteValues.length === 0 || binCount <= 0) return []

  const minimum = Math.min(...finiteValues)
  const maximum = Math.max(...finiteValues)

  if (minimum === maximum) {
    return [
      {
        label: formatRange(minimum, maximum),
        count: finiteValues.length,
        start: minimum,
        end: maximum,
      },
    ]
  }

  const width = (maximum - minimum) / binCount
  const bins = Array.from({ length: binCount }, (_, index) => {
    const start = minimum + width * index
    const end =
      index === binCount - 1 ? maximum : minimum + width * (index + 1)

    return {
      label: formatRange(start, end),
      count: 0,
      start,
      end,
    }
  })

  finiteValues.forEach((value) => {
    const rawIndex = Math.floor((value - minimum) / width)
    const index = Math.min(binCount - 1, Math.max(0, rawIndex))
    const bin = bins[index]
    if (bin) bin.count += 1
  })

  return bins
}

/**
 * Histogram bins on "nice" boundaries (5, 10, 20…) close to `targetBins`, so
 * labels read 60–65 instead of 62.86–67.71. The last bin is closed.
 */
export function buildNiceHistogramBins(
  values: readonly number[],
  targetBins = 10,
): HistogramBin[] {
  const finiteValues = values.filter(Number.isFinite)
  if (finiteValues.length === 0 || targetBins <= 0) return []

  const minimum = Math.min(...finiteValues)
  const maximum = Math.max(...finiteValues)
  if (minimum === maximum) return buildHistogramBins(finiteValues, 1)

  const step = niceStep((maximum - minimum) / targetBins)
  const start = Math.floor(minimum / step) * step
  const count = Math.max(1, Math.ceil((maximum - start) / step + 1e-9))
  const bins = Array.from({ length: count }, (_, index) => {
    const binStart = roundTo(start + step * index, step)
    const binEnd = roundTo(start + step * (index + 1), step)
    return { label: formatRange(binStart, binEnd), count: 0, start: binStart, end: binEnd }
  })

  finiteValues.forEach((value) => {
    const index = Math.min(count - 1, Math.max(0, Math.floor((value - start) / step + 1e-9)))
    bins[index]!.count += 1
  })

  return bins
}

function roundTo(value: number, step: number): number {
  const digits = Math.max(0, -Math.floor(Math.log10(step)) + 1)
  return Number(value.toFixed(digits))
}

function formatRange(start: number, end: number): string {
  const format = (value: number) =>
    Number.isInteger(value)
      ? String(value)
      : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")

  return start === end ? format(start) : `${format(start)}–${format(end)}`
}
