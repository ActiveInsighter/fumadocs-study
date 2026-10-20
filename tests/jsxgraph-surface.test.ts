import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { bindPlotExpression, type Evaluator, type ExpressionCompiler } from '@/components/jsxgraph/core/expression';
import { formatSpaceCoordinate } from '@/components/jsxgraph/core/format';
import { SurfacePlot } from '@/components/jsxgraph/space/surface-plot';
import { createRuntime, DEFAULT_SPACE_BOX, fitSurfaceBox, replaceSurfaceExpressions, surfaceRanges, validateSurfaceConfig, type PlotRuntime } from '@/components/jsxgraph/space/model';
import { quadricImplicit, quadricSection, type Placement } from '@/components/jsxgraph/space/quadrics';
import type { SurfacePlotProps } from '@/components/jsxgraph/space/types';

const basic: SurfacePlotProps = { plots: [{ type: 'surface', expression: 'a*(x^2+y^2)' }], parameters: [{ name: 'a', min: -2, max: 2, value: 1 }] };

/** Fake compiler: JavaScript over the given variables with Math in scope; ^ reads as **. */
const fakeCompiler: ExpressionCompiler = (expression, variables) => new Function(...variables, `with (Math) { return (${expression.replace(/\^/g, '**')}); }`) as Evaluator;

