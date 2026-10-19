import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { bindPlotExpression } from '@/components/jsxgraph/model';
import { SurfacePlot } from '@/components/jsxgraph/surface-plot';
import { createSurfaceEvaluator, DEFAULT_SPACE_BOX, fitSurfaceBox, formatSpaceCoordinate, replaceSurfaceExpressions, surfaceRanges, validateSurfaceConfig, type ExpressionCompiler } from '@/components/jsxgraph/surface-model';
import type { SurfacePlotProps } from '@/components/jsxgraph/surface-types';

const basic: SurfacePlotProps = { plots: [{ type: 'surface', expression: 'a*(x^2+y^2)' }], parameters: [{ name: 'a', min: -2, max: 2, value: 1 }] };

describe('3D graph configurations and coordinates', () => {
  it('server renders MDX controls without importing browser-only JSXGraph', () => {
    expect(typeof window).toBe('undefined');
    const html = renderToString(createElement(SurfacePlot, { ...basic, title: '可服务端渲染的三维图像' }));
    expect(html).toContain('可服务端渲染的三维图像');
    expect(html).toContain('绘制图像');
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
    const evaluate = createSurfaceEvaluator(basic.plots[0], (expression, variables) => {
      expect(expression).toBe('a*(x^2+y^2)');
      expect(variables).toEqual(['x', 'y']);
      return bindPlotExpression((x, y, a) => a * (x * x + y * y), 2, ['a'], () => values);
    });
    expect(evaluate(1, 2, false as unknown as number)).toEqual([1, 2, 10]);
    values.a = -0.5;
    expect(evaluate(1, 2)).toEqual([1, 2, -2.5]);
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
    const helix = createSurfaceEvaluator({ type: 'parametric-curve', x: 'cos(t)', y: 'sin(t)', z: 't', range: [0, 10] }, compile);
    expect(helix(0)).toEqual([1, 0, 0]);
    expect(helix(Math.PI)[2]).toBe(Math.PI);
    const torus = createSurfaceEvaluator({ type: 'parametric-surface', x: '(2+cos(v))*cos(u)', y: '(2+cos(v))*sin(u)', z: 'sin(v)', ranges: [[0, 6.28], [0, 6.28]] }, compile);
    expect(torus(0, 0)).toEqual([3, 0, 0]);
    expect(torus(0, Math.PI)[0]).toBe(1);
  });

  it('keeps declarative domains and style when applying edited expressions', () => {
    const original = { type: 'surface' as const, expression: 'x+y', domain: [[-1, 2], [-3, 4]] as [[number, number], [number, number]], color: '#123456' };
    expect(replaceSurfaceExpressions(original, ['x-y'])).toEqual({ ...original, expression: 'x-y' });
    expect(original.expression).toBe('x+y');
  });

  it('fits current finite samples with margins while ignoring hidden plots', () => {
    const plots: SurfacePlotProps['plots'] = [{ type: 'surface', expression: 'x+y', domain: [[-2, 2], [-2, 2]] }, { type: 'surface', expression: '1000' }];
    const result = fitSurfaceBox(plots, [(x, y) => [x, y, x + y], (x, y) => [x, y, 1000]], [true, false], DEFAULT_SPACE_BOX);
    expect(result).toEqual([[-2.4, 2.4], [-2.4, 2.4], [-4.8, 4.8]]);
    expect(() => fitSurfaceBox(plots, [(x, y) => [x, y, NaN]], [true, false], DEFAULT_SPACE_BOX)).toThrow('有限坐标');
    expect(() => fitSurfaceBox(plots, [(x, y) => [x, y, 1]], [false, false], DEFAULT_SPACE_BOX)).toThrow('有限坐标');
  });

  it('gives constant-height surfaces a nonzero viewing depth', () => {
    const result = fitSurfaceBox([{ type: 'surface', expression: '3' }], [(x, y) => [x, y, 3]], [true], DEFAULT_SPACE_BOX);
    expect(result[2][0]).toBeLessThan(3);
    expect(result[2][1]).toBeGreaterThan(3);
    expect(() => validateSurfaceConfig({ ...basic, box: result })).not.toThrow();
  });

  it.each(['x', 'y', 'z', 'u', 'v', 't', 'sin', 'PI', 'a-b'])('rejects conflicting 3D parameter name %s', (name) => {
    expect(() => validateSurfaceConfig({ ...basic, parameters: [{ ...basic.parameters![0], name }] })).toThrow();
  });

  it('rejects invalid boxes, domains, expression lengths and excessive mesh sizes before initialization', () => {
    for (const mesh of [0, 7, 33, 18.5, Infinity]) expect(() => validateSurfaceConfig({ ...basic, mesh })).toThrow();
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
