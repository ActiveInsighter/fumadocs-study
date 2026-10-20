import type { BoundingBox, FunctionPlotProps, PlotParameter } from './types';

export const DEFAULT_BOUNDING_BOX: BoundingBox = [-5, 5, 5, -5];
export const PLOT_COLORS = ['#2563eb', '#e11d48', '#0d9488', '#9333ea', '#d97706'];
const RESERVED = new Set([
  'x', 'y', 'z', 'u', 'v', 't', 'PI', 'E', 'pi', 'e', 'NaN', 'Infinity',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'exp', 'log', 'ln', 'log2', 'log10', 'sqrt', 'cbrt', 'abs', 'pow', 'min', 'max', 'hypot',
  'floor', 'ceil', 'round', 'trunc', 'sign', 'random', 'factorial', 'binomial',
  'true', 'false', 'null', 'undefined', 'this', 'return', 'function', 'var', 'let', 'const',
]);

/** Shared with the 3D components: coordinate variables and math functions cannot be parameters. */
export function validatePlotParameters(parameters: PlotParameter[]): void {
  if (!Array.isArray(parameters)) throw new Error('parameters 必须是参数数组。');
  const names = new Set<string>();
  for (const parameter of parameters) {
    if (!parameter || typeof parameter !== 'object') throw new Error('参数必须包含名称、范围与初值。');
    const { name, min, max, value, step = 0.1 } = parameter;
    if (typeof name !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || RESERVED.has(name) || names.has(name)) throw new Error(`参数名 ${name} 无效、重复或与数学变量冲突。`);
    if (![min, max, value, step].every(Number.isFinite) || min >= max || !Number.isFinite(max - min) || value < min || value > max || step <= 0) throw new Error(`参数 ${name} 的范围、初值或步长无效。`);
    names.add(name);
  }
}

export function validatePlotConfig({ plots, parameters = [], points = [], boundingBox = DEFAULT_BOUNDING_BOX, height = 420 }: FunctionPlotProps): void {
  if (!Array.isArray(boundingBox) || boundingBox.length !== 4 || !boundingBox.every(Number.isFinite) || boundingBox[0] >= boundingBox[2] || boundingBox[3] >= boundingBox[1]) {
    throw new Error('boundingBox 必须是 [左, 上, 右, 下]，且左 < 右、下 < 上。');
  }
  if (!Number.isFinite(height) || height < 200 || height > 1200) throw new Error('height 必须在 200–1200 之间。');
  if (!Array.isArray(plots) || !plots.length || plots.length > 20) throw new Error('每个画板需要 1–20 条曲线。');
  validatePlotParameters(parameters);
  for (const plot of plots) {
    if (!plot || !['function', 'implicit', 'parametric'].includes(plot.type)) throw new Error('曲线类型必须是 function、implicit 或 parametric。');
    const expressions = plot.type === 'parametric' ? [plot.x, plot.y] : [plot.expression];
    if (expressions.some((value) => typeof value !== 'string' || !value.trim() || value.length > 2000)) throw new Error('曲线表达式不能为空或超过 2000 字符。');
    if (plot.type === 'implicit') implicitExpression(plot.expression);
    const range = plot.type === 'parametric' ? plot.range : plot.type === 'function' ? plot.domain : undefined;
    if ((range !== undefined || plot.type === 'parametric') && (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isFinite) || range[0] >= range[1])) throw new Error('曲线范围必须是递增的两个有限数值。');
  }
  if (!Array.isArray(points) || points.some((point) => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) throw new Error('点坐标必须是有限数值。');
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

export function bindPlotExpression(evaluate: (...args: number[]) => number, coordinateCount: number, names: string[], getValues: () => Record<string, number>) {
  // JSXGraph appends a suspendUpdate flag while sampling curves. It must not
  // become a coordinate or replace the first live parameter.
  return (...args: number[]) => evaluate(...args.slice(0, coordinateCount), ...names.map((name) => getValues()[name]));
}

/** Accept f(x,y)=0 and lhs=rhs while leaving inequalities unsupported. */
export function implicitExpression(expression: string): string {
  const sides = expression.split('=');
  if (/[<>!]/.test(expression) || sides.length > 2 || sides.some((side) => !side.trim())) throw new Error('隐式曲线请使用 F(x,y) 或 左式=右式，不支持不等式。');
  return sides.length === 2 ? `(${sides[0]})-(${sides[1]})` : expression;
}
