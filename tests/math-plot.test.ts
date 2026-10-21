import { describe, expect, it } from 'vitest';

import { checkExpression, compile, evaluateValue, realPow } from '@/components/math-plot/core/expr';
import { clipDomain, constraintSolid, gridMesh, marchingTetrahedra, solidVolume } from '@/components/math-plot/core/mesh';
import {
  implicitCurve,
  regionArea,
  sampleFunction,
  sliceIntervals,
} from '@/components/math-plot/core/sampling';
import { buildModel2D } from '@/components/math-plot/plot2d/model';
import { buildModel3D } from '@/components/math-plot/plot3d/model';

const ev = (src: string, scope: Record<string, number> = {}, params: string[] = []) =>
  compile(src, { params }).evaluate(scope);

describe('expression compiler', () => {
  it('handles precedence, implicit multiplication and constants', () => {
    expect(ev('2x^2 + 3x - 1', { x: 2 })).toBe(13);
    expect(ev('2pi')).toBeCloseTo(2 * Math.PI);
    expect(ev('-x^2', { x: 3 })).toBe(-9);
    expect(ev('xy', { x: 2, y: 5 })).toBe(10);
    expect(ev('x2', { x: 4 })).toBe(8);
    expect(ev('(x+1)(x-1)', { x: 3 })).toBe(8);
    expect(ev('|x - 3|', { x: 1 })).toBe(2);
  });

  it('applies functions with and without parentheses', () => {
    expect(ev('sin(pi/2)')).toBeCloseTo(1);
    expect(ev('sin 2x', { x: Math.PI / 4 })).toBeCloseTo(1);
    expect(ev('sin^2(x) + cos^2(x)', { x: 0.7 })).toBeCloseTo(1);
    expect(ev('ln e')).toBeCloseTo(1);
    expect(ev('arctan(1)')).toBeCloseTo(Math.PI / 4);
    expect(ev('max(1, 4, 2)')).toBe(4);
    expect(ev('sqrt x', { x: 9 })).toBe(3);
  });

  it('keeps odd-root powers of negative numbers real', () => {
    expect(realPow(-8, 1 / 3)).toBeCloseTo(-2);
    expect(realPow(-8, 2 / 3)).toBeCloseTo(4);
    expect(Number.isNaN(realPow(-8, 0.5))).toBe(true);
    expect(ev('x^(2/3)', { x: -1 })).toBeCloseTo(1);
  });

  it('evaluates chained comparisons and logic for regions', () => {
    const disc = compile('x^2 + y^2 <= 1 && y >= 0');
    expect(disc.evaluate({ x: 0, y: 0.5 })).toBe(1);
    expect(disc.evaluate({ x: 0, y: -0.5 })).toBe(0);
    expect(ev('0 < x < 1', { x: 0.5 })).toBe(1);
    expect(ev('0 < x < 1', { x: 2 })).toBe(0);
    expect(ev('x < 0 || x > 2', { x: 3 })).toBe(1);
    expect(ev('not (x > 0)', { x: 1 })).toBe(0);
    expect(ev('x >= 0, y >= 0', { x: 1, y: -1 })).toBe(0);
    expect(ev('x ≤ 1', { x: 0.5 })).toBe(1);
  });

  it('turns equations and inequality lists into level-set functions', () => {
    const eq = compile('x^2 + y^2 = 4');
    expect(eq.equation).toBe(true);
    expect(eq.evaluate({ x: 2, y: 0 })).toBe(0);
    const solid = compile('x^2 + y^2 <= z && z <= 1');
    expect(solid.constraints).toHaveLength(2);
    const level = (s: Record<string, number>) => Math.max(...solid.constraints!.map((g) => g(s)));
    expect(level({ x: 0, y: 0, z: 0.5 })).toBeLessThan(0);
    expect(level({ x: 1, y: 1, z: 0.5 })).toBeGreaterThan(0);
  });

  it('binds polar variables and slider parameters', () => {
    expect(ev('r <= 1 + cos theta', { r: 1, theta: 0 })).toBe(1);
    expect(ev('a x + b', { x: 2 }, ['a', 'b'])).toBeNaN();
    expect(ev('a x + b', { x: 2, a: 3, b: 1 }, ['a', 'b'])).toBe(7);
    // An upper-case slider must not be swallowed by the built-in variable r.
    expect(ev('R cos u', { R: 2, r: 5, u: 0 }, ['R'])).toBe(2);
    expect(ev('r R', { R: 2, r: 5 }, ['R'])).toBe(10);
    expect(evaluateValue('pi/2')).toBeCloseTo(Math.PI / 2);
    expect(evaluateValue(3)).toBe(3);
  });

  it('rejects unsafe or malformed input with readable messages', () => {
    expect(checkExpression('alert(1)')).toMatch(/无法识别/);
    expect(checkExpression('sin(')).not.toBeNull();
    expect(checkExpression('x +')).not.toBeNull();
    expect(checkExpression('constructor')).not.toBeNull();
    expect(checkExpression('x'.repeat(700))).toMatch(/过长/);
  });
});

