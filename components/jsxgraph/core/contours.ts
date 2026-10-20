export type Range = [minimum: number, maximum: number];
export type Segment = [u1: number, v1: number, u2: number, v2: number];

// Edge pairs for each marching-squares case. Corners: 0=(u0,v0) 1=(u1,v0)
// 2=(u1,v1) 3=(u0,v1); edges: 0 bottom, 1 right, 2 top, 3 left.
const CASES: number[][][] = [
  [], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]],
  [[2, 3]], [[0, 2]], [[0, 1], [2, 3]], [[1, 2]], [[1, 3]], [[0, 1]], [[3, 0]], [],
];

/**
 * Zero set of g on a rectangle by marching squares with linear interpolation.
 * Cells touching a non-finite sample are skipped, so singularities and the
 * outside of a function's domain leave gaps instead of spurious lines.
 */
export function contourSegments(g: (u: number, v: number) => number, [u0, u1]: Range, [v0, v1]: Range, steps: number): Segment[] {
  const n = Math.max(2, Math.floor(steps));
  const du = (u1 - u0) / n, dv = (v1 - v0) / n;
  const values = new Float64Array((n + 1) * (n + 1));
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      let value: number;
      try { value = g(u0 + i * du, v0 + j * dv); } catch { value = NaN; }
      values[j * (n + 1) + i] = typeof value === 'number' ? value : NaN;
    }
  }
  const segments: Segment[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const corners = [values[j * (n + 1) + i], values[j * (n + 1) + i + 1], values[(j + 1) * (n + 1) + i + 1], values[(j + 1) * (n + 1) + i]];
      if (!corners.every(Number.isFinite)) continue;
      let index = corners.reduce((code, value, bit) => code | (value >= 0 ? 1 << bit : 0), 0);
      if (index === 0 || index === 15) continue;
      // Saddle cells: a non-negative centre joins the two non-negative corners.
      if ((index === 5 || index === 10) && corners[0] + corners[1] + corners[2] + corners[3] >= 0) index = 15 - index;
      const ua = u0 + i * du, va = v0 + j * dv;
      const point = (edge: number): [number, number] => {
        const [a, b] = [[0, 1], [1, 2], [3, 2], [0, 3]][edge];
        const fa = corners[a], fb = corners[b];
        const s = fa === fb ? 0.5 : Math.min(1, Math.max(0, fa / (fa - fb)));
        if (edge === 0) return [ua + s * du, va];
        if (edge === 1) return [ua + du, va + s * dv];
        if (edge === 2) return [ua + s * du, va + dv];
        return [ua, va + s * dv];
      };
      for (const [from, to] of CASES[index]) {
        const [p, q] = [point(from), point(to)];
        segments.push([p[0], p[1], q[0], q[1]]);
      }
    }
  }
  return segments;
}

/** Map parameter-space segments to 3D polyline data separated by NaN breaks. */
export function segmentsToPath(segments: Segment[], map: (u: number, v: number) => number[]): [number[], number[], number[]] {
  const X: number[] = [], Y: number[] = [], Z: number[] = [];
  for (const [ua, va, ub, vb] of segments) {
    const p = map(ua, va), q = map(ub, vb);
    if (!p.every(Number.isFinite) || !q.every(Number.isFinite)) continue;
    X.push(p[0], q[0], NaN); Y.push(p[1], q[1], NaN); Z.push(p[2], q[2], NaN);
  }
  return [X, Y, Z];
}
