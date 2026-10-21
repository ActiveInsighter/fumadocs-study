import { compile, evaluateValue, type Scope } from '../core/expr';
import { REGION_ORDER, SERIES_ORDER } from '../core/palette';
import {
  implicitCurve,
  sampleFunction,
  sampleParametric,
  type Range,
  type SliceMode,
  type Vec2,
} from '../core/sampling';
import type { MathPlot2DProps, NumberLike, PlotColor, PlotItem2D, RangeLike } from '../core/types';

export interface View {
  x: Range;
  y: Range;
}

export interface CurveModel {
  color: PlotColor;
  dashed: boolean;
  width: number;
  boundary: boolean;
  arrows: number;
  label?: string;
  labelAt: number;
  /** Sample for the current window; `pixels` is the window width in CSS px. */
  sample: (view: View, pixels: number) => Vec2[][];
}

export interface RegionModel {
  test: (x: number, y: number) => boolean;
  color: PlotColor;
  faint: boolean;
  opacity: number;
}

export interface PointModel {
  p: Vec2;
  color: PlotColor;
  label?: string;
  dir: number;
  open: boolean;
}

export interface SliceModel {
  mode: SliceMode;
  range: Range;
  label: string;
  pieces: { from: number; to: number; lo?: string; hi?: string; tex?: string }[];
}

export interface Model2D {
  view: View;
  regions: RegionModel[];
  curves: CurveModel[];
  points: PointModel[];
  domain: ((x: number, y: number) => boolean) | null;
  slices: SliceModel[];
  errors: string[];
}

export const DEFAULT_VIEW: View = { x: [-5, 5], y: [-3.5, 3.5] };

const TAU = Math.PI * 2;

export function resolveRange(range: RangeLike | undefined, fallback: Range, scope: Scope, params: string[]): Range {
  if (!range) return fallback;
  return [evaluateValue(range[0], scope, params), evaluateValue(range[1], scope, params)];
}

/** Default colour for the item at `index` among items of the same family. */
export function defaultColor(item: PlotItem2D, index: number): PlotColor {
  if (item.color) return item.color;
  if (item.type === 'region') return REGION_ORDER[index % REGION_ORDER.length];
  if (item.type === 'point') return 'ink';
  if (item.type === 'line') return 'gray';
  return SERIES_ORDER[index % SERIES_ORDER.length];
}

/** Assign default colours in document order (regions and curves cycle separately). */
export function assignColors(items: PlotItem2D[]): PlotColor[] {
  let regions = 0;
  let curves = 0;
  return items.map((item) => {
    if (item.type === 'region') return defaultColor(item, regions++);
    if (item.type === 'point' || item.type === 'line') return defaultColor(item, 0);
    return defaultColor(item, curves++);
  });
}

