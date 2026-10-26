import { evaluate } from '@mdx-js/mdx';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as runtime from 'react/jsx-runtime';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import type { Pluggable } from 'unified';
import { describe, expect, it } from 'vitest';
import { rehypeKatexHtml } from '@/lib/mdx/rehype-katex-html';

const katex: Pluggable = [rehypeKatex, { strict: 'ignore', output: 'html' }];

async function compile(source: string, prerender: boolean) {
  const { default: Content } = await evaluate(
    { value: source, path: 'test.mdx' },
    {
      ...runtime,
      remarkPlugins: [remarkMath],
      rehypePlugins: prerender ? [katex, rehypeKatexHtml] : [katex],
    },
  );
  return Content;
}

/**
 * Serialiser differences that parse to the same DOM: React writes `style`
 * objects without KaTeX's trailing semicolon and escapes `>` in text.
 */
const normalizeStyles = (html: string) => html.replace(/;"/gu, '"').replaceAll('&gt;', '>');

function countElements(node: unknown): number {
  if (Array.isArray(node)) return node.reduce((sum: number, child) => sum + countElements(child), 0);
  if (node && typeof node === 'object' && 'props' in node) {
    const { children } = (node as { props: { children?: unknown } }).props;
    return 1 + countElements(children);
  }
  return 0;
}

const chapter = readFileSync(
  path.join(process.cwd(), 'content/docs/math/formulas/linear-algebra/05-第六章 二次型.mdx'),
  'utf8',
).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/u, '');

describe('rehypeKatexHtml', () => {
  it('renders the same HTML for a formula-heavy chapter', async () => {
    const [tree, prerendered] = await Promise.all([compile(chapter, false), compile(chapter, true)]);
    const treeHtml = renderToStaticMarkup(createElement(tree));
    const prerenderedHtml = renderToStaticMarkup(createElement(prerendered));

    expect(prerenderedHtml).toContain('<span class="katex-display"><span class="katex">');
    expect(normalizeStyles(prerenderedHtml)).toBe(normalizeStyles(treeHtml));
    expect(countElements(tree({}))).toBeGreaterThan(countElements(prerendered({})) * 10);
  });

  it('pre-renders formulas nested inside MDX components', async () => {
    const Content = await compile('<Callout>\n\n设 $x^2$\n\n$$\n\\frac{1}{2}\n$$\n\n</Callout>\n', true);
    const html = renderToStaticMarkup(
      createElement(Content, {
        components: { Callout: ({ children }: { children?: unknown }) => createElement('aside', null, children as never) },
      }),
    );
    expect(html).toContain('<aside><p>设 <span class="katex"><span class="katex-html"');
    expect(html).toContain('<span class="katex-display"><span class="katex">');
    expect(countElements(Content({ components: { Callout: () => null } }))).toBe(4);
  });

  it('keeps formulas in headings as pre-rendered spans', async () => {
    const Content = await compile('## 求 $x^2$ 的极值\n', true);
    expect(renderToStaticMarkup(createElement(Content))).toMatch(
      /<h2[^>]*>求 <span class="katex"><span class="katex-html"/u,
    );
  });
});
