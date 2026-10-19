'use client';

import { useCallback, useId, useRef, useState } from 'react';
import type { Board, Curve } from 'jsxgraph';
import { JSXGraphBoard } from './board';
import { bindPlotExpression, implicitExpression, initialParameterValues, PLOT_COLORS, validatePlotConfig } from './model';
import type { FunctionPlotProps, PlotParameter, PlotPoint } from './types';
import styles from './jsxgraph.module.css';

const EMPTY_PARAMETERS: PlotParameter[] = [];
const EMPTY_POINTS: PlotPoint[] = [];

export function FunctionPlot(props: FunctionPlotProps) {
  try { validatePlotConfig(props); }
  catch (error) { return <p role="alert">画图配置无效：{error instanceof Error ? error.message : String(error)}</p>; }
  // A changed declarative configuration gets fresh state; moving sliders never
  // recreates the board, curves, gliders, or the reader's current viewport.
  return <ConfiguredPlot key={JSON.stringify(props)} {...props} />;
}

function ConfiguredPlot({ plots, parameters = EMPTY_PARAMETERS, points = EMPTY_POINTS, ...boardProps }: FunctionPlotProps) {
  const id = useId();
  const [values, setValues] = useState(() => initialParameterValues(parameters));
  const valuesRef = useRef(values);
  const boardRef = useRef<Board | null>(null);
  const setup = useCallback((board: Board) => {
    const names = parameters.map((parameter) => parameter.name);
    function compile(expression: string, variables: string[]) {
      const evaluate = board.jc.snippet(expression, true, [...variables, ...names].join(','), false) as (...args: number[]) => number;
      return bindPlotExpression(evaluate, variables.length, names, () => valuesRef.current);
    }
    plots.forEach((plot, index) => {
      const color = plot.color ?? PLOT_COLORS[index % PLOT_COLORS.length];
      const attributes = { strokeColor: color, strokeWidth: 2.5, dash: plot.dashed ? 2 : 0, highlight: false };
      if (plot.type === 'function') {
        const f = compile(plot.expression, ['x']);
        const curve = board.create('functiongraph', plot.domain ? [f, ...plot.domain] : [f], attributes) as Curve;
        if (plot.probe) {
          const x = plot.domain ? (plot.domain[0] + plot.domain[1]) / 2 : 1;
          const point = board.create('glider', [x, f(x), curve], { name: '', size: 4, fillColor: color, strokeColor: color });
          board.create('tangent', [point], { strokeColor: color, strokeWidth: 1.5, dash: 2 });
          board.create('text', [() => point.X() + 0.15, () => point.Y() + 0.3, () => `(${point.X().toFixed(2)}, ${point.Y().toFixed(2)})`], { fixed: true, fontSize: 12, strokeColor: color, display: 'internal' });
        }
      } else if (plot.type === 'implicit') {
        board.create('implicitcurve', [compile(implicitExpression(plot.expression), ['x', 'y'])], attributes);
      } else {
        board.create('curve', [compile(plot.x, ['t']), compile(plot.y, ['t']), ...plot.range], attributes);
      }
    });
    for (const point of points) {
      board.create('point', [point.x, point.y], { name: point.name ?? '', fixed: point.fixed ?? false, fillColor: point.color ?? PLOT_COLORS[0], strokeColor: point.color ?? PLOT_COLORS[0], label: { display: 'internal' } });
    }
    boardRef.current = board;
    return () => { boardRef.current = null; };
  }, [parameters, plots, points]);

  function changeValues(next: Record<string, number>) {
    valuesRef.current = next;
    setValues(next);
    boardRef.current?.update();
  }

  return (
    <div className={`not-prose ${styles.plot}`}>
      <JSXGraphBoard {...boardProps} onInit={setup} />
      <ul className={styles.legend} aria-label="曲线图例">
        {plots.map((plot, index) => <li key={index}><span style={{ backgroundColor: plot.color ?? PLOT_COLORS[index % PLOT_COLORS.length] }} /><code>{plot.label ?? (plot.type === 'parametric' ? `(${plot.x}, ${plot.y})` : plot.expression)}</code></li>)}
      </ul>
      {parameters.length ? <div className={styles.parameters}>
        {parameters.map(({ name, label, min, max, step = 0.1 }) => <div key={name} className={styles.parameter}>
          <label htmlFor={`${id}-${name}`}>{label ?? name} <output htmlFor={`${id}-${name}`}>{Number(values[name].toFixed(6))}</output></label>
          <input id={`${id}-${name}`} type="range" min={min} max={max} step={step} value={values[name]} onChange={(event) => changeValues({ ...valuesRef.current, [name]: Number(event.currentTarget.value) })} />
        </div>)}
        <button type="button" onClick={() => changeValues(initialParameterValues(parameters))}>重置参数</button>
      </div> : null}
    </div>
  );
}
