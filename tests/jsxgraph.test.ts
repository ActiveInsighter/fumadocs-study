import { describe, expect, it, vi } from 'vitest';
import { bindPlotExpression, commitParameterValue, implicitExpression, initialParameterValues, parameterValue, startParameterAnimation, validatePlotConfig, validatePlotParameters } from '@/components/jsxgraph/model';
import type { FunctionPlotProps, PlotParameter } from '@/components/jsxgraph/types';

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

  it.each(['x', 'y', 'z', 'u', 'v', 't', 'sin', 'asin', 'atan2', 'ln', 'log10', 'floor', 'PI', 'a-b'])('rejects ambiguous parameter %s', (name) => {
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

  it.each([
    { plots: null },
    { plots: [null] },
    { plots: [{ type: 'surface', expression: 'x+y' }] },
    { plots: [{ type: 'function', expression: 3 }] },
    { plots: [{ type: 'function', expression: 'x', domain: null }] },
    { plots: [{ type: 'parametric', x: 't', y: 't' }] },
    { plots: [{ type: 'implicit', expression: 'x>=y' }] },
    { plots: basic.plots, parameters: null },
    { plots: basic.plots, parameters: [null] },
    { plots: basic.plots, points: null },
    { plots: basic.plots, boundingBox: null },
  ])('reports a malformed runtime document as a configuration error: %j', (config) => {
    try {
      validatePlotConfig(config as unknown as FunctionPlotProps);
      throw new Error('Configuration should have been rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(TypeError);
      expect((error as Error).message).not.toContain('should have been rejected');
    }
  });

  it('keeps valid authored values even when the initial value is between slider steps', () => {
    const parameters = [{ name: 'a', min: 0, max: 1, value: 1 / 3, step: 0.1 }];
    expect(() => validatePlotParameters(parameters)).not.toThrow();
    expect(initialParameterValues(parameters).a).toBe(1 / 3);
  });

  it('normalizes both equation sides without treating inequalities as curves', () => {
    expect(implicitExpression('x^2+y^2=r^2')).toBe('(x^2+y^2)-(r^2)');
    expect(implicitExpression('x*y-1')).toBe('x*y-1');
    for (const expression of ['x=y=0', 'x>=1', 'x<y', 'x=', '=y', 'x!=y']) expect(() => implicitExpression(expression)).toThrow();
  });
});

describe('Parameter number input', () => {
  const parameter: PlotParameter = { name: 'a', min: -2, max: 2, value: 1, step: 0.1 };

  it.each(['', ' ', '-', '1e', 'NaN', 'Infinity', '-Infinity'])('preserves the accepted value for an unfinished or invalid draft %j', (draft) => {
    expect(commitParameterValue(draft, 1 / 3, parameter)).toBe(1 / 3);
  });

  it('clamps out-of-range numbers and snaps relative to the minimum', () => {
    expect(commitParameterValue('100', 1, parameter)).toBe(2);
    expect(commitParameterValue('-100', 1, parameter)).toBe(-2);
    expect(commitParameterValue('1.26', 1, parameter)).toBe(1.3);
    expect(parameterValue(0.15, { name: 'a', min: 0, max: 1, value: 0, step: 0.1 })).toBe(0.2);
    expect(parameterValue(1, { name: 'a', min: 0.2, max: 1.1, value: 0.2, step: 0.3 })).toBe(1.1);
  });

  it('does not create a step-invalid endpoint when max is between steps', () => {
    const uneven = { name: 'a', min: 0, max: 1, value: 0, step: 0.3 };
    expect(parameterValue(1, uneven)).toBe(0.9);
    expect(parameterValue(100, uneven)).toBe(0.9);
    expect(parameterValue(-100, uneven)).toBe(0);
    expect(parameterValue(0.3, { ...uneven, max: 0.3, step: 0.1 })).toBe(0.3);
  });

  it('retains small authored steps without decimal noise or fixed-precision truncation', () => {
    expect(parameterValue(0.3, parameter)).toBe(0.3);
    expect(parameterValue(1.5e-9, { name: 'a', min: 0, max: 1e-8, value: 0, step: 1e-9 })).toBe(2e-9);
    expect(parameterValue(2e-200, { name: 'a', min: 0, max: 1e-199, value: 0, step: 1e-200 })).toBe(2e-200);
    expect(parameterValue(0, { name: 'a', min: 0, max: 1, value: 0, step: 1e-20 })).toBe(0);
  });
});

function animation(parameter: PlotParameter = { name: 'a', min: 0, max: 8, value: 4, step: 0.01 }) {
  let values = { a: parameter.value, b: 2 };
  let hidden = false;
  let sequence = 0;
  const pending = new Map<number, (time: number) => void>();
  const onChange = vi.fn((next: Record<string, number>) => { values = next as typeof values; });
  const stop = startParameterAnimation(parameter, {
    getValues: () => values,
    onChange,
    requestFrame: (callback) => { pending.set(++sequence, callback); return sequence; },
    cancelFrame: (frame) => { pending.delete(frame); },
    isHidden: () => hidden,
  });
  return {
    stop, onChange, pending,
    values: () => values,
    setValues: (next: typeof values) => { values = next; },
    hide: (next: boolean) => { hidden = next; },
    tick: (time: number) => {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback(time);
    },
  };
}

describe('Parameter animation lifecycle', () => {
  it('changes live values without overwriting other parameters', () => {
    const player = animation();
    player.tick(0);
    player.setValues({ a: 4, b: 9 });
    player.tick(100);
    expect(player.values()).toEqual({ a: 4.1, b: 9 });
    player.stop();
  });

  it('stops immediately for pause, reset or unmount and ignores an already queued callback', () => {
    const player = animation();
    player.tick(0);
    player.tick(100);
    const queued = [...player.pending.values()][0];
    player.stop();
    player.stop();
    player.setValues({ a: 4, b: 2 });
    queued(200);
    expect(player.values()).toEqual({ a: 4, b: 2 });
    expect(player.onChange).toHaveBeenCalledTimes(1);
    expect(player.pending.size).toBe(0);
  });

  it('pauses hidden-tab progress and does not jump forward on return', () => {
    const player = animation();
    player.tick(0);
    player.tick(100);
    player.hide(true);
    player.tick(5000);
    expect(player.values().a).toBe(4.1);
    player.hide(false);
    player.tick(5100);
    expect(player.values().a).toBe(4.2);
    player.stop();
  });

  it('reverses at bounds instead of sticking at the maximum', () => {
    const player = animation({ name: 'a', min: 0, max: 1, value: 0.99, step: 0.001 });
    player.tick(0);
    player.tick(100);
    const nearMaximum = player.values().a;
    player.tick(200);
    expect(nearMaximum).toBeLessThanOrEqual(1);
    expect(player.values().a).toBeLessThan(nearMaximum);
    expect(player.values().a).toBeGreaterThanOrEqual(0);
    player.stop();
  });

  it('avoids repeated redraws while a coarse parameter has not reached its next step', () => {
    const player = animation({ name: 'a', min: 0, max: 1, value: 0, step: 0.5 });
    for (let time = 0; time <= 1000; time += 100) player.tick(time);
    expect(player.onChange).not.toHaveBeenCalled();
    player.stop();
  });
});
