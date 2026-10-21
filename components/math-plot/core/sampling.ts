/**
 * Pure numeric helpers for planar plots: curve sampling with asymptote
 * detection, marching squares for implicit curves, Fubini slices and areas.
 * No DOM access, so everything here is unit-tested in Node.
 */

export type Vec2 = [number, number];
export type Range = [number, number];

export function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

/**
 * Sample y = f(x) on [x0, x1] into polylines. A polyline is broken where the
 * function is undefined and at jump discontinuities: a large step between two
 * samples is bisected, and if it does not shrink with the interval it is a
 * jump ([x], sign x) or a pole (tan x, 1/x) rather than a steep stretch.
 */
export function sampleFunction(
  f: (x: number) => number,
  [x0, x1]: Range,
  samples: number,
  /** Visible y window, used to judge jumps and to clamp values for drawing. */
  [v0, v1]: Range,
): Vec2[][] {
  const span = v1 - v0;
  const lo = v0 - span * 8;
  const hi = v1 + span * 8;
  const clamp = (y: number) => Math.min(hi, Math.max(lo, y));
  const lines: Vec2[][] = [];
  let current: Vec2[] = [];
  const flush = () => {
    if (current.length > 1) lines.push(current);
    current = [];
  };
  const dx = (x1 - x0) / samples;
  const threshold = span * 0.012;
  let px = x0;
  let py = f(x0);
  if (Number.isFinite(py)) current.push([px, clamp(py)]);
  for (let i = 1; i <= samples; i++) {
    const x = x0 + dx * i;
    const y = f(x);
    if (!Number.isFinite(y)) {
      if (Number.isFinite(py)) {
        // Walk towards the edge of the natural domain (e.g. sqrt near 0).
        const edge = refineEdge(f, px, x);
        if (edge) current.push([edge[0], clamp(edge[1])]);
      }
      flush();
      px = x;
      py = y;
      continue;
    }
    if (!Number.isFinite(py)) {
      const edge = refineEdge(f, x, px);
      if (edge) current.push([edge[0], clamp(edge[1])]);
    } else if (Math.abs(y - py) > threshold) {
      const jump = findJump(f, px, py, x, y, threshold);
      if (jump) {
        current.push([jump[0], clamp(jump[1])]);
        flush();
        current.push([jump[2], clamp(jump[3])]);
      }
    }
    current.push([x, clamp(y)]);
    px = x;
    py = y;
  }
  flush();
  // A sample landing exactly on a pole leaves a sliver with no width; drop it.
  return lines.filter((line) => line[line.length - 1][0] - line[0][0] > dx * 0.5);
}

/**
 * Bisect [a, b] towards the largest step. Returns the two one-sided points of
 * a discontinuity, or null when the step shrinks (continuous but steep).
 */
function findJump(
  f: (x: number) => number,
  a: number,
  fa: number,
  b: number,
  fb: number,
  threshold: number,
): [number, number, number, number] | null {
  for (let k = 0; k < 40; k++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (!Number.isFinite(fm)) return [a, fa, b, fb];
    if (Math.abs(fm - fa) >= Math.abs(fb - fm)) {
      b = m;
      fb = fm;
    } else {
      a = m;
      fa = fm;
    }
    if (Math.abs(fb - fa) < threshold * 0.5) return null;
    if (b - a < 1e-12 * Math.max(1, Math.abs(a))) break;
  }
  return Math.abs(fb - fa) >= threshold * 0.5 ? [a, fa, b, fb] : null;
}

/** Bisect between a defined point `a` and an undefined point `b` to find the domain edge. */
function refineEdge(f: (x: number) => number, a: number, b: number): Vec2 | null {
  let lo = a;
  let hi = b;
  for (let k = 0; k < 30; k++) {
    const m = (lo + hi) / 2;
    if (Number.isFinite(f(m))) lo = m;
    else hi = m;
  }
  const y = f(lo);
  return Number.isFinite(y) ? [lo, y] : null;
}

/** Sample a parametric curve, breaking at undefined points. */
export function sampleParametric(f: (t: number) => Vec2, [t0, t1]: Range, samples: number): Vec2[][] {
  const lines: Vec2[][] = [];
  let current: Vec2[] = [];
  for (let i = 0; i <= samples; i++) {
    const p = f(t0 + ((t1 - t0) * i) / samples);
    if (Number.isFinite(p[0]) && Number.isFinite(p[1])) current.push(p);
    else {
      if (current.length > 1) lines.push(current);
      current = [];
    }
  }
  if (current.length > 1) lines.push(current);
  return lines;
}

/**
 * Marching squares for F(x, y) = 0. Crossing points are keyed by grid edge, so
 * neighbouring cells share them exactly and segments join into polylines
 * (labels and dashes then follow the curve).
 */
