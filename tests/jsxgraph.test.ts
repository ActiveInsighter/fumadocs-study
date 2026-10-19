import { describe, expect, it } from 'vitest';
import { bindPlotExpression, implicitExpression, initialParameterValues, validatePlotConfig } from '@/components/jsxgraph/model';
import type { FunctionPlotProps } from '@/components/jsxgraph/types';

const basic: FunctionPlotProps = { plots: [{ type: 'function', expression: 'a*x^2' }], parameters: [{ name: 'a', min: -2, max: 2, value: 1 }] };

describe('JSXGraph document configuration', () => {
  it('ignores JSXGraph sampling flags and reads current parameter values', () => {
    const values = { a: 2 };
    const curve = bindPlotExpression((x, a) => a * x ** 2, 1, ['a'], () => values);
    expect(curve(3, false as unknown as number)).toBe(18);
    values.a = -1;
    expect(curve(3, true as unknown as number)).toBe(-9);
    const implicit = bindPlotExpression((x, y, a) => x ** 2 + y ** 2 - a, 2, ['a'], () => values);
    expect(implicit(2, 3, false as unknown as number)).toBe(14);
  });
  it('accepts functions, equations, parametric curves, points, and sliders', () => {
    expect(() => validatePlotConfig({ ...basic, plots: [...basic.plots, { type: 'implicit', expression: 'x^2+y^2=4' }, { type: 'parametric', x: 'cos(t)', y: 'sin(t)', range: [0, 6.28] }], points: [{ x: 0, y: 1 }] })).not.toThrow();
    expect(initialParameterValues(basic.parameters!)).toEqual({ a: 1 });
  });

  it.each(['x', 'y', 't', 'sin', 'PI', 'a-b'])('rejects ambiguous parameter %s', (name) => {
    expect(() => validatePlotConfig({ ...basic, parameters: [{ ...basic.parameters![0], name }] })).toThrow();
  });

  it('rejects duplicates, invalid parameter ranges and non-finite coordinates', () => {
    expect(() => validatePlotConfig({ ...basic, parameters: [...basic.parameters!, ...basic.parameters!] })).toThrow();
    for (const update of [{ min: 3 }, { value: 9 }, { step: 0 }, { max: Infinity }]) {
      expect(() => validatePlotConfig({ ...basic, parameters: [{ ...basic.parameters![0], ...update }] })).toThrow();
    }
    expect(() => validatePlotConfig({ ...basic, points: [{ x: NaN, y: 0 }] })).toThrow();
    expect(() => validatePlotConfig({ ...basic, boundingBox: [5, -5, -5, 5] })).toThrow();
    expect(() => validatePlotConfig({ ...basic, height: 0 })).toThrow();
  });

  it('rejects empty expressions and reversed plotting domains', () => {
    expect(() => validatePlotConfig({ plots: [] })).toThrow();
    expect(() => validatePlotConfig({ plots: [{ type: 'function', expression: ' ' }] })).toThrow();
    expect(() => validatePlotConfig({ plots: [{ type: 'function', expression: 'x', domain: [1, -1] }] })).toThrow();
    expect(() => validatePlotConfig({ plots: [{ type: 'parametric', x: 't', y: 't', range: [0, Infinity] }] })).toThrow();
  });

  it('normalizes both equation sides without treating inequalities as curves', () => {
    expect(implicitExpression('x^2+y^2=r^2')).toBe('(x^2+y^2)-(r^2)');
    expect(implicitExpression('x*y-1')).toBe('x*y-1');
    for (const expression of ['x=y=0', 'x>=1', 'x<y', 'x=', '=y', 'x!=y']) expect(() => implicitExpression(expression)).toThrow();
  });
});
