import { contourSegments, segmentsToPath, type Segment } from '../core/contours';
import { compileNumeric, implicitExpression, normalizeExpression, validateExpressionText, validateNumeric, type ExpressionCompiler } from '../core/expression';
import { validatePlotParameters } from '../core/parameters';
import { QUADRICS, quadricImplicit, toWorld, type Placement, type QuadricValues, type Vector3 } from './quadrics';
import type { Axis, NumericRange, SpaceBox, SurfaceDefinition, SurfacePlotProps, SurfaceType } from './types';

export const DEFAULT_SPACE_BOX: SpaceBox = [[-3, 3], [-3, 3], [-3, 3]];
export const MAX_SURFACES = 6;
export const AXES: Axis[] = ['x', 'y', 'z'];
export const SURFACE_VIEWS = [
  { label: '立体', azimuth: 0.85, elevation: 0.45 },
  { label: '俯视 XY', azimuth: 0, elevation: Math.PI / 2 },
  { label: '正视 XZ', azimuth: 0, elevation: 0 },
  { label: '侧视 YZ', azimuth: Math.PI / 2, elevation: 0 },
] as const;

export const SURFACE_TITLES: Record<SurfaceType, string> = {
  surface: '曲面 z = f(x,y)',
  'parametric-surface': '参数曲面',
  'parametric-curve': '空间曲线',
  'implicit-surface': '隐式曲面',
  quadric: '二次曲面',
};

export function validateNumericRange(range: NumericRange, label: string): void {
  if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isFinite) || range[0] >= range[1] || !Number.isFinite(range[1] - range[0])) throw new Error(`${label}必须是递增的两个有限数值。`);
}

/** Editable formula fields; quadrics are edited through their own form. */
export function surfaceExpressions(plot: SurfaceDefinition): [label: string, expression: string][] {
  switch (plot.type) {
    case 'surface': return [['z(x,y)', plot.expression]];
    case 'implicit-surface': return [['F(x,y,z)', plot.expression]];
    case 'quadric': return [];
    default: return [['x', plot.x], ['y', plot.y], ['z', plot.z]];
  }
}

export function replaceSurfaceExpressions(plot: SurfaceDefinition, expressions: string[]): SurfaceDefinition {
  switch (plot.type) {
    case 'surface': return { ...plot, expression: expressions[0].replace(/^\s*z\s*=\s*/, '') };
    case 'implicit-surface': return { ...plot, expression: expressions[0] };
    case 'quadric': return plot;
    default: return { ...plot, x: expressions[0], y: expressions[1], z: expressions[2] };
  }
}

/** Probe inputs in the plot's own variables; implicit surfaces have none. */
export function surfaceRanges(plot: SurfaceDefinition, box: SpaceBox): NumericRange[] {
  switch (plot.type) {
    case 'surface': return plot.domain ?? [box[0], box[1]];
    case 'parametric-surface': return plot.ranges;
    case 'parametric-curve': return [plot.range];
    case 'quadric': return [[0, 1], [0, 1]];
    case 'implicit-surface': return [];
  }
}

export function probeVariables(plot: SurfaceDefinition): string[] {
  return plot.type === 'surface' ? ['x', 'y'] : plot.type === 'parametric-curve' ? ['t'] : plot.type === 'implicit-surface' ? [] : ['u', 'v'];
}

