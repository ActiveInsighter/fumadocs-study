/**
 * Pure geometry for the 3D plots. Produces plain typed arrays that the Three.js
 * scene turns into buffers; no Three.js import here, so this is unit-tested in
 * Node and does not enlarge the 2D bundle.
 */

export type Vec3 = [number, number, number];
export type Range = [number, number];
export interface Box {
  x: Range;
  y: Range;
  z: Range;
}

export interface IndexedMesh {
  positions: Float32Array;
  indices: Uint32Array;
}

/** Triangulate a parametric patch; triangles touching undefined points are dropped. */
export function gridMesh(
  f: (u: number, v: number) => Vec3,
  [u0, u1]: Range,
  [v0, v1]: Range,
  nu: number,
  nv: number,
): IndexedMesh {
  const positions = new Float32Array((nu + 1) * (nv + 1) * 3);
  const valid = new Uint8Array((nu + 1) * (nv + 1));
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      const k = j * (nu + 1) + i;
      const p = f(u0 + ((u1 - u0) * i) / nu, v0 + ((v1 - v0) * j) / nv);
      const ok = Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2]);
      valid[k] = ok ? 1 : 0;
      positions[k * 3] = ok ? p[0] : 0;
      positions[k * 3 + 1] = ok ? p[1] : 0;
      positions[k * 3 + 2] = ok ? p[2] : 0;
    }
  const indices: number[] = [];
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      const b = a + 1;
      const c = a + nu + 1;
      const d = c + 1;
      if (valid[a] && valid[b] && valid[d]) indices.push(a, b, d);
      if (valid[a] && valid[d] && valid[c]) indices.push(a, d, c);
    }
  return { positions, indices: Uint32Array.from(indices) };
}

type P2 = [number, number];

export interface ClippedDomain {
  /** Triangles (x, y) covering the domain, boundary cells clipped exactly. */
  triangles: [P2, P2, P2][];
  /** Boundary segments of the domain. */
  boundary: [P2, P2][];
}

/**
 * Marching triangles over a planar predicate: interior cells are kept whole,
 * boundary cells are clipped against the predicate by bisection. Used for the
 * curved-top cylinder and for surfaces restricted by a `where` predicate.
 */
export function clipDomain(
  inside: (x: number, y: number) => boolean,
  [x0, x1]: Range,
  [y0, y1]: Range,
  n: number,
): ClippedDomain {
  const dx = (x1 - x0) / n;
  const dy = (y1 - y0) / n;
  const ins: boolean[] = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) ins.push(inside(x0 + i * dx, y0 + j * dy));
  const cross = (a: P2, b: P2): P2 => {
    // a inside, b outside
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 16; k++) {
      const m = (lo + hi) / 2;
      if (inside(a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m)) lo = m;
      else hi = m;
    }
    const m = (lo + hi) / 2;
    return [a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m];
  };
  const triangles: [P2, P2, P2][] = [];
  const boundary: [P2, P2][] = [];
  const tri = (P: P2[], I: boolean[]) => {
    const count = I.filter(Boolean).length;
    if (count === 0) return;
    if (count === 3) {
      triangles.push([P[0], P[1], P[2]]);
      return;
    }
    const poly: P2[] = [];
    const cuts: P2[] = [];
    for (let k = 0; k < 3; k++) {
      const a = P[k];
      const b = P[(k + 1) % 3];
      const ia = I[k];
      const ib = I[(k + 1) % 3];
      if (ia) poly.push(a);
      if (ia !== ib) {
        const q = ia ? cross(a, b) : cross(b, a);
        poly.push(q);
        cuts.push(q);
      }
    }
    for (let k = 1; k < poly.length - 1; k++) triangles.push([poly[0], poly[k], poly[k + 1]]);
    if (cuts.length === 2) boundary.push([cuts[0], cuts[1]]);
  };
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = j * (n + 1) + i;
      const A: P2 = [x0 + i * dx, y0 + j * dy];
      const B: P2 = [A[0] + dx, A[1]];
      const C: P2 = [A[0], A[1] + dy];
      const D: P2 = [A[0] + dx, A[1] + dy];
      tri([A, B, D], [ins[k], ins[k + 1], ins[k + n + 2]]);
      tri([A, D, C], [ins[k], ins[k + n + 2], ins[k + n + 1]]);
    }
  // Edges of the window itself also bound the domain when the region touches it.
  const edgeRuns = (fixed: 'x' | 'y', value: number, from: number, to: number, step: number) => {
    for (let s = from; s < to - 1e-12; s += step) {
      const a: P2 = fixed === 'x' ? [value, s] : [s, value];
      const b: P2 = fixed === 'x' ? [value, s + step] : [s + step, value];
      const ia = inside(a[0], a[1]);
      const ib = inside(b[0], b[1]);
      if (ia && ib) boundary.push([a, b]);
      else if (ia) boundary.push([a, cross(a, b)]);
      else if (ib) boundary.push([cross(b, a), b]);
    }
  };
  edgeRuns('x', x0, y0, y1, dy);
  edgeRuns('x', x1, y0, y1, dy);
  edgeRuns('y', y0, x0, x1, dx);
  edgeRuns('y', y1, x0, x1, dx);
  return { triangles, boundary };
}