export function buildModel2D(props: MathPlot2DProps, values: Record<string, number>): Model2D {
  const params = (props.params ?? []).map((p) => p.name);
  const base: Scope = { ...values };
  const errors: string[] = [];
  const num = (v: NumberLike) => evaluateValue(v, base, params);
  const range = (r: RangeLike | undefined, fallback: Range) => resolveRange(r, fallback, base, params);
  const guard = <T>(what: string, build: () => T): T | null => {
    try {
      return build();
    } catch (error) {
      errors.push(`${what}：${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  };

  let view: View = DEFAULT_VIEW;
  guard('坐标窗口', () => {
    view = { x: range(props.x, DEFAULT_VIEW.x), y: range(props.y, DEFAULT_VIEW.y) };
  });

  const colors = assignColors(props.items ?? []);
  // Default label positions are staggered so neighbouring curves do not stack their labels.
  let labelled = 0;
  const nextLabelAt = (explicit: number | undefined, base: number) =>
    explicit ?? (base + 0.73 * labelled++) % 1;
  const regions: RegionModel[] = [];
  const curves: CurveModel[] = [];
  const points: PointModel[] = [];

  (props.items ?? []).forEach((item, index) => {
    const color = colors[index];
    const stroke = item as { dashed?: boolean; width?: number };
    const curveBase = {
      color,
      dashed: Boolean(stroke.dashed),
      width: stroke.width ?? 2.2,
      boundary: false,
      arrows: 0,
      label: item.label,
      labelAt: 0.85,
    };
    switch (item.type) {
      case 'function': {
        guard(`函数 ${item.fn}`, () => {
          const f = compile(item.fn, { params }).evaluate;
          const variable = item.of === 'y' ? 'y' : 'x';
          const scope: Scope = { ...base };
          const restrict = item.domain ? range(item.domain, [-Infinity, Infinity]) : null;
          const g = (s: number) => {
            scope[variable] = s;
            return f(scope);
          };
          curves.push({
            ...curveBase,
            boundary: Boolean(item.boundary),
            arrows: item.arrows ?? 0,
            labelAt: nextLabelAt(item.labelAt, 0.86),
            sample: (v, pixels) => {
              const window = variable === 'x' ? v.x : v.y;
              const other = variable === 'x' ? v.y : v.x;
              const lo = Math.max(window[0], restrict?.[0] ?? -Infinity);
              const hi = Math.min(window[1], restrict?.[1] ?? Infinity);
              if (!(hi > lo)) return [];
              const n = Math.min(4000, Math.max(200, Math.round(pixels * 1.5 * ((hi - lo) / (window[1] - window[0])))));
              const lines = sampleFunction(g, [lo, hi], n, other);
              return variable === 'x' ? lines : lines.map((line) => line.map(([s, w]) => [w, s] as Vec2));
            },
          });
        });
        break;
      }
      case 'parametric':
      case 'polar': {
        const what = item.type === 'parametric' ? `参数曲线 (${item.x}, ${item.y})` : `极坐标曲线 r=${item.r}`;
        guard(what, () => {
          const scope: Scope = { ...base };
          let point: (t: number) => Vec2;
          let tRange: Range;
          if (item.type === 'parametric') {
            const fx = compile(item.x, { params }).evaluate;
            const fy = compile(item.y, { params }).evaluate;
            tRange = range(item.t, [0, 1]);
            point = (t) => {
              scope.t = t;
              return [fx(scope), fy(scope)];
            };
          } else {
            const fr = compile(item.r, { params }).evaluate;
            tRange = range(item.theta, [0, TAU]);
            point = (t) => {
              scope.t = t;
              scope.theta = t;
              const r = fr(scope);
              return [r * Math.cos(t), r * Math.sin(t)];
            };
          }
          const samples = item.samples ?? 900;
          curves.push({
            ...curveBase,
            boundary: Boolean(item.boundary),
            arrows: item.arrows ?? 0,
            labelAt: nextLabelAt(item.labelAt, 0.5),
            sample: () => sampleParametric(point, tRange, samples),
          });
        });
        break;
      }
      case 'implicit': {
        guard(`隐函数 ${item.eq}`, () => {
          const F = compile(item.eq, { params }).evaluate;
          const scope: Scope = { ...base };
          const g = (x: number, y: number) => {
            scope.x = x;
            scope.y = y;
            scope.r = Math.hypot(x, y);
            scope.theta = Math.atan2(y, x);
            return F(scope);
          };
          curves.push({
            ...curveBase,
            boundary: Boolean(item.boundary),
            labelAt: nextLabelAt(item.labelAt, 0.2),
            sample: (v, pixels) => {
              const nx = Math.min(420, Math.max(80, Math.round(pixels / 2.5)));
              const ny = Math.max(40, Math.round((nx * (v.y[1] - v.y[0])) / (v.x[1] - v.x[0])));
              // Pad slightly so curves reach the window edges.
              const px = (v.x[1] - v.x[0]) * 0.01;
              const py = (v.y[1] - v.y[0]) * 0.01;
              return implicitCurve(g, [v.x[0] - px, v.x[1] + px], [v.y[0] - py, v.y[1] + py], nx, ny);
            },
          });
        });
        break;
      }
      case 'region': {
        guard(`区域 ${item.where}`, () => {
          const F = compile(item.where, { params }).evaluate;
          const scope: Scope = { ...base };
          regions.push({
            color,
            faint: Boolean(item.faint),
            opacity: item.opacity ?? 1,
            test: (x, y) => {
              scope.x = x;
              scope.y = y;
              scope.r = Math.hypot(x, y);
              scope.theta = Math.atan2(y, x);
              return F(scope) > 0;
            },
          });
        });
        break;
      }
      case 'point': {
        guard('点', () => {
          const p: Vec2 = [num(item.at[0]), num(item.at[1])];
          points.push({ p, color, label: item.label, dir: item.dir ?? 45, open: Boolean(item.open) });
        });
        break;
      }
      case 'segment': {
        guard('线段', () => {
          const a: Vec2 = [num(item.from[0]), num(item.from[1])];
          const b: Vec2 = [num(item.to[0]), num(item.to[1])];
          curves.push({
            ...curveBase,
            boundary: Boolean(item.boundary),
            arrows: item.arrows ?? 0,
            labelAt: item.labelAt ?? 0.5,
            // Subdivided so labels can find a visible anchor along the segment.
            sample: () => [subdivide(a, b, 24)],
          });
        });
        break;
      }
      case 'line': {
        guard('参考线', () => {
          const xv = item.x === undefined ? null : num(item.x);
          const yv = item.y === undefined ? null : num(item.y);
          curves.push({
            ...curveBase,
            dashed: item.dashed ?? true,
            width: item.width ?? 1.4,
            labelAt: item.labelAt ?? 0.92,
            sample: (v) => {
              const lines: Vec2[][] = [];
              if (xv !== null) lines.push(subdivide([xv, v.y[0]], [xv, v.y[1]], 40));
              if (yv !== null) lines.push(subdivide([v.x[0], yv], [v.x[1], yv], 40));
              return lines;
            },
          });
        });
        break;
      }
    }
  });

  let domain: Model2D['domain'] = null;
  if (props.domain) {
    guard(`积分区域 ${props.domain}`, () => {
      const F = compile(props.domain!, { params }).evaluate;
      const scope: Scope = { ...base };
      domain = (x, y) => {
        scope.x = x;
        scope.y = y;
        scope.r = Math.hypot(x, y);
        scope.theta = Math.atan2(y, x);
        return F(scope) > 0;
      };
    });
  } else {
    const filled = regions.filter((r) => !r.faint);
    if (filled.length) domain = (x, y) => filled.some((r) => r.test(x, y));
  }

  const slices: SliceModel[] = [];
  for (const slice of props.slices ?? []) {
    guard('切片', () => {
      slices.push({
        mode: slice.mode,
        range: range(slice.range, [0, 1]),
        label: slice.label ?? (slice.mode === 'x' ? 'X 型' : slice.mode === 'y' ? 'Y 型' : '极坐标'),
        pieces: (slice.pieces ?? []).map((piece) => ({
          from: num(piece.from),
          to: num(piece.to),
          lo: piece.lo,
          hi: piece.hi,
          tex: piece.tex,
        })),
      });
    });
  }

  return { view, regions, curves, points, domain, slices, errors };
}

function subdivide(a: Vec2, b: Vec2, n: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= n; i++) out.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
  return out;
}

/** Collect every TeX string of a 2D spec so the server can pre-render it. */
export function collectTex2D(props: MathPlot2DProps): string[] {
  const out = new Set<string>();
  for (const item of props.items ?? []) if (item.label) out.add(item.label);
  for (const param of props.params ?? []) out.add(param.label ?? param.name);
  for (const slice of props.slices ?? [])
    for (const piece of slice.pieces ?? []) {
      if (piece.tex) out.add(piece.tex);
      else out.add(pieceTex(slice.mode, piece.lo, piece.hi));
    }
  return [...out];
}

/** TeX for a slice piece: "x^2 \le y \le \sqrt x". */
export function pieceTex(mode: SliceMode, lo?: string, hi?: string) {
  const v = mode === 'x' ? 'y' : mode === 'y' ? 'x' : 'r';
  return `${lo ?? ''}${lo ? '\\le ' : ''}${v}${hi ? '\\le ' : ''}${hi ?? ''}`;
}
