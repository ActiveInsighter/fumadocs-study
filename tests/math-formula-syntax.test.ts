import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import katex from 'katex';
import { describe, expect, it, vi } from 'vitest';

type MathSegment = {
  value: string;
  displayMode: boolean;
  offset: number;
};

const mathRoot = path.join(process.cwd(), 'content', 'docs', 'math');

const latexCommandNames = [
  "Longleftrightarrow",
  "scriptscriptstyle",
  "Longrightarrow",
  "longrightarrow",
  "Leftrightarrow",
  "longleftarrow",
  "operatorname",
  "displaystyle",
  "scriptstyle",
  "Rightarrow",
  "rightarrow",
  "varepsilon",
  "underbrace",
  "textstyle",
  "Leftarrow",
  "leftarrow",
  "underline",
  "widetilde",
  "overbrace",
  "therefore",
  "vartheta",
  "varsigma",
  "overline",
  "substack",
  "subseteq",
  "supseteq",
  "setminus",
  "emptyset",
  "underset",
  "mathcal",
  "epsilon",
  "upsilon",
  "Upsilon",
  "partial",
  "widehat",
  "overset",
  "because",
  "mathrm",
  "mathbf",
  "mathbb",
  "mathit",
  "mathsf",
  "mathtt",
  "limsup",
  "liminf",
  "lambda",
  "varrho",
  "varphi",
  "Lambda",
  "arcsin",
  "arccos",
  "arctan",
  "approx",
  "propto",
  "subset",
  "supset",
  "forall",
  "exists",
  "begin",
  "iiint",
  "dfrac",
  "tfrac",
  "binom",
  "alpha",
  "gamma",
  "delta",
  "theta",
  "kappa",
  "varpi",
  "sigma",
  "omega",
  "Gamma",
  "Delta",
  "Theta",
  "Sigma",
  "Omega",
  "infty",
  "nabla",
  "right",
  "boxed",
  "qquad",
  "times",
  "simeq",
  "equiv",
  "notin",
  "colon",
  "text",
  "iint",
  "oint",
  "prod",
  "frac",
  "sqrt",
  "beta",
  "zeta",
  "iota",
  "sinh",
  "cosh",
  "tanh",
  "left",
  "ddot",
  "quad",
  "cdot",
  "span",
  "vert",
  "Vert",
  "end",
  "int",
  "sum",
  "lim",
  "eta",
  "rho",
  "tau",
  "phi",
  "chi",
  "psi",
  "Phi",
  "Psi",
  "sin",
  "cos",
  "tan",
  "cot",
  "sec",
  "csc",
  "log",
  "exp",
  "bar",
  "hat",
  "vec",
  "dot",
  "div",
  "leq",
  "geq",
  "neq",
  "sim",
  "cup",
  "cap",
  "det",
  "ker",
  "dim",
  "max",
  "min",
  "sup",
  "inf",
  "mid",
  "mu",
  "nu",
  "xi",
  "pi",
  "Xi",
  "Pi",
  "ln",
  "pm",
  "mp",
  "le",
  "ge",
  "ne",
  "to",
  "in"
];

const doubledLatexCommandPattern = new RegExp(
  String.raw`(?<!\\)\\\\(?=(?:${latexCommandNames.join('|')})(?![A-Za-z]))`,
  'u',
);

function walkMarkdownFiles(root: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root)) {
    const fullPath = path.join(root, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath));
      continue;
    }

    if (/\.(?:md|mdx)$/u.test(entry)) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function stripNonMathCode(source: string): string {
  const withoutFences = source.replace(
    /```([^\n]*)\n([\s\S]*?)```/gu,
    (whole, info: string, body: string) => {
      return info.trim().toLowerCase().startsWith('mindmap') ? body : '\n';
    },
  );

  return withoutFences.replace(/`[^`\n]*`/gu, '');
}

function extractMathSegments(source: string): {
  segments: MathSegment[];
  delimiterErrors: string[];
} {
  const segments: MathSegment[] = [];
  const delimiterErrors: string[] = [];
  let index = 0;

  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2;
      continue;
    }

    if (source[index] !== '$') {
      index += 1;
      continue;
    }

    const displayMode = source[index + 1] === '$';
    const delimiter = displayMode ? '$$' : '$';
    const start = index;
    index += delimiter.length;
    const bodyStart = index;
    let found = false;

    while (index < source.length) {
      if (source[index] === '\\') {
        index += 2;
        continue;
      }

      if (displayMode) {
        if (source.startsWith('$$', index)) {
          found = true;
          break;
        }
      } else if (
        source[index] === '$' &&
        source[index - 1] !== '\\' &&
        source[index + 1] !== '$'
      ) {
        found = true;
        break;
      }

      index += 1;
    }

    if (!found) {
      delimiterErrors.push(
        `Unclosed ${delimiter} delimiter near offset ${start}`,
      );
      break;
    }

    segments.push({
      value: source.slice(bodyStart, index),
      displayMode,
      offset: start,
    });

    index += delimiter.length;
  }

  return { segments, delimiterErrors };
}

function lineNumberAt(source: string, offset: number): number {
  return source.slice(0, offset).split('\n').length;
}

function compactSnippet(value: string): string {
  return value.replace(/\s+/gu, ' ').trim().slice(0, 180);
}

function findForbiddenControlCharacters(source: string): Array<{
  line: number;
  code: number;
}> {
  const failures: Array<{ line: number; code: number }> = [];

  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      failures.push({ line: lineNumberAt(source, index), code });
    }
  }

  return failures;
}

describe('math document formulas', () => {
  it('renders every formula with KaTeX without parse errors or warnings', () => {
    const files = walkMarkdownFiles(mathRoot);
    const failures: string[] = [];
    let formulaCount = 0;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const raw = readFileSync(file, 'utf8');
      const relative = path.relative(process.cwd(), file).replaceAll('\\', '/');

      for (const control of findForbiddenControlCharacters(raw)) {
        failures.push(
          `${relative}:${control.line}: forbidden control character U+${control.code
            .toString(16)
            .toUpperCase()
            .padStart(4, '0')}`,
        );
      }

      const source = stripNonMathCode(raw);
      const { segments, delimiterErrors } = extractMathSegments(source);

      for (const error of delimiterErrors) {
        failures.push(`${relative}: ${error}`);
      }

      for (const segment of segments) {
        formulaCount += 1;
        const line = lineNumberAt(source, segment.offset);

        if (doubledLatexCommandPattern.test(segment.value)) {
          failures.push(
            `${relative}:${line}: doubled LaTeX command escape near "${compactSnippet(
              segment.value,
            )}"`,
          );
          continue;
        }

        warnSpy.mockClear();

        try {
          katex.renderToString(segment.value, {
            displayMode: segment.displayMode,
            throwOnError: true,
            strict: 'ignore',
            output: 'html',
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failures.push(
            `${relative}:${line}: KaTeX parse error: ${message}; formula="${compactSnippet(
              segment.value,
            )}"`,
          );
        }

        for (const warning of warnSpy.mock.calls) {
          failures.push(
            `${relative}:${line}: KaTeX warning: ${warning.map(String).join(' ')}; formula="${compactSnippet(
              segment.value,
            )}"`,
          );
        }
      }
    }

    warnSpy.mockRestore();

    if (failures.length > 0) {
      throw new Error(
        `Math formula validation failed with ${failures.length} issue(s):\n${failures.join(
          '\n',
        )}`,
      );
    }

    expect(formulaCount).toBeGreaterThan(0);
    console.log(
      `Validated ${formulaCount} formulas across ${files.length} math documents.`,
    );
  }, 15_000);
});