describe('3D graph configurations and coordinates', () => {
  it('server renders MDX controls without importing browser-only JSXGraph', () => {
    expect(typeof window).toBe('undefined');
    const html = renderToString(createElement(SurfacePlot, { ...basic, title: '可服务端渲染的三维图像' }));
    expect(html).toContain('可服务端渲染的三维图像');
    expect(html).toContain('绘制');
    expect(html).toContain('坐标探针');
    expect(html).not.toContain('NaN');
  });

  it('accepts graph surfaces, parametric surfaces, and space curves with independent ranges', () => {
    expect(() => validateSurfaceConfig({ ...basic, plots: [
      ...basic.plots,
      { type: 'parametric-surface', x: 'cos(u)*cos(v)', y: 'sin(u)*cos(v)', z: 'sin(v)', ranges: [[0, 6.28], [-1.57, 1.57]] },
      { type: 'parametric-curve', x: 'cos(t)', y: 'sin(t)', z: 't', range: [0, 6.28] },
    ] })).not.toThrow();
    expect(surfaceRanges(basic.plots[0], DEFAULT_SPACE_BOX)).toEqual([[-3, 3], [-3, 3]]);
  });

  it('updates graph heights from live parameter values while preserving x and y coordinates', () => {
    const values = { a: 2 };
    let revision = 0;
    const plot: SurfacePlotProps['plots'][number] = { type: 'surface', expression: 'a*(x^2+y^2)', domain: [[0, 2], [0, 4]] };
    const runtime = createRuntime(plot, (expression, variables) => {
      expect(expression).toBe('a*(x^2+y^2)');
      expect(variables).toEqual(['x', 'y']);
      return bindPlotExpression((x, y, a) => a * (x * x + y * y), 2, ['a'], () => values);
    }, DEFAULT_SPACE_BOX, () => revision);
    // Unit-square fractions map onto x in [0, 2] and y in [0, 4].
    expect(runtime.patches[0](0.5, 0.5)).toEqual([1, 2, 10]);
    values.a = -0.5;
    revision++;
    expect(runtime.patches[0](0.5, 0.5)).toEqual([1, 2, -2.5]);
  });

  it('evaluates a helix and a torus using their own parameter variables', () => {
    const compile: ExpressionCompiler = (expression, variables) => {
      if (variables.length === 1) {
        const f = { 'cos(t)': Math.cos, 'sin(t)': Math.sin, t: (t: number) => t };
        return f[expression as keyof typeof f];
      }
      expect(variables).toEqual(['u', 'v']);
      const f = {
        '(2+cos(v))*cos(u)': (u: number, v: number) => (2 + Math.cos(v)) * Math.cos(u),
        '(2+cos(v))*sin(u)': (u: number, v: number) => (2 + Math.cos(v)) * Math.sin(u),
        'sin(v)': (_u: number, v: number) => Math.sin(v),
      };
      return f[expression as keyof typeof f];
    };
    const helix = createRuntime({ type: 'parametric-curve', x: 'cos(t)', y: 'sin(t)', z: 't', range: [0, 10] }, compile, DEFAULT_SPACE_BOX);
    expect(helix.curve!(0)).toEqual([1, 0, 0]);
    expect(helix.curve!(Math.PI / 10)[2]).toBeCloseTo(Math.PI, 12);
    const torus = createRuntime({ type: 'parametric-surface', x: '(2+cos(v))*cos(u)', y: '(2+cos(v))*sin(u)', z: 'sin(v)', ranges: [[0, 6.28], [0, 6.28]] }, compile, DEFAULT_SPACE_BOX);
    expect(torus.patches[0](0, 0)).toEqual([3, 0, 0]);
    expect(torus.patches[0](0, Math.PI / 6.28)[0]).toBeCloseTo(1, 12);
  });

  it('keeps declarative domains and style when applying edited expressions', () => {
    const original = { type: 'surface' as const, expression: 'x+y', domain: [[-1, 2], [-3, 4]] as [[number, number], [number, number]], color: '#123456' };
    expect(replaceSurfaceExpressions(original, ['x-y'])).toEqual({ ...original, expression: 'x-y' });
    expect(original.expression).toBe('x+y');
  });

  it('fits current finite samples with margins while ignoring hidden plots', () => {
    const plots: SurfacePlotProps['plots'] = [{ type: 'surface', expression: 'x+y', domain: [[-2, 2], [-2, 2]] }, { type: 'surface', expression: '1000' }];
    const runtimes = plots.map((plot) => createRuntime(plot, fakeCompiler, DEFAULT_SPACE_BOX));
    const result = fitSurfaceBox(plots, runtimes, [true, false], DEFAULT_SPACE_BOX);
    expect(result).toEqual([[-2.4, 2.4], [-2.4, 2.4], [-4.8, 4.8]]);
    const singular: PlotRuntime = { patches: [() => [NaN, NaN, NaN]], sheets: () => 1 };
    expect(() => fitSurfaceBox(plots, [singular, singular], [true, false], DEFAULT_SPACE_BOX)).toThrow('有限坐标');
    expect(() => fitSurfaceBox(plots, runtimes, [false, false], DEFAULT_SPACE_BOX)).toThrow('有限坐标');
  });

  it('gives constant-height surfaces a nonzero viewing depth', () => {
    const plot: SurfacePlotProps['plots'][number] = { type: 'surface', expression: '3' };
    const result = fitSurfaceBox([plot], [createRuntime(plot, fakeCompiler, DEFAULT_SPACE_BOX)], [true], DEFAULT_SPACE_BOX);
    expect(result[2][0]).toBeLessThan(3);
    expect(result[2][1]).toBeGreaterThan(3);
    expect(() => validateSurfaceConfig({ ...basic, box: result })).not.toThrow();
  });

  it.each(['x', 'y', 'z', 'u', 'v', 't', 'sin', 'PI', 'a-b'])('rejects conflicting 3D parameter name %s', (name) => {
    expect(() => validateSurfaceConfig({ ...basic, parameters: [{ ...basic.parameters![0], name }] })).toThrow();
  });

  it('rejects invalid boxes, domains, expression lengths and excessive mesh sizes before initialization', () => {
    for (const mesh of [0, 7, 41, 18.5, Infinity]) expect(() => validateSurfaceConfig({ ...basic, mesh })).toThrow();
    expect(() => validateSurfaceConfig({ ...basic, mesh: 40 })).not.toThrow();
    expect(() => validateSurfaceConfig({ ...basic, box: [[0, 0], [-1, 1], [-1, 1]] })).toThrow();
    expect(() => validateSurfaceConfig({ plots: [{ type: 'surface', expression: ' ', domain: [[-1, 1], [0, Infinity]] }] })).toThrow();
    expect(() => validateSurfaceConfig({ plots: [{ type: 'surface', expression: 'x'.repeat(2001) }] })).toThrow();
    expect(() => validateSurfaceConfig({ plots: [{ type: 'parametric-curve', x: 't', y: 't', z: 't', range: [2, -2] }] })).toThrow();
    expect(() => validateSurfaceConfig({ ...basic, parameters: [...basic.parameters!, ...basic.parameters!] })).toThrow();
  });

  it('reports singular coordinates clearly without misleading NaN or Infinity values', () => {
    expect(formatSpaceCoordinate(NaN)).toBe('未定义');
    expect(formatSpaceCoordinate(Infinity)).toBe('未定义');
    expect(formatSpaceCoordinate(1.234567)).toBe('1.2346');
    expect(formatSpaceCoordinate(-0.000001)).toBe('0');
  });
});

describe('Quadric surfaces', () => {
  const placement: Placement = { axis: 'z', center: [0, 0, 0] };

  it('classifies ellipsoid traces by height: an ellipse at z=0 and no points above the top at z=2', () => {
    const q = { a: 2, b: 1, c: 1 };
    expect(quadricSection('ellipsoid', q, placement, 'z', 0).curve).toBe('椭圆');
    expect(quadricSection('ellipsoid', q, placement, 'z', 2).curve).toBe('空集（不相交）');
  });

  it('classifies hyperbolic traces and saddle traces', () => {
    expect(quadricSection('hyperboloid-one-sheet', { a: 2, b: 1, c: 1 }, placement, 'x', 0).curve).toBe('双曲线');
    expect(quadricSection('hyperbolic-paraboloid', { a: 2, b: 1, c: 1 }, placement, 'z', 0).curve).toBe('两条相交直线');
  });

  it('evaluates the implicit form of a sphere to zero on its surface', () => {
    expect(quadricImplicit('sphere', { a: 2, b: 2, c: 2 }, placement)(2, 0, 0)).toBe(0);
  });
});