describe('planar sampling', () => {
  it('breaks tan x at its asymptotes', () => {
    const lines = sampleFunction(Math.tan, [-Math.PI, Math.PI], 800, [-4, 4]);
    // branches on (-π, -π/2), (-π/2, π/2), (π/2, π)
    expect(lines.length).toBe(3);
  });

  it('stops sqrt at the edge of its domain', () => {
    const [line] = sampleFunction(Math.sqrt, [-1, 4], 50, [-1, 3]);
    expect(line[0][0]).toBeCloseTo(0, 6);
  });

  it('traces a circle with marching squares', () => {
    const curves = implicitCurve((x, y) => x * x + y * y - 1, [-2, 2], [-2, 2], 80, 80);
    expect(curves).toHaveLength(1);
    for (const [x, y] of curves[0]) expect(Math.hypot(x, y)).toBeCloseTo(1, 2);
  });

  it('ignores sign changes across poles', () => {
    const curves = implicitCurve((x) => 1 / x, [-1, 1], [-1, 1], 41, 41);
    expect(curves).toHaveLength(0);
  });

  it('finds slice intervals and areas of a region', () => {
    const inside = (x: number, y: number) => y >= x * x && y <= Math.sqrt(x);
    const [interval] = sliceIntervals(inside, 'x', 0.25, [-1, 2]);
    expect(interval[0]).toBeCloseTo(0.0625, 4);
    expect(interval[1]).toBeCloseTo(0.5, 4);
    expect(regionArea(inside, [0, 1], [0, 1], 600)).toBeCloseTo(1 / 3, 2);
    const annulus = (x: number, y: number) => {
      const r = Math.hypot(x, y);
      return r >= 1 && r <= 2;
    };
    expect(sliceIntervals(annulus, 'x', 0, [-3, 3])).toHaveLength(2);
  });
});

