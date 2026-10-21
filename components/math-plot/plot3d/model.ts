/**
 * Turns a <MathPlot3D> spec into plain geometry (typed arrays and polylines).
 * Pure and Three.js-free: the WebGL scene only uploads what is built here.
 */
import { compile, evaluateValue, type Scope } from '../core/expr';
import {
  type Box,
  clipDomain,
  constraintSolid,
  gridMesh,
  marchingTetrahedra,
  type Range,
  type TriangleSoup,
  type Vec3,
} from '../core/mesh';
import { SERIES_ORDER } from '../core/palette';
import { implicitCurve } from '../core/sampling';
import type { MathPlot3DProps, NumberLike, PlotColor, PlotItem3D, RangeLike } from '../core/types';

export interface MeshPart {
  positions: Float32Array;
  normals: Float32Array | null;
  indices: Uint32Array | null;
  color: PlotColor;
  /** Colour vertices by height using the theme ramp. */
  colormap: boolean;
  opacity: number;
  role: 'surface' | 'solid' | 'top' | 'wall' | 'floor';
  wireframe: boolean;
}

export interface LinePart {
  /** Polyline vertices, xyz interleaved. */
  points: number[];
  color: PlotColor | 'ink';
  /** Ramp position 0–1 overrides `color` (contours). */
  ramp?: number;
  width: number;
  opacity: number;
  dashed: boolean;
  role: 'grid' | 'contour' | 'curve' | 'rim';
  arrows?: number;
  tube?: boolean;
}

export interface Built3D {
  box: Box;
  meshes: MeshPart[];
  lines: LinePart[];
  points: { p: Vec3; color: PlotColor | 'ink'; label?: string }[];
  labels: { at: Vec3; tex: string }[];
  solids: ((x: number, y: number, z: number) => boolean)[];
  projection: ((x: number, y: number) => boolean) | null;
  /** Floor plane for projections and contours. */
  floorZ: number;
  errors: string[];
}

const DEFAULT_RANGE: Range = [-2, 2];
const TAU = Math.PI * 2;

export function assignColors3D(items: PlotItem3D[]): PlotColor[] {
  let n = 0;
  return items.map((item) => item.color ?? (item.type === 'point' ? 'ink' : SERIES_ORDER[n++ % SERIES_ORDER.length]) as PlotColor);
}

