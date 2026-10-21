/**
 * Sandboxed expression compiler shared by the 2D and 3D math plots.
 *
 * MDX props must stay serialisable (server components cannot pass functions to
 * client components), so every curve, surface and region is written as text
 * and compiled here into a closure. The compiler never uses eval / Function.
 *
 * Grammar (lowest precedence first):
 *   or      := and (('||' | 'or') and)*
 *   and     := not (('&&' | 'and') not)*
 *   not     := ('!' | 'not') not | compare
 *   compare := sum (('<' | '<=' | '>' | '>=') sum)*      chained: 0 < x < 1
 *   sum     := term (('+' | '-') term)*
 *   term    := unary (('*' | '/' | implicit) unary)*
 *   unary   := ('+' | '-') unary | power
 *   power   := atom ('^' unary)?
 *
 * Logical results are 1 / 0, so inequalities can be used directly as region
 * predicates: "x^2 + y^2 <= 1 && y >= 0".
 */

export type Scope = Record<string, number>;
export type Evaluator = (scope: Scope) => number;

type Node = (scope: Scope) => number;

/** Real power: negative bases with odd-denominator rational exponents stay real (x^(1/3), x^(2/3)). */
export function realPow(base: number, exponent: number): number {
  if (base >= 0 || Number.isInteger(exponent)) return Math.pow(base, exponent);
  for (const d of [3, 5, 7, 9]) {
    const n = exponent * d;
    const rounded = Math.round(n);
    if (Math.abs(n - rounded) < 1e-9) {
      const magnitude = Math.pow(-base, exponent);
      return rounded % 2 === 0 ? magnitude : -magnitude;
    }
  }
  return Number.NaN;
}

const FUNCS: Record<string, { fn: (...a: number[]) => number; arity: number | null }> = {
  sin: { fn: Math.sin, arity: 1 },
  cos: { fn: Math.cos, arity: 1 },
  tan: { fn: Math.tan, arity: 1 },
  cot: { fn: (x) => 1 / Math.tan(x), arity: 1 },
  sec: { fn: (x) => 1 / Math.cos(x), arity: 1 },
  csc: { fn: (x) => 1 / Math.sin(x), arity: 1 },
  asin: { fn: Math.asin, arity: 1 },
  acos: { fn: Math.acos, arity: 1 },
  atan: { fn: Math.atan, arity: 1 },
  arcsin: { fn: Math.asin, arity: 1 },
  arccos: { fn: Math.acos, arity: 1 },
  arctan: { fn: Math.atan, arity: 1 },
  arccot: { fn: (x) => Math.PI / 2 - Math.atan(x), arity: 1 },
  sinh: { fn: Math.sinh, arity: 1 },
  cosh: { fn: Math.cosh, arity: 1 },
  tanh: { fn: Math.tanh, arity: 1 },
  sh: { fn: Math.sinh, arity: 1 },
  ch: { fn: Math.cosh, arity: 1 },
  th: { fn: Math.tanh, arity: 1 },
  exp: { fn: Math.exp, arity: 1 },
  ln: { fn: Math.log, arity: 1 },
  log: { fn: Math.log, arity: 1 },
  lg: { fn: Math.log10, arity: 1 },
  log10: { fn: Math.log10, arity: 1 },
  log2: { fn: Math.log2, arity: 1 },
  sqrt: { fn: Math.sqrt, arity: 1 },
  cbrt: { fn: Math.cbrt, arity: 1 },
  abs: { fn: Math.abs, arity: 1 },
  sign: { fn: Math.sign, arity: 1 },
  sgn: { fn: Math.sign, arity: 1 },
  floor: { fn: Math.floor, arity: 1 },
  ceil: { fn: Math.ceil, arity: 1 },
  round: { fn: Math.round, arity: 1 },
  frac: { fn: (x) => x - Math.floor(x), arity: 1 },
  min: { fn: Math.min, arity: null },
  max: { fn: Math.max, arity: null },
  hypot: { fn: Math.hypot, arity: null },
  atan2: { fn: Math.atan2, arity: 2 },
  pow: { fn: realPow, arity: 2 },
  mod: { fn: (a, b) => a - b * Math.floor(a / b), arity: 2 },
};

