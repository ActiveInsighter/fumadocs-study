import { RESERVED } from './expression';

export interface PlotParameter {
  name: string;
  label?: string;
  min: number;
  max: number;
  value: number;
  step?: number;
}

export const MAX_PARAMETERS = 12;

/** Shared by 2D and 3D: coordinate variables and math functions cannot be parameters. */
export function validatePlotParameters(parameters: PlotParameter[]): void {
  if (!Array.isArray(parameters)) throw new Error('parameters 必须是参数数组。');
  if (parameters.length > MAX_PARAMETERS) throw new Error(`每个画板最多支持 ${MAX_PARAMETERS} 个参数。`);
  const names = new Set<string>();
  for (const parameter of parameters) {
    if (!parameter || typeof parameter !== 'object') throw new Error('参数必须包含名称、范围与初值。');
    const { name, min, max, value, step = 0.1 } = parameter;
    if (typeof name !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || RESERVED.has(name) || names.has(name)) throw new Error(`参数名 ${name} 无效、重复或与数学变量冲突。`);
    if (![min, max, value, step].every(Number.isFinite) || min >= max || !Number.isFinite(max - min) || value < min || value > max || step <= 0) throw new Error(`参数 ${name} 的范围、初值或步长无效。`);
    names.add(name);
  }
}

function decimalPlaces(value: number): number {
  const [coefficient, exponent = '0'] = String(value).toLowerCase().split('e');
  return Math.max(0, (coefficient.split('.')[1]?.length ?? 0) - Number(exponent));
}

/** Snap to the same min-anchored step grid as a native range input. */
export function parameterValue(value: number, parameter: PlotParameter): number {
  const { min, max, step = 0.1 } = parameter;
  const bounded = Math.min(max, Math.max(min, Number.isFinite(value) ? value : parameter.value));
  const stops = (max - min) / step;
  const position = (bounded - min) / step;
  // A small tolerance avoids moving 0.15 down to 0.1 because of binary rounding.
  const tolerance = (index: number) => Number.EPSILON * Math.max(1, Math.abs(index)) * 4;
  const index = Math.min(Math.floor(stops + tolerance(stops)), Math.max(0, Math.round(position + tolerance(position))));
  if (!Number.isFinite(index)) return bounded;
  const snapped = min + index * step;
  // Decimal-place rounding retains very small steps without leaking 0.30000000000000004.
  const precision = Math.max(decimalPlaces(min), decimalPlaces(step));
  const rounded = Number(precision <= 100 ? snapped.toFixed(precision) : snapped.toPrecision(15));
  return Math.min(max, Math.max(min, rounded));
}

/** Empty, partial and non-finite drafts preserve the last accepted value. */
export function commitParameterValue(draft: string, current: number, parameter: PlotParameter): number {
  const value = draft.trim() ? Number(draft) : NaN;
  return Number.isFinite(value) ? parameterValue(value, parameter) : current;
}

interface ParameterAnimationOptions {
  getValues: () => Record<string, number>;
  onChange: (values: Record<string, number>) => void;
  requestFrame: (callback: (time: number) => void) => number;
  cancelFrame: (frame: number) => void;
  isHidden: () => boolean;
}

/** Return an immediate, idempotent stop function for pause, reset and unmount. */
export function startParameterAnimation(parameter: PlotParameter, options: ParameterAnimationOptions): () => void {
  const { min, max, name } = parameter;
  const width = max - min;
  const initial = options.getValues()[name];
  let position = Math.min(max, Math.max(min, Number.isFinite(initial) ? initial : parameter.value));
  let direction = 1;
  let active = true;
  let frame: number;
  let previous: number | undefined;
  let last = -Infinity;
  function animate(time: number) {
    if (!active) return;
    const elapsed = previous === undefined ? 0 : Math.min(Math.max(0, time - previous), 150);
    previous = time;
    if (!options.isHidden()) {
      position += direction * (elapsed / 8000) * width;
      if (position > max) { position = max - (position - max); direction = -1; }
      if (position < min) { position = min + (min - position); direction = 1; }
      if (time - last >= 90) {
        last = time;
        const values = options.getValues();
        const next = parameterValue(position, parameter);
        if (!Object.is(values[name], next)) options.onChange({ ...values, [name]: next });
      }
    }
    if (active) frame = options.requestFrame(animate);
  }
  frame = options.requestFrame(animate);
  return () => {
    active = false;
    options.cancelFrame(frame);
  };
}

export function initialParameterValues(parameters: PlotParameter[]): Record<string, number> {
  return Object.fromEntries(parameters.map(({ name, value }) => [name, value]));
}
