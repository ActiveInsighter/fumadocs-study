import type { Board } from 'jsxgraph';

/** A literal number, or an expression in the board's parameters such as `2*a`. */
export type Numeric = number | string;
export type Evaluator = (...coordinates: number[]) => number;
/** Compile `expression` as a function of `variables`, with parameters bound live. */
export type ExpressionCompiler = (expression: string, variables: string[]) => Evaluator;

export const RESERVED = new Set([
  'x', 'y', 'z', 'u', 'v', 't', 'theta', 'PI', 'E', 'pi', 'e', 'NaN', 'Infinity',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'exp', 'log', 'ln', 'log2', 'log10', 'sqrt', 'cbrt', 'abs', 'pow', 'min', 'max', 'hypot',
  'floor', 'ceil', 'round', 'trunc', 'sign', 'random', 'factorial', 'binomial',
  'true', 'false', 'null', 'undefined', 'this', 'return', 'function', 'var', 'let', 'const',
]);

const SYMBOLS: [RegExp, string][] = [
  [/[−–]/g, '-'], [/[×·⋅]/g, '*'], [/÷/g, '/'], [/π/g, 'PI'], [/√\s*\(/g, 'sqrt('],
  [/²/g, '^2'], [/³/g, '^3'], [/θ/g, 't'], [/\btheta\b/g, 't'],
];

/** Accept the symbols readers paste from textbooks; the parser only knows ASCII. */
export function normalizeExpression(expression: string): string {
  return SYMBOLS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), expression).trim();
}

export function validateExpressionText(expression: unknown, label = '表达式'): asserts expression is string {
  if (typeof expression !== 'string' || !expression.trim() || expression.length > 2000) throw new Error(`${label}不能为空或超过 2000 字符。`);
}

export function validateNumeric(value: unknown, label: string): asserts value is Numeric {
  if (typeof value === 'number' ? !Number.isFinite(value) : typeof value !== 'string' || !value.trim() || value.length > 500) {
    throw new Error(`${label}必须是有限数值或参数表达式。`);
  }
}

/** Accept F=0 and lhs=rhs while leaving inequalities unsupported. */
export function implicitExpression(expression: string): string {
  const sides = expression.split('=');
  if (/[<>!]/.test(expression) || sides.length > 2 || sides.some((side) => !side.trim())) throw new Error('隐式方程请使用 F 或 左式=右式，不支持不等式。');
  return sides.length === 2 ? `(${sides[0]})-(${sides[1]})` : expression;
}

export function bindPlotExpression(evaluate: (...args: number[]) => number, coordinateCount: number, names: string[], getValues: () => Record<string, number>): Evaluator {
  // JSXGraph appends a suspendUpdate flag while sampling curves. It must not
  // become a coordinate or replace the first live parameter.
  return (...args: number[]) => evaluate(...args.slice(0, coordinateCount), ...names.map((name) => getValues()[name]));
}

/**
 * JessieCode compiles expressions to plain functions. Unknown names and
 * boolean results are rejected at compile time; NaN at a domain edge such as
 * log(0) is valid because JSXGraph breaks discontinuous samples itself.
 */
export function createCompiler(board: Board, names: string[], getValues: () => Record<string, number>): ExpressionCompiler {
  return (expression, variables) => {
    let f: Evaluator;
    let probe: unknown;
    try {
      const evaluate = board.jc.snippet(normalizeExpression(expression), true, [...variables, ...names].join(','), false) as (...args: number[]) => number;
      f = bindPlotExpression(evaluate, variables.length, names, getValues);
      probe = f(...variables.map(() => 0.5));
    } catch (error) {
      throw new Error(readableError(error, [...variables, ...names]));
    }
    if (typeof probe !== 'number') {
      const unknown = unknownNames(expression, [...variables, ...names]);
      throw new Error(unknown.length ? `公式中有未定义的名称 ${unknown.join('、')}；可用变量：${[...variables, ...names].join('、') || '无'}。` : '请输入数值表达式，不支持布尔比较或条件式。');
    }
    return f;
  };
}

/** Identifiers that are neither variables, parameters nor known math names. */
export function unknownNames(expression: string, known: string[]): string[] {
  const names = normalizeExpression(expression).match(/[A-Za-z_]\w*/g) ?? [];
  return [...new Set(names.filter((name) => !known.includes(name) && !RESERVED.has(name)))];
}

/** JessieCode reports parser internals; readers need the likely fix. */
function readableError(error: unknown, known: string[]): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/parse error/i.test(message)) return '公式语法有误：请检查括号是否成对、乘法是否写了 *（如 2*x）。';
  const unknown = /(?:undefined|unknown|not defined)[^A-Za-z_]*([A-Za-z_]\w*)/i.exec(message)?.[1];
  if (unknown || /undefined|unknown|not defined/i.test(message)) return `公式中有未定义的名称${unknown ? ` ${unknown}` : ''}；可用变量：${known.join('、') || '无'}。`;
  return message;
}

/** Numbers stay constant; strings follow the parameters on every evaluation. */
export function compileNumeric(value: Numeric, compile: ExpressionCompiler): () => number {
  if (typeof value === 'number') return () => value;
  const f = compile(value, []);
  return () => f();
}