export interface TriangleSoup {
  positions: Float32Array;
  normals: Float32Array;
}

// Six tetrahedra sharing the cube diagonal 0–6.
const CORNERS: Vec3[] = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];
const TETS = [
  [0, 1, 2, 6],
  [0, 2, 3, 6],
  [0, 3, 7, 6],
  [0, 7, 4, 6],
  [0, 4, 5, 6],
  [0, 5, 1, 6],
];

/**
 * Marching tetrahedra for F(x, y, z) = 0 inside a box (F < 0 is "inside").
 * Triangles are wound so their face normal follows ∇F; vertex normals use ∇F
 * unless it disagrees strongly with the face (sharp edges of solids).
 */
export function marchingTetrahedra(
  F: (x: number, y: number, z: number) => number,
  box: Box,
  n: number | Vec3,
  options: { closed?: boolean; smooth?: boolean } = {},
): TriangleSoup {
  const [nx, ny, nz] = typeof n === 'number' ? [n, n, n] : n;
  const pad = options.closed ? 1 : 0;
  const dx = (box.x[1] - box.x[0]) / nx;
  const dy = (box.y[1] - box.y[0]) / ny;
  const dz = (box.z[1] - box.z[0]) / nz;
  const ox = box.x[0] - pad * dx;
  const oy = box.y[0] - pad * dy;
  const oz = box.z[0] - pad * dz;
  const sx = nx + 2 * pad;
  const sy = ny + 2 * pad;
  const sz = nz + 2 * pad;
  // A closed solid is intersected with the box so it is capped where it is cut.
  const field = options.closed
    ? (x: number, y: number, z: number) =>
        Math.max(
          F(x, y, z),
          box.x[0] - x,
          x - box.x[1],
          box.y[0] - y,
          y - box.y[1],
          box.z[0] - z,
          z - box.z[1],
        )
    : F;
  const stride = sx + 1;
  const layer = stride * (sy + 1);
  const values = new Float64Array(layer * (sz + 1));
  for (let k = 0; k <= sz; k++)
    for (let j = 0; j <= sy; j++)
      for (let i = 0; i <= sx; i++)
        values[k * layer + j * stride + i] = field(ox + i * dx, oy + j * dy, oz + k * dz);

  const h = Math.min(dx, dy, dz) * 0.5;
  const gradient = (p: Vec3): Vec3 => {
    const gx = field(p[0] + h, p[1], p[2]) - field(p[0] - h, p[1], p[2]);
    const gy = field(p[0], p[1] + h, p[2]) - field(p[0], p[1] - h, p[2]);
    const gz = field(p[0], p[1], p[2] + h) - field(p[0], p[1], p[2] - h);
    const len = Math.hypot(gx, gy, gz);
    return len > 0 && Number.isFinite(len) ? [gx / len, gy / len, gz / len] : [0, 0, 1];
  };

  const positions: number[] = [];
  const normals: number[] = [];
  const corner = new Array<Vec3>(8);
  const cv = new Float64Array(8);
  const smoothLimit = Math.cos((options.smooth === false ? 0 : 38) * (Math.PI / 180));

  const emit = (a: Vec3, b: Vec3, c: Vec3) => {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let fx = uy * vz - uz * vy;
    let fy = uz * vx - ux * vz;
    let fz = ux * vy - uy * vx;
    const fl = Math.hypot(fx, fy, fz);
    if (!(fl > 0)) return;
    fx /= fl;
    fy /= fl;
    fz /= fl;
    const centre: Vec3 = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    const g = gradient(centre);
    let verts = [a, b, c];
    if (fx * g[0] + fy * g[1] + fz * g[2] < 0) {
      verts = [a, c, b];
      fx = -fx;
      fy = -fy;
      fz = -fz;
    }
    for (const p of verts) {
      positions.push(p[0], p[1], p[2]);
      const gn = gradient(p);
      if (gn[0] * fx + gn[1] * fy + gn[2] * fz >= smoothLimit) normals.push(gn[0], gn[1], gn[2]);
      else normals.push(fx, fy, fz);
    }
  };
  const edgePoint = (a: number, b: number): Vec3 => {
    const t = cv[a] / (cv[a] - cv[b]);
    const p = corner[a];
    const q = corner[b];
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  };

  for (let k = 0; k < sz; k++)
    for (let j = 0; j < sy; j++)
      for (let i = 0; i < sx; i++) {
        let anyIn = false;
        let anyOut = false;
        let finite = true;
        for (let c = 0; c < 8; c++) {
          const [ci, cj, ck] = CORNERS[c];
          const v = values[(k + ck) * layer + (j + cj) * stride + (i + ci)];
          cv[c] = v;
          if (!Number.isFinite(v)) finite = false;
          else if (v < 0) anyIn = true;
          else anyOut = true;
        }
        if (!finite || !anyIn || !anyOut) continue;
        for (let c = 0; c < 8; c++) {
          const [ci, cj, ck] = CORNERS[c];
          corner[c] = [ox + (i + ci) * dx, oy + (j + cj) * dy, oz + (k + ck) * dz];
        }
        for (const tet of TETS) {
          const inside = tet.filter((c) => cv[c] < 0);
          const outside = tet.filter((c) => cv[c] >= 0);
          if (inside.length === 0 || inside.length === 4) continue;
          if (inside.length === 1 || inside.length === 3) {
            const [lone, others] = inside.length === 1 ? [inside[0], outside] : [outside[0], inside];
            emit(edgePoint(lone, others[0]), edgePoint(lone, others[1]), edgePoint(lone, others[2]));
          } else {
            const [a, b] = inside;
            const [c, d] = outside;
            const p1 = edgePoint(a, c);
            const p2 = edgePoint(a, d);
            const p3 = edgePoint(b, d);
            const p4 = edgePoint(b, c);
            emit(p1, p2, p3);
            emit(p1, p3, p4);
          }
        }
      }
  return { positions: Float32Array.from(positions), normals: Float32Array.from(normals) };
}

