import { formatNumber } from '../core/format';
import type { Axis, QuadricKind } from './types';

/**
 * Standard quadric surfaces in canonical position (symmetry axis Z). Every
 * kind is a sum of one-variable terms, which lets one table drive the TeX
 * equation, the implicit function, cross-sections and their classification.
 */
export interface QuadricValues { a: number; b: number; c: number }
export type Vector3 = [number, number, number];
/** Maps the unit square onto one sheet of the surface, in canonical coordinates. */
export type Patch = (s: number, t: number) => Vector3;

interface Term {
  /** Canonical variable: 0 = X, 1 = Y, 2 = Z. */
  v: 0 | 1 | 2;
  p: 1 | 2;
  sign: 1 | -1;
  /** Denominator and its symbolic TeX; an empty TeX denominator means 1. */
  d: (q: QuadricValues) => number;
  dTex: string;
  /** Written on the right-hand side of the standard equation. */
  right?: boolean;
}

interface QuadricShape {
  name: string;
  terms: Term[];
  rhs: (q: QuadricValues) => number;
  rhsTex: string;
  /** Default for `extent`: parameter reach of open sheets, or half-length of cylinders. */
  extent: number;
  patches: (q: QuadricValues, h: number) => Patch[];
}

const TAU = 2 * Math.PI;
const sq = (value: number) => value * value;
const term = (v: Term['v'], p: Term['p'], sign: Term['sign'], d: Term['d'], dTex: string, right?: boolean): Term => ({ v, p, sign, d, dTex, right });
const X2 = term(0, 2, 1, ({ a }) => sq(a), 'a^2');
const Y2 = term(1, 2, 1, ({ b }) => sq(b), 'b^2');
const Z2 = term(2, 2, 1, ({ c }) => sq(c), 'c^2');
const negative = (t: Term): Term => ({ ...t, sign: -1 });
const onRight = (t: Term): Term => ({ ...t, right: true });
const one = () => 1;
const around = (s: number) => TAU * s;

