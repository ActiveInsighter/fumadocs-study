/**
 * Scale helpers that Recharts does not provide: readable log ticks, padded
 * domains and a broken (compressed) value axis.
 */

export type Domain = readonly [number, number]

const LOG_MANTISSAS: readonly (readonly number[])[] = [
  [1],
  [1, 2, 5],
  [1, 2, 3, 5],
  [1, 1.5, 2, 3, 4, 5, 7],
]

/**
 * Ticks for a log axis using "human" mantissas (1-2-5, 1-1.5-2-3-4-5…).
 * Picks the sparsest mantissa set that still gives at least `minTicks`
 * ticks, then thins decades if there are more than `maxTicks`.
 */
export function logTicks(domain: Domain, { minTicks = 5, maxTicks = 8 } = {}): number[] {
  const [min, max] = domain
  if (!(min > 0) || !(max > min)) return []

  const startExponent = Math.floor(Math.log10(min))
  const endExponent = Math.ceil(Math.log10(max))
  const candidatesFor = (mantissas: readonly number[]) => {
    const ticks: number[] = []
    for (let exponent = startExponent; exponent <= endExponent; exponent += 1) {
      for (const mantissa of mantissas) {
        const value = roundSignificant(mantissa * 10 ** exponent)
        if (value >= min * 0.9999 && value <= max * 1.0001) ticks.push(value)
      }
    }
    return ticks
  }

  let best: number[] = []
  for (const mantissas of LOG_MANTISSAS) {
    best = candidatesFor(mantissas)
    if (best.length >= minTicks) break
  }

  if (best.length > maxTicks) {
    const step = Math.ceil(best.length / maxTicks)
    best = best.filter((_, index) => index % step === 0)
  }

  return best
}

/**
 * Extends a log domain outward to the nearest tick of the 1-1.5-2-3-4-5-7
 * sequence when that tick is close (within `reach`×), so the axis starts and
 * ends on a labelled value instead of an arbitrary padded number.
 */
export function snapLogDomain(domain: Domain, reach = 1.3): Domain {
  const [min, max] = domain
  if (!(min > 0) || !(max > min)) return domain
  const steps = LOG_MANTISSAS[LOG_MANTISSAS.length - 1]!
  const candidates: number[] = []
  for (let exponent = Math.floor(Math.log10(min)) - 1; exponent <= Math.ceil(Math.log10(max)) + 1; exponent += 1) {
    for (const mantissa of steps) candidates.push(roundSignificant(mantissa * 10 ** exponent))
  }
  const below = candidates.filter((value) => value <= min).at(-1)
  const above = candidates.find((value) => value >= max)
  return [below !== undefined && min / below <= reach ? below : min, above !== undefined && above / max <= reach ? above : max]
}

/** Expands a positive data range by `padding` (fraction of the log span) on both ends. */
export function paddedLogDomain(values: readonly number[], padding = 0.08): Domain {
  const positive = values.filter((value) => Number.isFinite(value) && value > 0)
  if (positive.length === 0) return [1, 10]

  let min = Math.min(...positive)
  let max = Math.max(...positive)
  if (min === max) {
    min /= 2
    max *= 2
  }

  const logMin = Math.log10(min)
  const logMax = Math.log10(max)
  const span = logMax - logMin
  return [roundSignificant(10 ** (logMin - span * padding)), roundSignificant(10 ** (logMax + span * padding))]
}

/** A "nice" linear domain that optionally includes zero. */
export function niceLinearDomain(
  values: readonly number[],
  { includeZero = true, tickCount = 5 }: { includeZero?: boolean; tickCount?: number } = {},
): Domain {
  const finite = values.filter(Number.isFinite)
  if (finite.length === 0) return [0, 1]

  let min = Math.min(...finite)
  let max = Math.max(...finite)
  if (includeZero) {
    min = Math.min(0, min)
    max = Math.max(0, max)
  }
  if (min === max) {
    max = min + 1
  }

  const step = niceStep((max - min) / tickCount)
  return [Math.floor(min / step) * step, Math.ceil(max / step) * step]
}

export function linearTicks(domain: Domain, tickCount = 5): number[] {
  const [min, max] = domain
  if (!(max > min)) return [min]
  const step = niceStep((max - min) / tickCount)
  const ticks: number[] = []
  for (let value = Math.ceil(min / step) * step; value <= max + step * 1e-9; value += step) {
    ticks.push(roundSignificant(value))
  }
  return ticks
}

export function niceStep(rough: number): number {
  if (!(rough > 0)) return 1
  const exponent = Math.floor(Math.log10(rough))
  const fraction = rough / 10 ** exponent
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10
  return nice * 10 ** exponent
}

function roundSignificant(value: number, digits = 12): number {
  return Number.parseFloat(value.toPrecision(digits))
}

/**
 * A value axis that starts at zero but compresses the empty band between zero
 * and `lower`, so a chart whose data lives in [48, 75] keeps an honest zero
 * baseline with a visible break mark instead of silently starting at 48.
 *
 * Values are mapped into plot units [0, 1]: zero sits at 0, `lower` at
 * `breakPosition`, `upper` at 1.
 */
export type BrokenScale = {
  lower: number
  upper: number
  breakPosition: number
  toPlot: (value: number) => number
  fromPlot: (plot: number) => number
}

export function createBrokenScale(lower: number, upper: number, breakPosition = 0.1): BrokenScale {
  const span = upper - lower || 1
  return {
    lower,
    upper,
    breakPosition,
    toPlot(value) {
      if (value <= lower) {
        return lower <= 0 ? 0 : Math.max(0, (value / lower) * breakPosition)
      }
      return breakPosition + ((value - lower) / span) * (1 - breakPosition)
    },
    fromPlot(plot) {
      if (plot <= breakPosition) return (plot / breakPosition) * lower
      return lower + ((plot - breakPosition) / (1 - breakPosition)) * span
    },
  }
}

/** Whether a value axis should break: data far from zero and zero requested. */
export function shouldBreakAxis(domain: Domain, threshold = 0.35): boolean {
  const [min, max] = domain
  return min > 0 && max > min && min / max > threshold
}
