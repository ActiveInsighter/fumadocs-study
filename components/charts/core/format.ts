import type { FormatPreset, FormatSpec, ValueFormat } from "./types"

export type Formatter = (value: number) => string

const DEFAULT_LOCALE = "zh-CN"

const presetSpecs: Record<FormatPreset, FormatSpec> = {
  number: { digits: 2 },
  integer: { digits: 0 },
  decimal: { digits: 2, minDigits: 1 },
  compact: { compact: true, digits: 1 },
  // Values already expressed in percent units (e.g. 52.6 → "52.6%").
  percent: { digits: 1, suffix: "%" },
  // Fractions (0.526 → "52.6%"); scaled in createFormatter.
  ratio: { digits: 1, suffix: "%" },
  usd: { prefix: "$", digits: 2 },
  cny: { prefix: "¥", digits: 2 },
  multiplier: { digits: 1, suffix: "×" },
  minutes: { digits: 0, suffix: " 分钟" },
  seconds: { digits: 1, suffix: " s" },
}

function toSpec(format: ValueFormat | undefined): FormatSpec & { preset: FormatPreset } {
  if (!format) return { preset: "number", ...presetSpecs.number }
  if (typeof format === "string") return { preset: format, ...presetSpecs[format] }
  const preset = format.preset ?? "number"
  return { ...presetSpecs[preset], ...format, preset }
}

/**
 * Builds a number formatter from a preset name or a small spec object.
 * Formatters never throw: non-finite input renders as an en dash so empty
 * cells and gaps read as "no value" rather than "0".
 */
export function createFormatter(format?: ValueFormat, locale = DEFAULT_LOCALE): Formatter {
  const spec = toSpec(format)
  const scale = spec.preset === "ratio" ? 100 : 1
  const numberFormat = new Intl.NumberFormat(locale, {
    maximumFractionDigits: spec.digits ?? 2,
    minimumFractionDigits: Math.min(spec.minDigits ?? 0, spec.digits ?? 2),
    notation: spec.compact ? "compact" : "standard",
    signDisplay: spec.signed ? "exceptZero" : "auto",
  })

  return (value: number) => {
    if (!Number.isFinite(value)) return "–"
    const formatted = numberFormat.format(value * scale)
    return `${spec.prefix ?? ""}${formatted}${spec.suffix ?? ""}`
  }
}

/** Axis ticks drop trailing precision that the data labels keep. */
export function createTickFormatter(format?: ValueFormat, locale = DEFAULT_LOCALE): Formatter {
  const spec = toSpec(format)
  return createFormatter(
    { ...spec, digits: Math.min(spec.digits ?? 2, spec.compact ? 1 : 2), minDigits: 0 },
    locale,
  )
}

export function formatValue(value: unknown, formatter: Formatter): string {
  if (typeof value === "number") return formatter(value)
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return formatter(Number(value))
  }
  if (value === null || value === undefined || value === "") return "–"
  return String(value)
}

export function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}