export const QUADRICS: Record<QuadricKind, QuadricShape> = {
  sphere: {
    name: '球面', extent: 1, rhs: ({ a }) => sq(a), rhsTex: 'a^2',
    terms: [term(0, 2, 1, one, ''), term(1, 2, 1, one, ''), term(2, 2, 1, one, '')],
    patches: ({ a }) => [(s, t) => { const u = around(s), v = Math.PI * (t - 0.5); return [a * Math.cos(v) * Math.cos(u), a * Math.cos(v) * Math.sin(u), a * Math.sin(v)]; }],
  },
  ellipsoid: {
    name: '椭球面', extent: 1, rhs: one, rhsTex: '1', terms: [X2, Y2, Z2],
    patches: ({ a, b, c }) => [(s, t) => { const u = around(s), v = Math.PI * (t - 0.5); return [a * Math.cos(v) * Math.cos(u), b * Math.cos(v) * Math.sin(u), c * Math.sin(v)]; }],
  },
  'hyperboloid-one-sheet': {
    name: '单叶双曲面', extent: 1.5, rhs: one, rhsTex: '1', terms: [X2, Y2, negative(Z2)],
    patches: ({ a, b, c }, h) => [(s, t) => { const u = around(s), w = h * (2 * t - 1), r = Math.hypot(1, w); return [a * r * Math.cos(u), b * r * Math.sin(u), c * w]; }],
  },
  'hyperboloid-two-sheets': {
    name: '双叶双曲面', extent: 1.6, rhs: one, rhsTex: '1', terms: [negative(X2), negative(Y2), Z2],
    patches: ({ a, b, c }, h) => [1, -1].map((side): Patch => (s, t) => { const u = around(s), w = h * t; return [a * w * Math.cos(u), b * w * Math.sin(u), side * c * Math.hypot(1, w)]; }),
  },
  cone: {
    name: '椭圆锥面', extent: 1.5, rhs: () => 0, rhsTex: '0', terms: [X2, Y2, onRight(Z2)],
    patches: ({ a, b, c }, h) => [(s, t) => { const u = around(s), w = h * (2 * t - 1); return [a * w * Math.cos(u), b * w * Math.sin(u), c * w]; }],
  },
  'elliptic-paraboloid': {
    name: '椭圆抛物面', extent: 1.5, rhs: () => 0, rhsTex: '0', terms: [X2, Y2, onRight(term(2, 1, 1, ({ c }) => c, 'c'))],
    patches: ({ a, b, c }, h) => [(s, t) => { const u = around(s), w = h * t; return [a * w * Math.cos(u), b * w * Math.sin(u), c * w * w]; }],
  },
  'hyperbolic-paraboloid': {
    name: '双曲抛物面（马鞍面）', extent: 1.2, rhs: () => 0, rhsTex: '0', terms: [X2, negative(Y2), onRight(term(2, 1, 1, ({ c }) => c, 'c'))],
    patches: ({ a, b, c }, h) => [(s, t) => { const p = h * (2 * s - 1), q = h * (2 * t - 1); return [a * p, b * q, c * (p * p - q * q)]; }],
  },
  'elliptic-cylinder': {
    name: '椭圆柱面', extent: 2, rhs: one, rhsTex: '1', terms: [X2, Y2],
    patches: ({ a, b }, h) => [(s, t) => { const u = around(s); return [a * Math.cos(u), b * Math.sin(u), h * (2 * t - 1)]; }],
  },
  'hyperbolic-cylinder': {
    name: '双曲柱面', extent: 2, rhs: one, rhsTex: '1', terms: [X2, negative(Y2)],
    patches: ({ a, b }, h) => [1, -1].map((side): Patch => (s, t) => { const w = 1.5 * (2 * s - 1); return [side * a * Math.cosh(w), b * Math.sinh(w), h * (2 * t - 1)]; }),
  },
  'parabolic-cylinder': {
    name: '抛物柱面', extent: 2, rhs: () => 0, rhsTex: '0', terms: [X2, onRight(term(1, 1, 1, ({ b }) => b, 'b'))],
    patches: ({ a, b }, h) => [(s, t) => { const w = 1.6 * (2 * s - 1); return [a * w, b * w * w, h * (2 * t - 1)]; }],
  },
};

export const QUADRIC_KINDS = Object.keys(QUADRICS) as QuadricKind[];
/** Which parameters appear in each kind's equation or shape. */
export function quadricUses(kind: QuadricKind): ('a' | 'b' | 'c')[] {
  if (kind === 'sphere') return ['a'];
  if (kind === 'elliptic-cylinder' || kind === 'hyperbolic-cylinder' || kind === 'parabolic-cylinder') return ['a', 'b'];
  return ['a', 'b', 'c'];
}

/** World index of each canonical variable: the symmetry axis takes Z's place. */
const PERMUTATION: Record<Axis, [number, number, number]> = { z: [0, 1, 2], x: [1, 2, 0], y: [2, 0, 1] };
const LETTERS = ['x', 'y', 'z'];

export interface Placement { axis: Axis; center: Vector3 }

export function toWorld([X, Y, Z]: Vector3, { axis, center }: Placement): Vector3 {
  const world: Vector3 = [0, 0, 0];
  const permutation = PERMUTATION[axis];
  [X, Y, Z].forEach((value, index) => { world[permutation[index]] = value + center[permutation[index]]; });
  return world;
}

function toCanonical(world: Vector3, { axis, center }: Placement): Vector3 {
  return PERMUTATION[axis].map((index) => world[index] - center[index]) as Vector3;
}

/** Signed coefficient of each term once every term is moved to the left. */
const coefficient = (t: Term, q: QuadricValues) => (t.right ? -t.sign : t.sign) / t.d(q);