export function implicitCurve(
  F: (x: number, y: number) => number,
  [x0, x1]: Range,
  [y0, y1]: Range,
  nx: number,
  ny: number,
): Vec2[][] {
  const dx = (x1 - x0) / nx;
  const dy = (y1 - y0) / ny;
  const W = nx + 1;
  const values = new Float64Array(W * (ny + 1));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) values[j * W + i] = F(x0 + i * dx, y0 + j * dy);
  const at = (i: number, j: number) => values[j * W + i];
  const points = new Map<number, Vec2>();
  // Horizontal edge (i,j)-(i+1,j) has id 2·(j·W+i); vertical edge (i,j)-(i,j+1) has id 2·(j·W+i)+1.
  const crossing = (id: number): Vec2 => {
    let p = points.get(id);
    if (!p) {
      const k = id >> 1;
      const i = k % W;
      const j = (k - i) / W;
      const [i2, j2] = id & 1 ? [i, j + 1] : [i + 1, j];
      const va = at(i, j);
      const vb = at(i2, j2);
      const t = va / (va - vb);
      p = [x0 + (i + (i2 - i) * t) * dx, y0 + (j + (j2 - j) * t) * dy];
      points.set(id, p);
    }
    return p;
  };
  const segments: [number, number][] = [];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const v00 = at(i, j);
      const v10 = at(i + 1, j);
      const v11 = at(i + 1, j + 1);
      const v01 = at(i, j + 1);
      if (!(Number.isFinite(v00) && Number.isFinite(v10) && Number.isFinite(v11) && Number.isFinite(v01))) continue;
      const ids: number[] = [];
      // edges: bottom, right, top, left
      if (v00 > 0 !== v10 > 0) ids.push(2 * (j * W + i));
      if (v10 > 0 !== v11 > 0) ids.push(2 * (j * W + i + 1) + 1);
      if (v11 > 0 !== v01 > 0) ids.push(2 * ((j + 1) * W + i));
      if (v01 > 0 !== v00 > 0) ids.push(2 * (j * W + i) + 1);
      if (ids.length < 2) continue;
      // A sign change across a pole (1/x) shows a huge value inside the cell instead of a zero.
      const limit = 2 * Math.max(Math.abs(v00), Math.abs(v10), Math.abs(v11), Math.abs(v01));
      const centre = F(x0 + (i + 0.5) * dx, y0 + (j + 0.5) * dy);
      if (ids.length === 2) {
        const [a, b] = [crossing(ids[0]), crossing(ids[1])];
        const mid = F((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        if (!(Math.abs(mid) > limit)) segments.push([ids[0], ids[1]]);
      } else if (!(Math.abs(centre) > limit)) {
        // Saddle: decide by the centre value.
        if (centre > 0 === v00 > 0) segments.push([ids[0], ids[1]], [ids[2], ids[3]]);
        else segments.push([ids[0], ids[3]], [ids[1], ids[2]]);
      }
    }
  return joinSegments(segments).map((line) => line.map(crossing));
}

function joinSegments(segments: [number, number][]): number[][] {
  const byEnd = new Map<number, number[]>();
  segments.forEach(([a, b], index) => {
    for (const k of [a, b]) {
      const list = byEnd.get(k);
      if (list) list.push(index);
      else byEnd.set(k, [index]);
    }
  });
  const used = new Uint8Array(segments.length);
  const lines: number[][] = [];
  const extend = (line: number[], forward: boolean) => {
    for (;;) {
      const end = forward ? line[line.length - 1] : line[0];
      const next = (byEnd.get(end) ?? []).find((index) => !used[index]);
      if (next === undefined) return;
      used[next] = 1;
      const [a, b] = segments[next];
      const other = a === end ? b : a;
      if (forward) line.push(other);
      else line.unshift(other);
    }
  };
  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const line = [segments[i][0], segments[i][1]];
    extend(line, true);
    extend(line, false);
    lines.push(line);
  }
  return lines;
}

export type SliceMode = 'x' | 'y' | 'polar';

/** Point on a slice: x-slices are vertical lines x = c, y-slices horizontal, polar slices rays. */
export const slicePoint = (mode: SliceMode, c: number, s: number): Vec2 =>
  mode === 'x' ? [c, s] : mode === 'y' ? [s, c] : [s * Math.cos(c), s * Math.sin(c)];

/** Intervals of the slice parameter where the predicate holds (bisected edges). */
export function sliceIntervals(
  test: (x: number, y: number) => boolean,
  mode: SliceMode,
  c: number,
  [a, b]: Range,
  n = 900,
): Range[] {
  const at = (s: number) => {
    const [x, y] = slicePoint(mode, c, s);
    return test(x, y);
  };
  const out: Range[] = [];
  const edge = (lo: number, hi: number) => {
    const a0 = at(lo);
    for (let k = 0; k < 32; k++) {
      const m = (lo + hi) / 2;
      if (at(m) === a0) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  };
  let prev = at(a);
  let start = a;
  let ps = a;
  for (let i = 1; i <= n; i++) {
    const s = a + ((b - a) * i) / n;
    const cur = at(s);
    if (cur && !prev) start = edge(ps, s);
    else if (!cur && prev) out.push([start, edge(ps, s)]);
    prev = cur;
    ps = s;
  }
  if (prev) out.push([start, b]);
  return out.filter(([u, v]) => v - u > 1e-6);
}

/** Midpoint-grid area of a predicate over a window. */
export function regionArea(
  test: (x: number, y: number) => boolean,
  [x0, x1]: Range,
  [y0, y1]: Range,
  n = 480,
): number {
  const dx = (x1 - x0) / n;
  const dy = (y1 - y0) / n;
  let hits = 0;
  for (let j = 0; j < n; j++) {
    const y = y0 + (j + 0.5) * dy;
    for (let i = 0; i < n; i++) if (test(x0 + (i + 0.5) * dx, y)) hits++;
  }
  return hits * dx * dy;
}

/** Format a coordinate for readouts. */
export function formatNumber(v: number, digits = 3) {
  if (!Number.isFinite(v)) return '—';
  const r = Math.abs(v) < 5 * Math.pow(10, -digits - 1) ? 0 : v;
  const abs = Math.abs(r);
  if (abs >= 1e4 || (abs > 0 && abs < 1e-3)) return r.toExponential(2);
  return String(+r.toFixed(abs >= 100 ? 1 : digits));
}