export function validateSurfaceDefinition(plot: SurfaceDefinition, box: SpaceBox): void {
  if (!plot || !Object.hasOwn(SURFACE_TITLES, plot.type)) throw new Error(`三维图像类型必须是 ${Object.keys(SURFACE_TITLES).join('、')} 之一。`);
  for (const [label, expression] of surfaceExpressions(plot)) validateExpressionText(expression, `三维表达式 ${label} `);
  if (plot.type === 'implicit-surface') implicitExpression(normalizeExpression(plot.expression));
  if (plot.type === 'quadric') {
    if (!Object.hasOwn(QUADRICS, plot.kind)) throw new Error(`二次曲面 kind 必须是 ${Object.keys(QUADRICS).join('、')} 之一。`);
    for (const name of ['a', 'b', 'c'] as const) {
      const value = plot[name];
      if (value === undefined) continue;
      validateNumeric(value, `二次曲面参数 ${name} `);
      if (typeof value === 'number' && value <= 0) throw new Error(`二次曲面参数 ${name} 必须为正数。`);
    }
    if (plot.axis !== undefined && !AXES.includes(plot.axis)) throw new Error('axis 请选择 x、y 或 z。');
    if (plot.center !== undefined) {
      if (!Array.isArray(plot.center) || plot.center.length !== 3) throw new Error('center 必须是 [x, y, z]。');
      plot.center.forEach((value) => validateNumeric(value, 'center 坐标'));
    }
    if (plot.extent !== undefined && (!Number.isFinite(plot.extent) || plot.extent <= 0 || plot.extent > 10)) throw new Error('extent 必须在 0–10 之间。');
    return;
  }
  const ranges = surfaceRanges(plot, box);
  if (!Array.isArray(ranges) || ranges.length !== (plot.type === 'parametric-curve' ? 1 : plot.type === 'implicit-surface' ? 0 : 2)) throw new Error('曲面需要两个参数范围，空间曲线需要一个参数范围。');
  ranges.forEach((range) => validateNumericRange(range, '定义域'));
}

export function validateSurfaceConfig({ plots, parameters = [], points = [], box = DEFAULT_SPACE_BOX, height = 500, mesh = 14, projection = 'parallel', section, opacity = 0.9 }: SurfacePlotProps): void {
  if (!Array.isArray(plots) || !plots.length || plots.length > MAX_SURFACES) throw new Error(`每个三维画板需要 1–${MAX_SURFACES} 个图像。`);
  if (!Array.isArray(box) || box.length !== 3) throw new Error('box 必须包含 x、y、z 三个坐标范围。');
  box.forEach((range) => validateNumericRange(range, '坐标范围'));
  if (!Number.isFinite(height) || height < 240 || height > 1200) throw new Error('height 必须在 240–1200 之间。');
  if (!Number.isInteger(mesh) || mesh < 8 || mesh > 40) throw new Error('mesh 必须是 8–40 之间的整数。');
  if (!['parallel', 'central'].includes(projection)) throw new Error('projection 请选择 parallel 或 central。');
  if (!Number.isFinite(opacity) || opacity < 0.2 || opacity > 1) throw new Error('opacity 必须在 0.2–1 之间。');
  if (section !== undefined && typeof section !== 'boolean') {
    if (!section || typeof section !== 'object' || (section.axis !== undefined && !AXES.includes(section.axis)) || (section.value !== undefined && !Number.isFinite(section.value))) throw new Error('section 请写成 true 或 { axis, value }。');
  }
  validatePlotParameters(parameters);
  for (const plot of plots) validateSurfaceDefinition(plot, box);
  if (!Array.isArray(points)) throw new Error('points 必须是点数组。');
  for (const point of points) {
    if (!point || typeof point !== 'object') throw new Error('点必须包含 x、y、z 坐标。');
    AXES.forEach((axis) => validateNumeric(point[axis], `点的 ${axis} 坐标`));
  }
}

const lerp = ([min, max]: NumericRange, s: number) => min + (max - min) * s;
const NAN3: Vector3 = [NaN, NaN, NaN];

/**
 * Compiled form of one plot. Native JSXGraph elements keep calling these
 * functions through a ref, so swapping a runtime redraws without rebuilding
 * the scene or losing the camera.
 */
export interface PlotRuntime {
  /** Sheets on the unit square; quadrics always expose two slots. */
  patches: ((s: number, t: number) => Vector3)[];
  /** Number of patches currently in use. */
  sheets: () => number;
  curve?: (t: number) => Vector3;
  /** F(x,y,z) whose zero set is the surface; used for slices and sections. */
  implicit?: (x: number, y: number, z: number) => number;
  /** Live values for quadric equations. */
  quadric?: () => { values: QuadricValues; placement: Placement };
}

