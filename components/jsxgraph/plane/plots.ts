import type { Board, Curve, GeometryElement, Point } from 'jsxgraph';
import { compileNumeric, implicitExpression, normalizeExpression, validateExpressionText, validateNumeric, type ExpressionCompiler, type Numeric } from '../core/expression';
import { formatNumber } from '../core/format';
import type { FunctionDefinition, PlotDefinition, PlotType } from './types';

/** Reader-controlled switches of one plot row; read live by JSXGraph. */
export interface PlotState {
  visible: boolean;
  probe: boolean;
  tangent: boolean;
  derivative: boolean;
}

export interface PlotContext {
  board: Board;
  compile: ExpressionCompiler;
  color: string;
  state: () => PlotState;
  /** Keep the probe where the reader left it when a formula is redrawn. */
  probeX?: number;
}

export interface PlotInstance {
  objects: GeometryElement[];
  f?: (x: number) => number;
  probe?: Point;
  area?: { bounds: () => [number, number]; value: () => number };
}

export interface PlotField {
  key: string;
  label: string;
  aria: string;
  wide?: boolean;
  value: (definition: PlotDefinition) => string;
}

interface PlotKind<T extends PlotDefinition> {
  /** Name shown in the “add plot” menu. */
  title: string;
  seed: T;
  fields: PlotField[];
  /** Rebuild a definition from submitted field values, keeping style options. */
  read: (definition: T, values: Record<string, string>) => T;
  describe: (definition: T) => string;
  validate: (definition: T) => void;
  create: (context: PlotContext, definition: T) => PlotInstance;
}

const TAU = 6.283185307179586;
/** Show multiples of π the way readers type them, e.g. 6.283185307179586 → 2*PI. */
const text = (value: Numeric | undefined) => {
  if (typeof value !== 'number') return value ?? '';
  const turns = value / Math.PI;
  const whole = Math.round(turns);
  if (whole !== 0 && Math.abs(turns - whole) < 1e-12) return whole === 1 ? 'PI' : whole === -1 ? '-PI' : `${whole}*PI`;
  return String(value);
};
/** Numeric fields accept numbers or parameter expressions such as `2*a`. */
const numeric = (value: string | undefined): Numeric => {
  const trimmed = (value ?? '').trim();
  return trimmed !== '' && Number.isFinite(Number(trimmed)) ? Number(trimmed) : trimmed;
};
const stripPrefix = (expression: string, name: string) => expression.replace(new RegExp(`^\\s*${name}\\s*=\\s*`), '');

function validateRange(range: unknown, label: string): void {
  if (!Array.isArray(range) || range.length !== 2) throw new Error(`${label}必须是 [起点, 终点]。`);
  range.forEach((value, index) => validateNumeric(value, `${label}${index ? '终点' : '起点'}`));
  if (typeof range[0] === 'number' && typeof range[1] === 'number' && range[0] >= range[1]) throw new Error(`${label}必须递增。`);
}

function curveAttributes(context: PlotContext, definition: PlotDefinition) {
  return { strokeColor: context.color, strokeWidth: 2.6, dash: definition.dashed ? 2 : 0, highlight: false, visible: () => context.state().visible };
}

/** Add elements one by one, removing the partial construction if any step throws. */
function construct(board: Board, build: (add: <E = GeometryElement>(element: unknown) => E) => Omit<PlotInstance, 'objects'>): PlotInstance {
  const objects: GeometryElement[] = [];
  // board.create is typed as a union of element shapes; each call here makes one element.
  const add = <E = GeometryElement>(element: unknown): E => { objects.push(element as GeometryElement); return element as E; };
  try {
    const rest = build(add);
    return { objects, ...rest };
  } catch (error) {
    board.removeObject([...objects].reverse());
    throw error;
  }
}

/** Composite Simpson rule; non-finite samples make the value undefined. */
export function integrate(f: (x: number) => number, a: number, b: number, steps = 400): number {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  if (a === b) return 0;
  const n = steps % 2 ? steps + 1 : steps;
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) sum += f(a + i * h) * (i % 2 ? 4 : 2);
  return Number.isFinite(sum) ? (sum * h) / 3 : NaN;
}