const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E, tau: 2 * Math.PI };
const WORD_OPS = new Set(['and', 'or', 'not']);

/** Variables every expression may use; plots bind the ones they need. */
export const BUILTIN_VARS = ['x', 'y', 'z', 't', 'u', 'v', 'r', 'theta', 'phi', 'rho'] as const;

interface Token {
  type: 'num' | 'id' | 'op';
  value: string;
}

const MAX_LENGTH = 600;

function normalise(source: string) {
  return source
    .replace(/π/g, 'pi')
    .replace(/θ/g, 'theta')
    .replace(/φ|ϕ/g, 'phi')
    .replace(/ρ/g, 'rho')
    .replace(/·|×/g, '*')
    .replace(/÷/g, '/')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/−/g, '-')
    .replace(/\*\*/g, '^');
}

function tokenize(source: string, names: Set<string>): Token[] {
  const out: Token[] = [];
  const s = normalise(source);
  const vocabulary = [...Object.keys(FUNCS), ...Object.keys(CONSTS), ...WORD_OPS, ...names];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const rest = s.slice(i);
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(rest);
    if (num) {
      // "2e" followed by a non-digit is 2·e, not an exponent.
      out.push({ type: 'num', value: num[0] });
      i += num[0].length;
      continue;
    }
    // Letters only, so "x2" reads as x·2; digits are allowed in log10/log2/atan2.
    const id = /^(log10|log2|atan2|[a-z_]+)/i.exec(rest);
    if (id) {
      // Split glued identifiers such as "xy" or "2pix" into known pieces.
      let word = id[0];
      while (word) {
        const lower = word.toLowerCase();
        // Longest match wins; on a tie the exact-case name wins, so a slider "R" is not read as r.
        const known = vocabulary
          .filter((k) => lower.startsWith(k.toLowerCase()))
          .sort((a, b) => b.length - a.length || Number(word.startsWith(b)) - Number(word.startsWith(a)))[0];
        if (!known) throw new Error(`无法识别 “${word}”`);
        out.push({ type: WORD_OPS.has(known) ? 'op' : 'id', value: known });
        word = word.slice(known.length);
      }
      i += id[0].length;
      continue;
    }
    const op = /^(<=|>=|&&|\|\||==|[-+*/^(),<>!=|])/.exec(rest);
    if (op) {
      out.push({ type: 'op', value: op[0] });
      i += op[0].length;
      continue;
    }
    throw new Error(`无法识别字符 “${c}”`);
  }
  return out;
}

const COMPARE: Record<string, (a: number, b: number) => boolean> = {
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
};

export interface CompileOptions {
  /** Extra variable names (slider parameters). */
  params?: readonly string[];
}

interface Parsed {
  root: Node;
  /** Top-level `L = R` equation; root then evaluates L - R. */
  equation: boolean;
  /** Top-level conjunction of comparisons, as signed constraints g(scope) <= 0. */
  constraints: Node[] | null;
}