/** Evaluate probe inputs (in the plot's own variables) to a point in space. */
export function evaluateProbe(plot: SurfaceDefinition, runtime: PlotRuntime, box: SpaceBox, fractions: number[]): Vector3 {
  try {
    if (plot.type === 'parametric-curve') return runtime.curve?.(fractions[0]) ?? NAN3;
    if (plot.type === 'implicit-surface') return NAN3;
    return runtime.patches[0](fractions[0], fractions[1]);
  } catch { return NAN3; }
}

export function createRuntime(plot: SurfaceDefinition, compile: ExpressionCompiler, box: SpaceBox, stamp: () => number = () => 0): PlotRuntime {
  // JSXGraph samples X, Y and Z separately at each vertex; reuse the triple
  // until the vertex or the parameter revision changes.
  const memo = (f: (s: number, t: number) => Vector3) => {
    let lastS = NaN, lastT = NaN, lastStamp = NaN, last: Vector3 = NAN3;
    return (s: number, t: number): Vector3 => {
      const now = stamp();
      if (s !== lastS || t !== lastT || now !== lastStamp) { lastS = s; lastT = t; lastStamp = now; last = f(s, t); }
      return last;
    };
  };
  if (plot.type === 'surface') {
    const f = compile(plot.expression.replace(/^\s*z\s*=\s*/, ''), ['x', 'y']);
    const [xr, yr] = plot.domain ?? [box[0], box[1]];
    const inside = (x: number, y: number) => x >= xr[0] && x <= xr[1] && y >= yr[0] && y <= yr[1];
    return {
      patches: [memo((s, t) => { const x = lerp(xr, s), y = lerp(yr, t); return [x, y, f(x, y)]; })],
      sheets: () => 1,
      implicit: (x, y, z) => inside(x, y) ? f(x, y) - z : NaN,
    };
  }
  if (plot.type === 'parametric-surface') {
    const [x, y, z] = [plot.x, plot.y, plot.z].map((expression) => compile(expression, ['u', 'v']));
    const [ur, vr] = plot.ranges;
    return { patches: [memo((s, t) => { const u = lerp(ur, s), v = lerp(vr, t); return [x(u, v), y(u, v), z(u, v)]; })], sheets: () => 1 };
  }
  if (plot.type === 'parametric-curve') {
    const [x, y, z] = [plot.x, plot.y, plot.z].map((expression) => compile(expression, ['t']));
    return { patches: [], sheets: () => 0, curve: (s) => { const t = lerp(plot.range, s); return [x(t), y(t), z(t)]; } };
  }
  if (plot.type === 'implicit-surface') {
    const F = compile(implicitExpression(normalizeExpression(plot.expression)), ['x', 'y', 'z']);
    return { patches: [], sheets: () => 0, implicit: (x, y, z) => F(x, y, z) };
  }
  const shape = QUADRICS[plot.kind];
  const [a, b, c] = (['a', 'b', 'c'] as const).map((name) => compileNumeric(plot[name] ?? 1, compile));
  const center = (plot.center ?? [0, 0, 0]).map((value) => compileNumeric(value, compile));
  const extent = plot.extent ?? shape.extent;
  const positive = (value: number) => Math.max(1e-6, Math.abs(value));
  let key = '';
  let cached: { values: QuadricValues; placement: Placement; sheets: ((s: number, t: number) => Vector3)[]; implicit: (x: number, y: number, z: number) => number } | null = null;
  const current = () => {
    const values = { a: positive(a()), b: positive(b()), c: positive(c()) };
    const placement: Placement = { axis: plot.axis ?? 'z', center: center.map((value) => value()) as Vector3 };
    const next = `${values.a},${values.b},${values.c},${placement.center.join(',')}`;
    if (!cached || next !== key) {
      key = next;
      cached = { values, placement, sheets: shape.patches(values, extent).map((patch) => (s, t) => toWorld(patch(s, t), placement)), implicit: quadricImplicit(plot.kind, values, placement) };
    }
    return cached;
  };
  return {
    patches: [0, 1].map((index) => memo((s, t) => current().sheets[index]?.(s, t) ?? NAN3)),
    sheets: () => current().sheets.length,
    implicit: (x, y, z) => current().implicit(x, y, z),
    quadric: () => { const { values, placement } = current(); return { values, placement }; },
  };
}

