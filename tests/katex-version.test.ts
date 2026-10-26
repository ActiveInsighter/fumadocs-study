import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const fromRoot = createRequire(path.join(process.cwd(), 'package.json'));

/** The KaTeX a package loads, resolved from inside that package. */
function katexUsedBy(pkg: string) {
  const entry = path.join(process.cwd(), 'node_modules', pkg, 'package.json');
  return createRequire(entry).resolve('katex');
}

/**
 * The layout imports `katex/dist/katex.css` from the root `katex`. KaTeX 0.18
 * renamed its internal classes (`.base` → `.katex-base`, `.sizing` →
 * `.katex-sizing`, …), so formulas rendered by any other KaTeX lose their
 * sizing and vertical layout. `overrides` in package.json pins it.
 */
describe('KaTeX version', () => {
  it.each(['rehype-katex', '@vscode/markdown-it-katex'])(
    '%s renders with the KaTeX whose stylesheet the site loads',
    (pkg) => {
      expect(katexUsedBy(pkg)).toBe(fromRoot.resolve('katex'));
    },
  );
});