export function buildModel3D(props: MathPlot3DProps, values: Record<string, number>): Built3D {
  const params = (props.params ?? []).map((p) => p.name);
  const base: Scope = { ...values };
  const errors: string[] = [];
  const num = (v: NumberLike) => evaluateValue(v, base, params);
  const range = (r: RangeLike | undefined, fallback: Range): Range => (r ? [num(r[0]), num(r[1])] : fallback);
  const guard = (what: string, build: () => void) => {
    try {
      build();
    } catch (error) {
      errors.push(`${what}：${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const fn3 = (source: string) => {
    const f = compile(source, { params }).evaluate;
    const scope: Scope = { ...base };
    return (x: number, y: number, z: number) => {
      scope.x = x;
      scope.y = y;
      scope.z = z;
      scope.r = Math.hypot(x, y);
      scope.theta = Math.atan2(y, x);
      scope.rho = Math.hypot(x, y, z);
      return f(scope);
    };
  };
  const fn2 = (source: string) => {
    const f = fn3(source);
    return (x: number, y: number) => f(x, y, 0);
  };

  let box: Box = { x: DEFAULT_RANGE, y: DEFAULT_RANGE, z: DEFAULT_RANGE };
  guard('坐标范围', () => {
    box = { x: range(props.x, DEFAULT_RANGE), y: range(props.y, DEFAULT_RANGE), z: range(props.z, DEFAULT_RANGE) };
  });
  const autoZ = !props.z;
  const zSeen: number[] = [];

  const colors = assignColors3D(props.items ?? []);
  const meshes: MeshPart[] = [];
  const lines: LinePart[] = [];
  const points: Built3D['points'] = [];
  const labels: Built3D['labels'] = [];
  const solids: Built3D['solids'] = [];
  let projection: Built3D['projection'] = null;
  const pendingContours: { f: (x: number, y: number) => number; inside: ((x: number, y: number) => boolean) | null; x: Range; y: Range; count: number }[] = [];

  (props.items ?? []).forEach((item, index) => {
    const color = colors[index];
    switch (item.type) {
      case 'surface': {
        guard(`曲面 z=${item.z}`, () => {
          const f = fn2(item.z);
          const res = item.resolution ?? 72;
          let mesh: { positions: Float32Array; indices: Uint32Array | null; normals: Float32Array };
          let inside: ((x: number, y: number) => boolean) | null = null;
          let xr = range(item.x, box.x);
          let yr = range(item.y, box.y);
          if (item.r) {
            const rr = range(item.r, [0, 1]);
            const tr = range(item.theta, [0, TAU]);
            const g = gridMesh(
              (r, t) => {
                const c = Math.cos(t);
                const s = Math.sin(t);
                let z = f(r * c, r * s);
                // r = R on sqrt(R^2 - x^2 - y^2) can round to sqrt(-ε); step inside by a hair.
                if (!Number.isFinite(z) && r > 0) z = f(r * (1 - 1e-9) * c, r * (1 - 1e-9) * s);
                return [r * c, r * s, z];
              },
              rr,
              tr,
              Math.round(res / 2),
              res,
            );
            mesh = { ...g, normals: graphNormals(g.positions, f) };
            inside = (x, y) => {
              const r = Math.hypot(x, y);
              let t = Math.atan2(y, x);
              if (t < tr[0]) t += TAU;
              return r >= rr[0] && r <= rr[1] && t >= tr[0] && t <= tr[1];
            };
            xr = [-rr[1], rr[1]];
            yr = [-rr[1], rr[1]];
            lines.push(...polarGridLines(f, rr, tr));
          } else if (item.where) {
            const test = fn2(item.where);
            inside = (x, y) => test(x, y) > 0;
            const { triangles } = clipDomain(inside, xr, yr, res);
            const positions = new Float32Array(triangles.length * 9);
            let o = 0;
            for (const tri of triangles)
              for (const [x, y] of tri) {
                positions[o++] = x;
                positions[o++] = y;
                positions[o++] = f(x, y);
              }
            const keep = dropInvalidTriangles(positions);
            mesh = { positions: keep, indices: null, normals: graphNormals(keep, f) };
            lines.push(...cartesianGridLines(f, xr, yr, inside));
          } else {
            const g = gridMesh((x, y) => [x, y, f(x, y)], xr, yr, res, res);
            mesh = { ...g, normals: graphNormals(g.positions, f) };
            lines.push(...cartesianGridLines(f, xr, yr, null));
          }
          collectZ(mesh.positions, zSeen);
          meshes.push({
            positions: mesh.positions,
            indices: mesh.indices,
            normals: mesh.normals,
            color,
            colormap: item.colormap ?? true,
            opacity: item.opacity ?? 1,
            role: 'surface',
            wireframe: Boolean(item.wireframe),
          });
          if (item.contours) {
            pendingContours.push({ f, inside, x: xr, y: yr, count: typeof item.contours === 'number' ? item.contours : 10 });
          }
        });
        break;
      }
      case 'parametric': {
        guard(`参数曲面 (${item.x}, ${item.y}, ${item.z})`, () => {
          const scope: Scope = { ...base };
          const fx = compile(item.x, { params }).evaluate;
          const fy = compile(item.y, { params }).evaluate;
          const fz = compile(item.z, { params }).evaluate;
          const at = (u: number, v: number): Vec3 => {
            scope.u = u;
            scope.v = v;
            scope.t = u;
            scope.theta = u;
            scope.phi = v;
            return [fx(scope), fy(scope), fz(scope)];
          };
          const ur = range(item.u, [0, 1]);
          const vr = range(item.v, [0, 1]);
          const res = item.resolution ?? 64;
          const [nu, nv] = typeof res === 'number' ? [res, Math.max(16, Math.round(res * 0.75))] : res;
          const g = gridMesh(at, ur, vr, nu, nv);
          collectZ(g.positions, zSeen);
          meshes.push({
            positions: g.positions,
            indices: g.indices,
            normals: null,
            color,
            colormap: item.colormap ?? !item.color,
            opacity: item.opacity ?? 1,
            role: 'surface',
            wireframe: Boolean(item.wireframe),
          });
          lines.push(...parametricGridLines(at, ur, vr));
        });
        break;
      }
      case 'implicit': {
        guard(`隐式曲面 ${item.eq}`, () => {
          const F = fn3(item.eq);
          const soup = marchingTetrahedra(F, box, item.resolution ?? 52);
          meshes.push({
            positions: soup.positions,
            normals: soup.normals,
            indices: null,
            color,
            colormap: item.colormap ?? !item.color,
            opacity: item.opacity ?? 1,
            role: 'surface',
            wireframe: false,
          });
        });
        break;
      }
      case 'solid': {
        guard(`立体 ${item.where}`, () => {
          const compiled = compile(item.where, { params });
          const scope: Scope = { ...base };
          const bind = (x: number, y: number, z: number) => {
            scope.x = x;
            scope.y = y;
            scope.z = z;
            scope.r = Math.hypot(x, y);
            scope.theta = Math.atan2(y, x);
            scope.rho = Math.hypot(x, y, z);
            return scope;
          };
          const inside = (x: number, y: number, z: number) => compiled.evaluate(bind(x, y, z)) > 0;
          const constraints = compiled.constraints;
          const resolution = item.resolution ?? 56;
          // Inequality lists get exact creases; anything else (||, !) falls back to a sign field.
          const soup: TriangleSoup & { creases?: Float32Array } = constraints
            ? constraintSolid(
                constraints.map((g) => (x: number, y: number, z: number) => g(bind(x, y, z))),
                box,
                resolution,
              )
            : marchingTetrahedra((x, y, z) => (inside(x, y, z) ? -0.5 : 0.5), box, resolution, { closed: true });
          meshes.push({
            positions: soup.positions,
            normals: soup.normals,
            indices: null,
            color,
            colormap: false,
            opacity: item.opacity ?? 0.7,
            role: 'solid',
            wireframe: false,
          });
          if (soup.creases?.length)
            lines.push({ points: Array.from(soup.creases), color: 'ink', width: 1.6, opacity: 0.8, dashed: false, role: 'rim' });
          solids.push(inside);
          if (item.projection) {
            const zs = 40;
            projection = (x, y) => {
              for (let k = 0; k <= zs; k++) if (inside(x, y, box.z[0] + ((box.z[1] - box.z[0]) * k) / zs)) return true;
              return false;
            };
          }
        });
        break;
      }
      case 'cylinder': {
        guard(`曲顶柱体 z=${item.z}`, () => {
          const f = fn2(item.z);
          const test = fn2(item.where);
          const inside = (x: number, y: number) => test(x, y) > 0;
          const xr = range(item.x, box.x);
          const yr = range(item.y, box.y);
          const { triangles, boundary } = clipDomain(inside, xr, yr, item.resolution ?? 96);
          const top = new Float32Array(triangles.length * 9);
          const floor = new Float32Array(triangles.length * 9);
          let o = 0;
          for (const tri of triangles)
            for (const [x, y] of tri) {
              const z = finiteOr(f(x, y), 0);
              top[o] = x;
              top[o + 1] = y;
              top[o + 2] = z;
              floor[o] = x;
              floor[o + 1] = y;
              floor[o + 2] = 0;
              o += 3;
            }
          const wall = new Float32Array(boundary.length * 18);
          o = 0;
          const rim: number[] = [];
          for (const [a, b] of boundary) {
            const za = finiteOr(f(a[0], a[1]), 0);
            const zb = finiteOr(f(b[0], b[1]), 0);
            wall.set([a[0], a[1], 0, b[0], b[1], 0, b[0], b[1], zb, a[0], a[1], 0, b[0], b[1], zb, a[0], a[1], za], o);
            o += 18;
            rim.push(a[0], a[1], za, b[0], b[1], zb, a[0], a[1], 0, b[0], b[1], 0);
          }
          collectZ(top, zSeen);
          zSeen.push(0);
          meshes.push(
            { positions: floor, normals: null, indices: null, color, colormap: false, opacity: 0.32, role: 'floor', wireframe: false },
            { positions: wall, normals: null, indices: null, color, colormap: false, opacity: 0.26, role: 'wall', wireframe: false },
            { positions: top, normals: graphNormals(top, f), indices: null, color, colormap: true, opacity: 0.94, role: 'top', wireframe: false },
          );
          // Rim segments are stored pairwise; the scene draws them as line segments.
          lines.push({ points: rim, color: 'ink', width: 1.2, opacity: 0.7, dashed: false, role: 'rim' });
          // Registered as a solid too, so `volume` and `section` work for double integrals.
          solids.push((x, y, z) => {
            if (!inside(x, y)) return false;
            const top = f(x, y);
            return Number.isFinite(top) && z >= Math.min(0, top) && z <= Math.max(0, top);
          });
        });
        break;
      }
      case 'curve': {
        guard(`空间曲线 (${item.x}, ${item.y}, ${item.z})`, () => {
          const scope: Scope = { ...base };
          const fx = compile(item.x, { params }).evaluate;
          const fy = compile(item.y, { params }).evaluate;
          const fz = compile(item.z, { params }).evaluate;
          const [t0, t1] = range(item.t, [0, 1]);
          const pts: number[] = [];
          const N = 480;
          for (let i = 0; i <= N; i++) {
            scope.t = t0 + ((t1 - t0) * i) / N;
            const p = [fx(scope), fy(scope), fz(scope)];
            if (p.every(Number.isFinite)) pts.push(...p);
          }
          for (let i = 2; i < pts.length; i += 3) zSeen.push(pts[i]);
          lines.push({
            points: pts,
            color,
            width: 2.6,
            opacity: 1,
            dashed: Boolean(item.dashed),
            role: 'curve',
            arrows: item.arrows,
            tube: item.tube,
          });
          if (item.label && pts.length >= 3) {
            const mid = Math.floor(pts.length / 6) * 3;
            labels.push({ at: [pts[mid], pts[mid + 1], pts[mid + 2]], tex: item.label });
          }
        });
        break;
      }
      case 'point': {
        guard('点', () => {
          const p: Vec3 = [num(item.at[0]), num(item.at[1]), num(item.at[2])];
          points.push({ p, color, label: item.label });
          zSeen.push(p[2]);
        });
        break;
      }
    }
  });

  if (autoZ && zSeen.length) {
    const finite = zSeen.filter(Number.isFinite).sort((a, b) => a - b);
    if (finite.length) {
      // Use the full range unless a few extreme values (poles) would flatten the picture.
      let lo = finite[0];
      let hi = finite[finite.length - 1];
      const tlo = finite[Math.floor(finite.length * 0.01)];
      const thi = finite[Math.min(finite.length - 1, Math.ceil(finite.length * 0.99) - 1)];
      if (hi - lo > 4 * (thi - tlo)) {
        lo = tlo;
        hi = thi;
      }
      const pad = Math.max(1e-3, (hi - lo) * 0.06);
      box = { ...box, z: [Math.min(lo - pad, 0), Math.max(hi + pad, 0)] };
      if (box.z[1] - box.z[0] < 1e-6) box = { ...box, z: [box.z[0] - 1, box.z[1] + 1] };
    }
  }

  const floorZ = box.z[0];
  for (const c of pendingContours) lines.push(...contourLines(c.f, c.inside, c.x, c.y, c.count, floorZ));

  // Grid lines leaving the box are cut so they follow the clipped surface.
  const clipped = lines.map((line) => (line.role === 'grid' ? splitOutside(line, box) : [line])).flat();

  return { box, meshes, lines: clipped, points, labels, solids, projection, floorZ, errors };
}

function finiteOr(v: number, fallback: number) {
  return Number.isFinite(v) ? v : fallback;
}

function collectZ(positions: Float32Array, out: number[]) {
  const step = Math.max(1, Math.floor(positions.length / 3 / 4000));
  for (let i = 2; i < positions.length; i += 3 * step) out.push(positions[i]);
}

/** Drop triangles whose z is undefined (non-indexed soup). */
function dropInvalidTriangles(positions: Float32Array): Float32Array {
  const out: number[] = [];
  for (let i = 0; i < positions.length; i += 9) {
    const tri = positions.subarray(i, i + 9);
    if (tri.every(Number.isFinite)) out.push(...tri);
  }
  return Float32Array.from(out);
}

/** Normals of z = f(x, y) by central differences: (-f_x, -f_y, 1). */
/** Central difference, falling back to a one-sided one at the edge of the domain (e.g. a hemisphere rim). */
function slope(minus: number, centre: number, plus: number, h: number) {
  const okMinus = Number.isFinite(minus);
  const okPlus = Number.isFinite(plus);
  if (okMinus && okPlus) return (plus - minus) / (2 * h);
  if (okPlus) return (plus - centre) / h;
  if (okMinus) return (centre - minus) / h;
  return NaN;
}

function graphNormals(positions: Float32Array, f: (x: number, y: number) => number): Float32Array {
  const normals = new Float32Array(positions.length);
  const h = 1e-4;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const f0 = f(x, y);
    const fx = slope(f(x - h, y), f0, f(x + h, y), h);
    const fy = slope(f(x, y - h), f0, f(x, y + h), h);
    let nx = -fx;
    let ny = -fy;
    let nz = 1;
    const l = Math.hypot(nx, ny, nz);
    if (!Number.isFinite(l) || l === 0) {
      nx = 0;
      ny = 0;
      nz = 1;
    } else {
      nx /= l;
      ny /= l;
      nz /= l;
    }
    normals[i] = nx;
    normals[i + 1] = ny;
    normals[i + 2] = nz;
  }
  return normals;
}

const GRID_LINES = 10;

function cartesianGridLines(
  f: (x: number, y: number) => number,
  xr: Range,
  yr: Range,
  inside: ((x: number, y: number) => boolean) | null,
): LinePart[] {
  const out: LinePart[] = [];
  const N = 120;
  const push = (pts: number[]) => {
    if (pts.length >= 6) out.push({ points: pts, color: 'ink', width: 1, opacity: 0.2, dashed: false, role: 'grid' });
  };
  for (const axis of ['x', 'y'] as const) {
    const [a0, a1] = axis === 'x' ? xr : yr;
    const [b0, b1] = axis === 'x' ? yr : xr;
    for (let i = 0; i <= GRID_LINES; i++) {
      const a = a0 + ((a1 - a0) * i) / GRID_LINES;
      let pts: number[] = [];
      for (let j = 0; j <= N; j++) {
        const b = b0 + ((b1 - b0) * j) / N;
        const [x, y] = axis === 'x' ? [a, b] : [b, a];
        const z = f(x, y);
        if ((inside && !inside(x, y)) || !Number.isFinite(z)) {
          push(pts);
          pts = [];
          continue;
        }
        pts.push(x, y, z);
      }
      push(pts);
    }
  }
  return out;
}

function polarGridLines(f: (x: number, y: number) => number, rr: Range, tr: Range): LinePart[] {
  const out: LinePart[] = [];
  const line = (pts: number[]) => ({ points: pts, color: 'ink' as const, width: 1, opacity: 0.2, dashed: false, role: 'grid' as const });
  for (let i = 1; i <= 8; i++) {
    const r = rr[0] + ((rr[1] - rr[0]) * i) / 8;
    const pts: number[] = [];
    for (let j = 0; j <= 160; j++) {
      const t = tr[0] + ((tr[1] - tr[0]) * j) / 160;
      const x = r * Math.cos(t);
      const y = r * Math.sin(t);
      pts.push(x, y, f(x, y));
    }
    out.push(line(pts));
  }
  const spokes = Math.abs(tr[1] - tr[0] - TAU) < 1e-6 ? 12 : 8;
  for (let i = 0; i <= spokes; i++) {
    if (spokes === 12 && i === spokes) break;
    const t = tr[0] + ((tr[1] - tr[0]) * i) / spokes;
    const pts: number[] = [];
    for (let j = 0; j <= 60; j++) {
      const r = rr[0] + ((rr[1] - rr[0]) * j) / 60;
      const x = r * Math.cos(t);
      const y = r * Math.sin(t);
      pts.push(x, y, f(x, y));
    }
    out.push(line(pts));
  }
  return out;
}

function parametricGridLines(at: (u: number, v: number) => Vec3, ur: Range, vr: Range): LinePart[] {
  const out: LinePart[] = [];
  const push = (pts: number[]) => {
    if (pts.length >= 6) out.push({ points: pts, color: 'ink', width: 1, opacity: 0.2, dashed: false, role: 'grid' });
  };
  const trace = (fixed: 'u' | 'v', value: number, from: Range, n: number) => {
    let pts: number[] = [];
    for (let j = 0; j <= n; j++) {
      const s = from[0] + ((from[1] - from[0]) * j) / n;
      const p = fixed === 'u' ? at(value, s) : at(s, value);
      if (!p.every(Number.isFinite)) {
        push(pts);
        pts = [];
        continue;
      }
      pts.push(...p);
    }
    push(pts);
  };
  for (let i = 0; i <= 12; i++) trace('u', ur[0] + ((ur[1] - ur[0]) * i) / 12, vr, 96);
  for (let i = 0; i <= 8; i++) trace('v', vr[0] + ((vr[1] - vr[0]) * i) / 8, ur, 128);
  return out;
}

function contourLines(
  f: (x: number, y: number) => number,
  inside: ((x: number, y: number) => boolean) | null,
  xr: Range,
  yr: Range,
  count: number,
  z: number,
): LinePart[] {
  // Level range from a coarse sample of the domain.
  const values: number[] = [];
  for (let j = 0; j <= 40; j++)
    for (let i = 0; i <= 40; i++) {
      const x = xr[0] + ((xr[1] - xr[0]) * i) / 40;
      const y = yr[0] + ((yr[1] - yr[0]) * j) / 40;
      if (inside && !inside(x, y)) continue;
      const v = f(x, y);
      if (Number.isFinite(v)) values.push(v);
    }
  if (!values.length) return [];
  values.sort((a, b) => a - b);
  const lo = values[Math.floor(values.length * 0.02)];
  const hi = values[Math.ceil(values.length * 0.98) - 1];
  if (!(hi > lo)) return [];
  const out: LinePart[] = [];
  for (let k = 1; k <= count; k++) {
    const level = lo + ((hi - lo) * (k - 0.5)) / count;
    const curves = implicitCurve((x, y) => f(x, y) - level, xr, yr, 140, 140);
    for (const curve of curves) {
      let pts: number[] = [];
      for (const [x, y] of curve) {
        if (inside && !inside(x, y)) {
          if (pts.length >= 6) out.push(contour(pts, (k - 0.5) / count));
          pts = [];
          continue;
        }
        pts.push(x, y, z);
      }
      if (pts.length >= 6) out.push(contour(pts, (k - 0.5) / count));
    }
  }
  return out;
}

function contour(points: number[], ramp: number): LinePart {
  return { points, color: 'ink', ramp, width: 1.6, opacity: 0.9, dashed: false, role: 'contour' };
}

/** Split a polyline wherever it leaves the box (with a small tolerance). */
function splitOutside(line: LinePart, box: Box): LinePart[] {
  const tol = 1e-6;
  const ok = (x: number, y: number, z: number) =>
    x >= box.x[0] - tol && x <= box.x[1] + tol && y >= box.y[0] - tol && y <= box.y[1] + tol && z >= box.z[0] - tol && z <= box.z[1] + tol;
  const out: LinePart[] = [];
  let pts: number[] = [];
  for (let i = 0; i < line.points.length; i += 3) {
    const [x, y, z] = [line.points[i], line.points[i + 1], line.points[i + 2]];
    if (ok(x, y, z)) pts.push(x, y, z);
    else {
      if (pts.length >= 6) out.push({ ...line, points: pts });
      pts = [];
    }
  }
  if (pts.length >= 6) out.push({ ...line, points: pts });
  return out;
}

/** Collect every TeX string of a 3D spec so the server can pre-render it. */
export function collectTex3D(props: MathPlot3DProps): string[] {
  const out = new Set<string>();
  for (const item of props.items ?? []) if (item.label) out.add(item.label);
  for (const param of props.params ?? []) out.add(param.label ?? param.name);
  return [...out];
}
