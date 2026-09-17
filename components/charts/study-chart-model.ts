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

function formatRange(start: number, end: number): string {
  const format = (value: number) =>
    Number.isInteger(value)
      ? String(value)
      : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")

  return start === end ? format(start) : `${format(start)}–${format(end)}`
}