function parse(source: string, options: CompileOptions = {}): Parsed {
  if (typeof source !== 'string' || !source.trim()) throw new Error('表达式为空');
  if (source.length > MAX_LENGTH) throw new Error(`表达式过长（最多 ${MAX_LENGTH} 个字符）`);
  const names = new Set<string>([...BUILTIN_VARS, ...(options.params ?? [])]);
  const toks = tokenize(source, names);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.type === 'op' && peek().value === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new Error(`缺少 “${v}”`);
    p++;
  };

  function or(): Node {
    let a = and();
    while (isOp('||') || isOp('or')) {
      p++;
      const l = a;
      const r = and();
      a = (s) => (l(s) || r(s) ? 1 : 0);
    }
    return a;
  }
  function and(): Node {
    let a = not();
    while (isOp('&&') || isOp('and')) {
      p++;
      const l = a;
      const r = not();
      a = (s) => (l(s) && r(s) ? 1 : 0);
    }
    return a;
  }
  function not(): Node {
    if (isOp('!') || isOp('not')) {
      p++;
      const a = not();
      return (s) => (a(s) ? 0 : 1);
    }
    return compare();
  }
  function compare(): Node {
    const first = sum();
    const tests: Node[] = [];
    let left = first;
    for (;;) {
      const t = peek();
      if (!(t?.type === 'op' && t.value in COMPARE)) break;
      p++;
      const right = sum();
      const cmp = COMPARE[t.value];
      const l = left;
      tests.push((s) => (cmp(l(s), right(s)) ? 1 : 0));
      left = right;
    }
    if (!tests.length) return first;
    if (tests.length === 1) return tests[0];
    return (s) => (tests.every((test) => test(s)) ? 1 : 0);
  }
  function sum(): Node {
    let a = term();
    while (isOp('+') || isOp('-')) {
      const op = toks[p++].value;
      const l = a;
      const r = term();
      a = op === '+' ? (s) => l(s) + r(s) : (s) => l(s) - r(s);
    }
    return a;
  }
  function term(): Node {
    let a = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = toks[p++].value;
        const l = a;
        const r = unary();
        a = op === '*' ? (s) => l(s) * r(s) : (s) => l(s) / r(s);
      } else if (peek() && (peek().type !== 'op' || peek().value === '(')) {
        const l = a;
        const r = unary();
        a = (s) => l(s) * r(s);
      } else return a;
    }
  }
  function unary(): Node {
    if (isOp('-')) {
      p++;
      const a = unary();
      return (s) => -a(s);
    }
    if (isOp('+')) {
      p++;
      return unary();
    }
    return power();
  }
  function power(): Node {
    const base = atom();
    if (isOp('^')) {
      p++;
      const e = unary();
      return (s) => realPow(base(s), e(s));
    }
    return base;
  }
  function atom(): Node {
    const t = toks[p++];
    if (!t) throw new Error('表达式不完整');
    if (t.type === 'num') {
      const n = Number(t.value);
      if (!Number.isFinite(n)) throw new Error('数值超出范围');
      return () => n;
    }
    if (t.type === 'id') {
      if (names.has(t.value)) {
        const k = t.value;
        return (s) => s[k] ?? Number.NaN;
      }
      if (t.value in CONSTS) {
        const n = CONSTS[t.value];
        return () => n;
      }
      const spec = FUNCS[t.value];
      // sin^2(x) → (sin x)^2
      let outerPower: Node | null = null;
      if (isOp('^')) {
        p++;
        outerPower = unary();
      }
      let args: Node[];
      if (isOp('(')) {
        p++;
        args = [or()];
        while (isOp(',')) {
          p++;
          args.push(or());
        }
        expect(')');
      } else {
        // Allow "sin x", "ln 2x" style application to the next factor.
        if (spec.arity !== 1) throw new Error(`${t.value} 后缺少 “(”`);
        let arg = power();
        // "sin 2x" → sin(2x): absorb juxtaposed numbers and variables, stop at the next function.
        while (peek() && (peek().type === 'num' || (peek().type === 'id' && !(peek().value in FUNCS)))) {
          const l = arg;
          const r = power();
          arg = (s) => l(s) * r(s);
        }
        args = [arg];
      }
      if (spec.arity !== null && args.length !== spec.arity)
        throw new Error(`${t.value} 需要 ${spec.arity} 个参数`);
      const fn = spec.fn;
      const call: Node =
        args.length === 1
          ? (s) => fn(args[0](s))
          : args.length === 2
            ? (s) => fn(args[0](s), args[1](s))
            : (s) => fn(...args.map((a) => a(s)));
      if (!outerPower) return call;
      const ep = outerPower;
      return (s) => realPow(call(s), ep(s));
    }
    if (t.value === '(') {
      const a = or();
      expect(')');
      return a;
    }
    if (t.value === '|') {
      // |x| absolute value
      const a = sum();
      expect('|');
      return (s) => Math.abs(a(s));
    }
    throw new Error(`意外的 “${t.value}”`);
  }

  // Split a top-level equation "L = R" before parsing.
  const eqIndex = toks.findIndex((t) => t.type === 'op' && (t.value === '=' || t.value === '=='));
  if (eqIndex >= 0) {
    const leftToks = toks.slice(0, eqIndex);
    const rightToks = toks.slice(eqIndex + 1);
    if (!leftToks.length || !rightToks.length) throw new Error('等式两侧不能为空');
    const parseSide = (side: Token[]) => {
      toks.splice(0, toks.length, ...side);
      p = 0;
      const node = sum();
      if (p < toks.length) throw new Error(`多余的 “${toks[p].value}”`);
      return node;
    };
    const original = toks.slice();
    const l = parseSide(leftToks);
    const r = parseSide(rightToks);
    toks.splice(0, toks.length, ...original);
    return { root: (s) => l(s) - r(s), equation: true, constraints: null };
  }

  // Try to read the source as a conjunction of comparisons for solids.
  const constraints: Node[] = [];
  const readConstraints = (): boolean => {
    p = 0;
    for (;;) {
      let left = sum();
      let sawComparison = false;
      for (;;) {
        const t = peek();
        if (!(t?.type === 'op' && t.value in COMPARE)) break;
        p++;
        const right = sum();
        const l = left;
        const r = right;
        constraints.push(t.value.startsWith('<') ? (s) => l(s) - r(s) : (s) => r(s) - l(s));
        left = right;
        sawComparison = true;
      }
      if (!sawComparison) return false;
      if (p >= toks.length) return true;
      if (isOp('&&') || isOp('and') || isOp(',')) {
        p++;
        continue;
      }
      return false;
    }
  };
  let constraintList: Node[] | null = null;
  try {
    if (readConstraints()) constraintList = constraints;
  } catch {
    constraintList = null;
  }

  p = 0;
  // Commas at the top level mean "and" for regions written as a list.
  const parts: Node[] = [or()];
  while (isOp(',')) {
    p++;
    parts.push(or());
  }
  if (p < toks.length) throw new Error(`多余的 “${toks[p].value}”`);
  const root: Node =
    parts.length === 1 ? parts[0] : (s) => (parts.every((part) => part(s)) ? 1 : 0);
  return { root, equation: false, constraints: constraintList };
}