/** The two in-plane axes for a slice perpendicular to `axis`, in x, y, z order. */
export function planeAxes(axis: Axis): [number, number] {
  return axis === 'x' ? [1, 2] : axis === 'y' ? [0, 2] : [0, 1];
}

/** Zero set of F inside the plane `axis = level`, in in-plane coordinates. */
export function sliceSegments(F: (x: number, y: number, z: number) => number, axis: Axis, level: number, box: SpaceBox, steps: number): Segment[] {
  const index = AXES.indexOf(axis);
  const [p, q] = planeAxes(axis);
  return contourSegments((first, second) => {
    const point = [0, 0, 0];
    point[index] = level; point[p] = first; point[q] = second;
    return F(point[0], point[1], point[2]);
  }, box[p], box[q], steps);
}

/** Lift in-plane segments to 3D polyline data with NaN breaks. */
export function liftSegments(segments: Segment[], axis: Axis, level: number): [number[], number[], number[]] {
  const index = AXES.indexOf(axis);
  const [p, q] = planeAxes(axis);
  return segmentsToPath(segments, (first, second) => {
    const point = [0, 0, 0];
    point[index] = level; point[p] = first; point[q] = second;
    return point;
  });
}

/** Families of level curves that outline an implicit surface. */
export function implicitWireframe(F: (x: number, y: number, z: number) => number, box: SpaceBox, slices: number, steps: number): [number[], number[], number[]] {
  const X: number[] = [], Y: number[] = [], Z: number[] = [];
  AXES.forEach((axis, index) => {
    const [min, max] = box[index];
    for (let i = 0; i < slices; i++) {
      const level = min + ((i + 0.5) * (max - min)) / slices;
      const [x, y, z] = liftSegments(sliceSegments(F, axis, level, box, steps), axis, level);
      X.push(...x); Y.push(...y); Z.push(...z);
    }
  });
  return [X, Y, Z];
}

/**
 * Section of a parametric surface: the zero set of one coordinate minus the
 * level, found in the parameter square and mapped back onto the surface.
 */
export function patchSection(patch: (s: number, t: number) => Vector3, axis: Axis, level: number, steps: number): { path: [number[], number[], number[]]; segments: Segment[] } {
  const index = AXES.indexOf(axis);
  const [p, q] = planeAxes(axis);
  const parameterSegments = contourSegments((s, t) => patch(s, t)[index] - level, [0, 1], [0, 1], steps);
  const path = segmentsToPath(parameterSegments, (s, t) => patch(s, t));
  const segments: Segment[] = [];
  for (let i = 0; i + 2 < path[0].length; i += 3) {
    const start = [path[0][i], path[1][i], path[2][i]], end = [path[0][i + 1], path[1][i + 1], path[2][i + 1]];
    segments.push([start[p], start[q], end[p], end[q]]);
  }
  return { path, segments };
}

/** Fit finite samples, preserving the graph's actual coordinate values. */
export function fitSurfaceBox(plots: SurfaceDefinition[], runtimes: PlotRuntime[], shown: boolean[], box: SpaceBox): SpaceBox {
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  const include = (point: number[]) => {
    if (!point.every(Number.isFinite)) return;
    point.forEach((value, axis) => { minimum[axis] = Math.min(minimum[axis], value); maximum[axis] = Math.max(maximum[axis], value); });
  };
  plots.forEach((plot, index) => {
    const runtime = runtimes[index];
    if (!shown[index] || !runtime) return;
    if (plot.type === 'implicit-surface') {
      const [X, Y, Z] = implicitWireframe(runtime.implicit!, box, 6, 24);
      X.forEach((x, i) => include([x, Y[i], Z[i]]));
      return;
    }
    if (runtime.curve) {
      for (let i = 0; i <= 120; i++) { try { include(runtime.curve(i / 120)); } catch { /* skip singular samples */ } }
      return;
    }
    for (let sheet = 0; sheet < runtime.sheets(); sheet++) {
      for (let i = 0; i <= 16; i++) for (let j = 0; j <= 16; j++) {
        try { include(runtime.patches[sheet](i / 16, j / 16)); } catch { /* skip singular samples */ }
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