export function quadricImplicit(kind: QuadricKind, q: QuadricValues, placement: Placement): (x: number, y: number, z: number) => number {
  const shape = QUADRICS[kind];
  const rhs = shape.rhs(q);
  return (x, y, z) => {
    const canonical = toCanonical([x, y, z], placement);
    return shape.terms.reduce((sum, t) => sum + coefficient(t, q) * canonical[t.v] ** t.p, 0) - rhs;
  };
}

function variable(t: Term, placement: Placement): string {
  const index = PERMUTATION[placement.axis][t.v];
  const shift = placement.center[index];
  const letter = LETTERS[index];
  const base = shift === 0 ? letter : `(${letter}${shift > 0 ? '-' : '+'}${formatNumber(Math.abs(shift))})`;
  return t.p === 2 ? `${base}^2` : base;
}

function termTex(t: Term, placement: Placement, q: QuadricValues | null, first: boolean, sign: 1 | -1 = t.sign): string {
  const operator = sign < 0 ? '-' : first ? '' : '+';
  const denominator = q ? (t.d(q) === 1 ? '' : formatNumber(t.d(q))) : t.dTex;
  return `${operator}${denominator ? `\\frac{${variable(t, placement)}}{${denominator}}` : variable(t, placement)}`;
}

/** Standard equation; symbolic (a, b, c) when `q` is null, numeric otherwise. */
export function quadricTex(kind: QuadricKind, placement: Placement, q: QuadricValues | null): string {
  const shape = QUADRICS[kind];
  const left = shape.terms.filter((t) => !t.right);
  const right = shape.terms.filter((t) => t.right);
  const side = (terms: Term[]) => terms.map((t, index) => termTex(t, placement, q, index === 0)).join('');
  const rhs = right.length ? side(right) : q ? formatNumber(shape.rhs(q)) : shape.rhsTex;
  return `${side(left)}=${rhs}`;
}

export interface QuadricSection {
  /** Trace equation in the two remaining variables. */
  tex: string;
  /** Curve type of the trace, for example 椭圆 or 双曲线. */
  curve: string;
}

/** The trace of the surface in the plane `axis = value`, with its conic type. */
export function quadricSection(kind: QuadricKind, q: QuadricValues, placement: Placement, axis: Axis, value: number): QuadricSection {
  const shape = QUADRICS[kind];
  const worldIndex = LETTERS.indexOf(axis);
  const canonicalIndex = PERMUTATION[placement.axis].indexOf(worldIndex);
  const fixed = value - placement.center[worldIndex];
  let rhs = shape.rhs(q);
  const remaining: Term[] = [];
  for (const t of shape.terms) {
    if (t.v === canonicalIndex) rhs -= coefficient(t, q) * fixed ** t.p;
    else remaining.push(t);
  }
  const zero = Math.abs(rhs) < 1e-9;
  if (zero) rhs = 0;
  const quadratic = remaining.filter((t) => t.p === 2).map((t) => coefficient(t, q));
  const linear = remaining.filter((t) => t.p === 1);
  let curve: string;
  if (quadratic.length === 2) {
    const [alpha, beta] = quadratic;
    if (alpha * beta > 0) curve = zero ? '一个点' : rhs * alpha > 0 ? (Math.abs(alpha - beta) < 1e-9 * Math.max(Math.abs(alpha), Math.abs(beta)) ? '圆' : '椭圆') : '空集（不相交）';
    else curve = zero ? '两条相交直线' : '双曲线';
  } else if (quadratic.length === 1) {
    curve = linear.length ? '抛物线' : zero ? '一条直线（二重）' : rhs / quadratic[0] > 0 ? '两条平行直线' : '空集（不相交）';
  } else curve = linear.length ? '一条直线' : zero ? '整个平面' : '空集（不相交）';
  const left = remaining.map((t, index) => termTex(t, placement, q, index === 0, (t.right ? -t.sign : t.sign) as 1 | -1)).join('') || '0';
  return { tex: `${left}=${formatNumber(rhs)}`, curve };
}
