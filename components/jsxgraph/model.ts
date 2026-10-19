import type { BoundingBox, FunctionPlotProps, PlotParameter } from './types';

export const DEFAULT_BOUNDING_BOX: BoundingBox = [-5, 5, 5, -5];
export const PLOT_COLORS = ['#2563eb', '#e11d48', '#0d9488', '#9333ea', '#d97706'];
const RESERVED = new Set(['x', 'y', 't', 'PI', 'E', 'pi', 'e', 'sin', 'cos', 'tan', 'exp', 'log', 'sqrt', 'abs', 'pow', 'min', 'max']);

export function validatePlotConfig({ plots, parameters = [], points = [], boundingBox = DEFAULT_BOUNDING_BOX, height = 420 }: FunctionPlotProps): void {
  if (boundingBox.length !== 4 || !boundingBox.every(Number.isFinite) || boundingBox[0] >= boundingBox[2] || boundingBox[3] >= boundingBox[1]) {
    throw new Error('boundingBox 必须是 [左, 上, 右, 下]，且左 < 右、下 < 上。');
  }
  if (!Number.isFinite(height) || height < 200 || height > 1200) throw new Error('height 必须在 200–1200 之间。');
  if (!plots.length || plots.length > 20) throw new Error('每个画板需要 1–20 条曲线。');
  const names = new Set<string>();
  for (const parameter of parameters) {
    const { name, min, max, value, step = 0.1 } = parameter;
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || RESERVED.has(name) || names.has(name)) throw new Error(`参数名 ${name} 无效、重复或与数学变量冲突。`);
    if (![min, max, value, step].every(Number.isFinite) || min >= max || value < min || value > max || step <= 0) throw new Error(`参数 ${name} 的范围、初值或步长无效。`);
    names.add(name);
  }
  for (const plot of plots) {
    const expressions = plot.type === 'parametric' ? [plot.x, plot.y] : [plot.expression];
    if (expressions.some((value) => !value?.trim() || value.length > 2000)) throw new Error('曲线表达式不能为空或超过 2000 字符。');
    const range = plot.type === 'parametric' ? plot.range : plot.type === 'function' ? plot.domain : undefined;
    if (range && (range.length !== 2 || !range.every(Number.isFinite) || range[0] >= range[1])) throw new Error('曲线范围必须是递增的两个有限数值。');
  }
  if (points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) throw new Error('点坐标必须是有限数值。');
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