export function centralDerivative(f: (x: number) => number, x: number): number {
  const h = 1e-4 * Math.max(1, Math.abs(x));
  return (f(x + h) - f(x - h)) / (2 * h);
}

const functionKind: PlotKind<FunctionDefinition & PlotDefinition> = {
  title: '显函数 y = f(x)',
  seed: { type: 'function', expression: 'sin(x)', probe: true },
  fields: [{ key: 'expression', label: 'y =', aria: '函数表达式', wide: true, value: (d) => (d as FunctionDefinition).expression }],
  read: (definition, values) => ({ ...definition, expression: stripPrefix(values.expression, 'y') }),
  describe: (definition) => `y = ${definition.expression}`,
  validate(definition) {
    validateExpressionText(definition.expression, '函数表达式');
    if (definition.domain !== undefined) validateRange(definition.domain, '定义域');
    if (definition.area !== undefined) validateRange(definition.area, '积分区间');
  },
  create(context, definition) {
    const { board, compile, color, state } = context;
    return construct(board, (add) => {
      const f = compile(definition.expression, ['x']);
      const domain = definition.domain?.map((value) => compileNumeric(value, compile));
      const curve = add<Curve>(board.create('functiongraph', domain ? [f, domain[0], domain[1]] : [f], curveAttributes(context, definition)));
      add(board.create('functiongraph', [(x: number) => centralDerivative(f, x)], {
        strokeColor: color, strokeWidth: 2.2, strokeOpacity: 0.85, dash: 3, highlight: false,
        visible: () => state().visible && state().derivative,
      }));

      let area: PlotInstance['area'];
      if (definition.area) {
        const [a, b] = definition.area.map((value) => compileNumeric(value, compile));
        const bounds = (): [number, number] => [a(), b()];
        const shade = add<Curve>(board.create('curve', [[0], [0]], { fillColor: color, fillOpacity: 0.16, strokeWidth: 0, highlight: false, visible: () => state().visible }));
        shade.updateDataArray = function () {
          const [left, right] = bounds();
          this.dataX = []; this.dataY = [];
          if (!Number.isFinite(left) || !Number.isFinite(right)) return;
          const steps = 160;
          this.dataX.push(left); this.dataY.push(0);
          for (let i = 0; i <= steps; i++) {
            const x = left + ((right - left) * i) / steps;
            const y = f(x);
            this.dataX.push(x); this.dataY.push(Number.isFinite(y) ? y : 0);
          }
          this.dataX.push(right); this.dataY.push(0);
        };
        area = { bounds, value: () => { const [left, right] = bounds(); return integrate(f, left, right); } };
      }

      const candidates = [context.probeX, definition.domain ? (domain![0]() + domain![1]()) / 2 : 1, 0, -1, 2, 0.5];
      const start = candidates.find((x): x is number => x !== undefined && Number.isFinite(x) && Number.isFinite(f(x)));
      let probe: Point | undefined;
      if (start !== undefined) {
        const shown = () => state().visible && state().probe;
        probe = add<Point>(board.create('glider', [start, f(start), curve], { name: '', size: 4.5, fillColor: color, strokeColor: '#fff', strokeWidth: 1.5, visible: shown, tabindex: 0, showInfobox: false }));
        add(board.create('tangent', [probe], { strokeColor: color, strokeWidth: 1.2, strokeOpacity: 0.65, dash: 0, highlight: false, visible: () => shown() && state().tangent }));
        add(board.create('text', [() => probe!.X(), () => probe!.Y(), () => `(${formatNumber(probe!.X())}, ${formatNumber(probe!.Y())})`], {
          fixed: true, fontSize: 12, strokeColor: color, display: 'internal', anchorX: 'left', anchorY: 'bottom', cssStyle: 'paint-order: stroke; stroke: var(--plot-paper, #fff); stroke-width: 3px;', offset: [8, 6], visible: shown, highlight: false,
        }));
      }
      return { f, probe, area };
    });
  },
};

