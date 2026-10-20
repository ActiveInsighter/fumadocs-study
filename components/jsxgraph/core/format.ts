/** Compact readouts: at most `digits` decimals, no -0, no exponent noise. */
export function formatNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '未定义';
  const rounded = Number(value.toFixed(digits));
  return (Object.is(rounded, -0) ? 0 : rounded).toLocaleString('en-US', { maximumFractionDigits: digits, useGrouping: false });
}

export const formatSpaceCoordinate = (value: number) => formatNumber(value, 4);

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
