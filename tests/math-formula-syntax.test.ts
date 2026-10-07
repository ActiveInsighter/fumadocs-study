import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import katex from 'katex';
import { describe, expect, it } from 'vitest';

type MathSegment = {
  value: string;
  displayMode: boolean;
  offset: number;
};

const mathRoot = path.join(process.cwd(), 'content', 'docs', 'math');

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

describe('math document formulas', () => {
  it('renders every formula with KaTeX and rejects doubled LaTeX escapes', () => {
    const files = walkMarkdownFiles(mathRoot);
    const failures: string[] = [];
    let formulaCount = 0;

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const raw = readFileSync(file, 'utf8');
      const source = stripNonMathCode(raw);
      const relative = path.relative(process.cwd(), file).replaceAll('\\', '/');
      const { segments, delimiterErrors } = extractMathSegments(source);

      for (const error of delimiterErrors) {
        failures.push(`${relative}: ${error}`);
      }

      for (const segment of segments) {
        formulaCount += 1;
        const line = lineNumberAt(source, segment.offset);

        const doubledEscape = /(?<!\\)\\\\(?![\\\s[])/u.exec(segment.value);
        if (doubledEscape) {
          failures.push(
            `${relative}:${line}: doubled LaTeX escape near "${compactSnippet(
              segment.value,
            )}"`,
          );
          continue;
        }

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
      }
    }

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
  });
});