const implicitKind: PlotKind<Extract<PlotDefinition, { type: 'implicit' }>> = {
  title: '隐式方程 F(x,y) = 0',
  seed: { type: 'implicit', expression: 'x^2+y^2=4' },
  fields: [{ key: 'expression', label: '方程', aria: '隐式方程', wide: true, value: (d) => (d as { expression: string }).expression }],
  read: (definition, values) => ({ ...definition, expression: values.expression }),
  describe: (definition) => definition.expression.includes('=') ? definition.expression : `${definition.expression} = 0`,
  validate(definition) {
    validateExpressionText(definition.expression, '隐式方程');
    implicitExpression(normalizeExpression(definition.expression));
  },
  create(context, definition) {
    return construct(context.board, (add) => {
      const F = context.compile(implicitExpression(normalizeExpression(definition.expression)), ['x', 'y']);
      add(context.board.create('implicitcurve', [F], curveAttributes(context, definition)));
      return {};
    });
  },
};

type Parametric = Extract<PlotDefinition, { type: 'parametric' }>;
const parametricKind: PlotKind<Parametric> = {
  title: '参数曲线 (x(t), y(t))',
  seed: { type: 'parametric', x: '3*cos(t)', y: '2*sin(t)', range: [0, TAU] },
  fields: [
    { key: 'x', label: 'x(t) =', aria: '参数曲线 x(t)', wide: true, value: (d) => (d as Parametric).x },
    { key: 'y', label: 'y(t) =', aria: '参数曲线 y(t)', wide: true, value: (d) => (d as Parametric).y },
    { key: 'min', label: 't 起点', aria: 't 起点', value: (d) => text((d as Parametric).range[0]) },
    { key: 'max', label: 't 终点', aria: 't 终点', value: (d) => text((d as Parametric).range[1]) },
  ],
  read: (definition, values) => ({ ...definition, x: values.x, y: values.y, range: [numeric(values.min), numeric(values.max)] }),
  describe: (definition) => `(${definition.x}, ${definition.y})`,
  validate(definition) {
    validateExpressionText(definition.x, 'x(t)');
    validateExpressionText(definition.y, 'y(t)');
    validateRange(definition.range, '参数范围');
  },
  create(context, definition) {
    const { board, compile } = context;
    return construct(board, (add) => {
      const [a, b] = definition.range.map((value) => compileNumeric(value, compile));
      add(board.create('curve', [compile(definition.x, ['t']), compile(definition.y, ['t']), a, b], curveAttributes(context, definition)));
      return {};
    });
  },
};

type Polar = Extract<PlotDefinition, { type: 'polar' }>;
const polarKind: PlotKind<Polar> = {
  title: '极坐标 r = r(θ)',
  seed: { type: 'polar', expression: '2*cos(3*t)', range: [0, TAU] },
  fields: [
    { key: 'expression', label: 'r(θ) =', aria: '极坐标方程', wide: true, value: (d) => (d as Polar).expression },
    { key: 'min', label: 'θ 起点', aria: 'θ 起点', value: (d) => text((d as Polar).range?.[0] ?? 0) },
    { key: 'max', label: 'θ 终点', aria: 'θ 终点', value: (d) => text((d as Polar).range?.[1] ?? TAU) },
  ],
  read: (definition, values) => ({ ...definition, expression: stripPrefix(values.expression, 'r'), range: [numeric(values.min), numeric(values.max)] }),
  describe: (definition) => `r = ${definition.expression}`,
  validate(definition) {
    validateExpressionText(definition.expression, '极坐标方程');
    if (definition.range !== undefined) validateRange(definition.range, 'θ 范围');
  },
  create(context, definition) {
    const { board, compile } = context;
    return construct(board, (add) => {
      // θ is written as t (or θ / theta, normalized by the compiler).
      const r = compile(definition.expression, ['t']);
      const [a, b] = (definition.range ?? [0, TAU]).map((value) => compileNumeric(value, compile));
      add(board.create('curve', [(t: number) => r(t) * Math.cos(t), (t: number) => r(t) * Math.sin(t), a, b], { ...curveAttributes(context, definition), numberPointsHigh: 1600 }));
      return {};
    });
  },
};

export const PLOT_KINDS: { [K in PlotType]: PlotKind<Extract<PlotDefinition, { type: K }>> } = {
  function: functionKind as PlotKind<Extract<PlotDefinition, { type: 'function' }>>,
  implicit: implicitKind,
  parametric: parametricKind,
  polar: polarKind,
};

export function plotKind<T extends PlotDefinition>(definition: T): PlotKind<T> {
  return PLOT_KINDS[definition.type] as unknown as PlotKind<T>;
}