type Field = (x: number, y: number, z: number) => number;

/**
 * Boundary of the solid {g_i <= 0 for all i} ∩ box with exact sharp edges.
 *
 * Meshing max(g_i) as one field saws the creases where two faces meet. Instead
 * every face g_i = 0 is meshed on its own and its triangles are clipped against
 * the other constraints (Sutherland–Hodgman, crossings refined by regula falsi),
 * so edges such as the rim of a cylinder cut by a plane come out straight.
 */
export function constraintSolid(
  constraints: Field[],
  box: Box,
  n: number | Vec3,
): TriangleSoup & { creases: Float32Array } {
  const [nx, ny, nz] = typeof n === 'number' ? [n, n, n] : n;
  const dx = (box.x[1] - box.x[0]) / nx;
  const dy = (box.y[1] - box.y[0]) / ny;
  const dz = (box.z[1] - box.z[0]) / nz;
  const span = Math.max(box.x[1] - box.x[0], box.y[1] - box.y[0], box.z[1] - box.z[0]);
  const walls: Field[] = [
    (x) => box.x[0] - x,
    (x) => x - box.x[1],
    (_x, y) => box.y[0] - y,
    (_x, y) => y - box.y[1],
    (_x, _y, z) => box.z[0] - z,
    (_x, _y, z) => z - box.z[1],
  ];
  // A box wall that coincides with a constraint (z >= 0 with the box floor at 0) would mesh twice.
  const probes: Vec3[] = [0.13, 0.41, 0.77].map((t, i) => [
    box.x[0] + (box.x[1] - box.x[0]) * t,
    box.y[0] + (box.y[1] - box.y[0]) * ((t + 0.29 * (i + 1)) % 1),
    box.z[0] + (box.z[1] - box.z[0]) * ((t + 0.53 * (i + 1)) % 1),
  ]);
  const same = (f: Field, g: Field) => probes.every(([x, y, z]) => Math.abs(f(x, y, z) - g(x, y, z)) < 1e-9 * span);
  const fields = [...constraints, ...walls.filter((w) => !constraints.some((g) => same(g, w)))];

  // Offset sampling grid (by a non-round fraction of a cell) so planes such as
  // z = 0 or the box walls do not pass exactly through grid nodes.
  const pad: Vec3 = [1.37 * dx, 1.37 * dy, 1.37 * dz];
  const sample: Box = {
    x: [box.x[0] - pad[0], box.x[1] + 1.63 * dx],
    y: [box.y[0] - pad[1], box.y[1] + 1.63 * dy],
    z: [box.z[0] - pad[2], box.z[1] + 1.63 * dz],
  };
  const res: Vec3 = [nx + 3, ny + 3, nz + 3];

  type V = { p: Vec3; n: Vec3 };
  const cut = (a: V, b: V, ha: number, hb: number, h: Field): V => {
    let lo = a.p;
    let hi = b.p;
    let flo = ha;
    let fhi = hb;
    let t = flo / (flo - fhi);
    let p: Vec3 = lerp3(lo, hi, t);
    for (let k = 0; k < 3; k++) {
      const fp = h(p[0], p[1], p[2]);
      if (!Number.isFinite(fp) || Math.abs(fp) < 1e-12) break;
      if (fp < 0 === flo < 0) {
        lo = p;
        flo = fp;
      } else {
        hi = p;
        fhi = fp;
      }
      t = flo / (flo - fhi);
      p = lerp3(lo, hi, t);
    }
    // Normal follows the face being clipped; interpolate along the original edge.
    const s = Math.hypot(p[0] - a.p[0], p[1] - a.p[1], p[2] - a.p[2]) / (Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]) || 1);
    const nn = lerp3(a.n, b.n, s);
    const len = Math.hypot(nn[0], nn[1], nn[2]) || 1;
    return { p, n: [nn[0] / len, nn[1] / len, nn[2] / len] };
  };
  const clip = (poly: V[], h: Field): V[] => {
    const out: V[] = [];
    const hs = poly.map((v) => h(v.p[0], v.p[1], v.p[2]));
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      const a = poly[i];
      const b = poly[j];
      const ha = hs[i];
      const hb = hs[j];
      const inA = ha <= 0;
      const inB = hb <= 0;
      if (inA) out.push(a);
      if (inA !== inB && Number.isFinite(ha) && Number.isFinite(hb)) out.push(cut(a, b, ha, hb, h));
    }
    return out;
  };

  const positions: number[] = [];
  const normals: number[] = [];
  // Edges where two faces meet, as segment pairs; each crease is kept from one side only.
  const creases: number[] = [];
  const tol = 1e-6 * span;
  fields.forEach((g, gi) => {
    const others = fields.filter((_, j) => j !== gi);
    const later = fields.slice(gi + 1);
    const soup = marchingTetrahedra(g, sample, res);
    const P = soup.positions;
    const N = soup.normals;
    for (let t = 0; t < P.length; t += 9) {
      let poly: V[] = [0, 3, 6].map((o) => ({
        p: [P[t + o], P[t + o + 1], P[t + o + 2]] as Vec3,
        n: [N[t + o], N[t + o + 1], N[t + o + 2]] as Vec3,
      }));
      for (const h of others) {
        poly = clip(poly, h);
        if (poly.length < 3) break;
      }
      if (poly.length < 3) continue;
      for (let k = 1; k + 1 < poly.length; k++)
        for (const v of [poly[0], poly[k], poly[k + 1]]) {
          positions.push(v.p[0], v.p[1], v.p[2]);
          normals.push(v.n[0], v.n[1], v.n[2]);
        }
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k].p;
        const b = poly[(k + 1) % poly.length].p;
        if (later.some((h) => Math.abs(h(a[0], a[1], a[2])) < tol && Math.abs(h(b[0], b[1], b[2])) < tol))
          creases.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      }
    }
  });
  return {
    positions: Float32Array.from(positions),
    normals: Float32Array.from(normals),
    creases: Float32Array.from(creases),
  };
}

function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function halton(i: number, b: number) {
  let f = 1;
  let r = 0;
  while (i > 0) {
    f /= b;
    r += f * (i % b);
    i = Math.floor(i / b);
  }
  return r;
}

/** Quasi–Monte Carlo volume of a solid inside the box (deterministic Halton points). */
export function solidVolume(inside: (x: number, y: number, z: number) => boolean, box: Box, n = 120000) {
  const { x, y, z } = box;
  let hit = 0;
  for (let i = 1; i <= n; i++) {
    const px = x[0] + (x[1] - x[0]) * halton(i, 2);
    const py = y[0] + (y[1] - y[0]) * halton(i, 3);
    const pz = z[0] + (z[1] - z[0]) * halton(i, 5);
    if (inside(px, py, pz)) hit++;
  }
  return (hit / n) * (x[1] - x[0]) * (y[1] - y[0]) * (z[1] - z[0]);
}