export interface Compiled {
  evaluate: Evaluator;
  /** For "L = R" sources: evaluate returns L - R. */
  equation: boolean;
  /**
   * Signed constraints when the source is a conjunction of inequalities,
   * each g(scope) <= 0 inside. max(g_i) is a level-set function of the region.
   */
  constraints: Evaluator[] | null;
}

const cache = new Map<string, Compiled>();

/** Compile a source string. Results are cached by source and parameter names. */
export function compile(source: string, options: CompileOptions = {}): Compiled {
  const key = `${(options.params ?? []).join(',')}|${source}`;
  let hit = cache.get(key);
  if (!hit) {
    const parsed = parse(source, options);
    hit = { evaluate: parsed.root, equation: parsed.equation, constraints: parsed.constraints };
    if (cache.size > 2000) cache.clear();
    cache.set(key, hit);
  }
  return hit;
}

/** Evaluate a numeric literal or constant expression ("2pi", "sqrt(2)/2", "a+1"). */
export function evaluateValue(value: number | string, scope: Scope = {}, params: readonly string[] = []): number {
  if (typeof value === 'number') return value;
  return compile(value, { params }).evaluate(scope);
}

/** Validate a source string; returns an error message or null. */
export function checkExpression(source: string, options: CompileOptions = {}): string | null {
  try {
    compile(source, options);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
