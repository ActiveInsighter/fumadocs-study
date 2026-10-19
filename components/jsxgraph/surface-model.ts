import type { NumericRange, SpaceBox, SurfaceDefinition, SurfacePlotProps } from './surface-types';
import { validatePlotParameters } from './model';

export const DEFAULT_SPACE_BOX: SpaceBox = [[-3, 3], [-3, 3], [-3, 3]];
export const SURFACE_VIEWS = [
  { label: '立体视角', azimuth: 0.85, elevation: 0.45 },
  { label: '俯视 XY', azimuth: 0, elevation: Math.PI / 2 },
  { label: '正视 XZ', azimuth: 0, elevation: 0 },
  { label: '侧视 YZ', azimuth: Math.PI / 2, elevation: 0 },
] as const;

export function validateNumericRange(range: NumericRange, label: string): void {
  if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isFinite) || range[0] >= range[1] || !Number.isFinite(range[1] - range[0])) throw new Error(`${label}必须是递增的两个有限数值。`);
}

export function surfaceExpressions(plot: SurfaceDefinition): [label: string, expression: string][] {
  if (plot.type === 'surface') return [['z(x,y)', plot.expression]];
  return [['x', plot.x], ['y', plot.y], ['z', plot.z]];
}

export function surfaceRanges(plot: SurfaceDefinition, box: SpaceBox): NumericRange[] {
  if (plot.type === 'surface') return plot.domain ?? [box[0], box[1]];
  return plot.type === 'parametric-surface' ? plot.ranges : [plot.range];
}

export function validateSurfaceConfig({ plots, parameters = [], box = DEFAULT_SPACE_BOX, height = 500, mesh = 14, projection = 'parallel' }: SurfacePlotProps): void {
  if (!Array.isArray(plots) || !plots.length || plots.length > 6) throw new Error('每个三维画板需要 1–6 个图像。');
  if (!Array.isArray(box) || box.length !== 3) throw new Error('box 必须包含 x、y、z 三个坐标范围。');
  box.forEach((range) => validateNumericRange(range, '坐标范围'));
  if (!Number.isFinite(height) || height < 240 || height > 1200) throw new Error('height 必须在 240–1200 之间。');
  if (!Number.isInteger(mesh) || mesh < 8 || mesh > 32) throw new Error('mesh 必须是 8–32 之间的整数。');
  if (!['parallel', 'central'].includes(projection)) throw new Error('projection 请选择 parallel 或 central。');
  validatePlotParameters(parameters);
  if (parameters.length > 12) throw new Error('每个画板最多支持 12 个参数。');
  for (const plot of plots) {
    if (!plot || !['surface', 'parametric-surface', 'parametric-curve'].includes(plot.type)) throw new Error('三维图像类型必须是 surface、parametric-surface 或 parametric-curve。');
    if (surfaceExpressions(plot).some(([, expression]) => typeof expression !== 'string' || !expression.trim() || expression.length > 2000)) throw new Error('三维表达式不能为空或超过 2000 字符。');
    const ranges = surfaceRanges(plot, box);
    if (!Array.isArray(ranges) || ranges.length !== (plot.type === 'parametric-curve' ? 1 : 2)) throw new Error('曲面需要两个参数范围，空间曲线需要一个参数范围。');
    ranges.forEach((range) => validateNumericRange(range, '定义域'));
  }
}

export type SurfaceEvaluator = (...coordinates: number[]) => [number, number, number];
export type ExpressionCompiler = (expression: string, variables: string[]) => (...coordinates: number[]) => number;

/** Fit finite samples, preserving the graph's actual coordinate values. */
export function fitSurfaceBox(plots: SurfaceDefinition[], evaluators: SurfaceEvaluator[], shown: boolean[], box: SpaceBox): SpaceBox {
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  plots.forEach((plot, index) => {
    if (!shown[index] || !evaluators[index]) return;
    const ranges = surfaceRanges(plot, box);
    const steps = plot.type === 'parametric-curve' ? 100 : 14;
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= (ranges.length === 1 ? 0 : steps); j++) {
        const input = ranges.map(([min, max], axis) => min + (max - min) * (axis === 0 ? i : j) / steps);
        let point: number[];
        try { point = evaluators[index](...input); } catch { continue; }
        if (!point.every(Number.isFinite)) continue;
        point.forEach((value, axis) => { minimum[axis] = Math.min(minimum[axis], value); maximum[axis] = Math.max(maximum[axis], value); });
      }
    }
  });
  if (!minimum.every(Number.isFinite)) throw new Error('没有可适应的有限坐标，请先显示至少一个有效图像。');
  const scale = Math.max(...maximum.map((value, axis) => value - minimum[axis]), 1);
  const result = minimum.map((min, axis) => {
    const center = (min + maximum[axis]) / 2;
    const span = Math.max(maximum[axis] - min, scale * 0.1);
    return [center - span * 0.6, center + span * 0.6] as NumericRange;
  }) as SpaceBox;
  result.forEach((range) => validateNumericRange(range, '采样范围'));
  return result;
}

/** The native 3D elements keep calling this evaluator; swapping its ref preserves the scene. */
export function createSurfaceEvaluator(plot: SurfaceDefinition, compile: ExpressionCompiler): SurfaceEvaluator {
  if (plot.type === 'surface') {
    const z = compile(plot.expression, ['x', 'y']);
    return (x, y) => [x, y, z(x, y)];
  }
  const variables = plot.type === 'parametric-curve' ? ['t'] : ['u', 'v'];
  const x = compile(plot.x, variables);
  const y = compile(plot.y, variables);
  const z = compile(plot.z, variables);
  return (...coordinates) => [x(...coordinates), y(...coordinates), z(...coordinates)];
}

export function replaceSurfaceExpressions(plot: SurfaceDefinition, expressions: string[]): SurfaceDefinition {
  if (plot.type === 'surface') return { ...plot, expression: expressions[0] };
  return { ...plot, x: expressions[0], y: expressions[1], z: expressions[2] };
}

export function formatSpaceCoordinate(value: number): string {
  if (!Number.isFinite(value)) return '未定义';
  const rounded = Number(value.toFixed(4));
  return (Object.is(rounded, -0) ? 0 : rounded).toLocaleString('en-US', { maximumFractionDigits: 4, useGrouping: false });
}