describe('3D geometry', () => {
  it('drops triangles at undefined points', () => {
    const mesh = gridMesh((u, v) => [u, v, u > 0.5 ? Number.NaN : 0], [0, 1], [0, 1], 4, 4);
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeLessThan(4 * 4 * 6);
  });

  it('clips a disc exactly at its boundary', () => {
    const { triangles, boundary } = clipDomain((x, y) => x * x + y * y <= 1, [-1.2, 1.2], [-1.2, 1.2], 60);
    let area = 0;
    for (const [a, b, c] of triangles) area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
    expect(area).toBeCloseTo(Math.PI, 2);
    for (const [p] of boundary) expect(Math.hypot(p[0], p[1])).toBeCloseTo(1, 3);
  });

  it('meshes a sphere with marching tetrahedra', () => {
    const box = { x: [-1.5, 1.5] as [number, number], y: [-1.5, 1.5] as [number, number], z: [-1.5, 1.5] as [number, number] };
    const soup = marchingTetrahedra((x, y, z) => x * x + y * y + z * z - 1, box, 24);
    expect(soup.positions.length).toBeGreaterThan(0);
    expect(soup.normals.length).toBe(soup.positions.length);
    for (let i = 0; i < soup.positions.length; i += 3) {
      const [x, y, z] = [soup.positions[i], soup.positions[i + 1], soup.positions[i + 2]];
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 1);
      // outward normals
      expect(x * soup.normals[i] + y * soup.normals[i + 1] + z * soup.normals[i + 2]).toBeGreaterThan(0);
    }
  });

  it('estimates the volume of the ice-cream cone', () => {
    const inside = (x: number, y: number, z: number) => Math.hypot(x, y) <= z && x * x + y * y + z * z <= 1;
    const box = { x: [-1, 1] as [number, number], y: [-1, 1] as [number, number], z: [0, 1] as [number, number] };
    // V = 2π/3 · (1 − √2/2)
    expect(solidVolume(inside, box, 60000)).toBeCloseTo(((2 * Math.PI) / 3) * (1 - Math.SQRT1_2), 1);
  });

  it('meshes inequality solids with exact sharp edges', () => {
    const gs = [(x: number) => -x, (_x: number, y: number) => -y, (_x: number, _y: number, z: number) => -z, (x: number, y: number, z: number) => x + y + z - 1];
    // Box floor at z = 0 coincides with the constraint z >= 0 and must not be meshed twice.
    const box = { x: [-0.2, 1.2] as [number, number], y: [-0.2, 1.2] as [number, number], z: [0, 1.1] as [number, number] };
    const { positions: p } = constraintSolid(gs, box, 24);
    let area = 0;
    let worst = 0;
    for (let i = 0; i < p.length; i += 9) {
      const u = [p[i + 3] - p[i], p[i + 4] - p[i + 1], p[i + 5] - p[i + 2]];
      const v = [p[i + 6] - p[i], p[i + 7] - p[i + 1], p[i + 8] - p[i + 2]];
      area += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
    }
    for (let i = 0; i < p.length; i += 3) for (const g of gs) worst = Math.max(worst, g(p[i], p[i + 1], p[i + 2]));
    expect(area).toBeCloseTo(1.5 + Math.sqrt(3) / 2, 3);
    expect(worst).toBeLessThan(1e-5);
  });
});

describe('plot models', () => {
  it('builds a 2D model and reports bad expressions without throwing', () => {
    const model = buildModel2D(
      {
        title: 't',
        x: [-2, 2],
        y: [-2, 2],
        items: [
          { type: 'function', fn: 'x^2' },
          { type: 'region', where: 'y >= x^2 && y <= 1' },
          { type: 'implicit', eq: 'x^2 + y^2 = 1' },
          { type: 'function', fn: 'foo(x)' },
        ],
        slices: [{ mode: 'x', range: [-1, 1] }],
      },
      {},
    );
    expect(model.curves).toHaveLength(2);
    expect(model.regions).toHaveLength(1);
    expect(model.domain?.(0, 0.5)).toBe(true);
    expect(model.errors).toHaveLength(1);
    expect(model.slices[0].range).toEqual([-1, 1]);
  });

  it('builds 3D geometry, auto-fits z and keeps solids for sections', () => {
    const built = buildModel3D(
      {
        title: 't',
        x: [-1, 1],
        y: [-1, 1],
        items: [
          { type: 'surface', z: 'x^2 + y^2', contours: 6 },
          { type: 'solid', where: 'x^2 + y^2 <= z && z <= 1', resolution: 20 },
        ],
      },
      {},
    );
    expect(built.errors).toEqual([]);
    expect(built.box.z[0]).toBeLessThanOrEqual(0);
    expect(built.box.z[1]).toBeGreaterThanOrEqual(2);
    expect(built.meshes).toHaveLength(2);
    expect(built.lines.some((l) => l.role === 'contour')).toBe(true);
    expect(built.solids[0](0, 0, 0.5)).toBe(true);
  });
});
