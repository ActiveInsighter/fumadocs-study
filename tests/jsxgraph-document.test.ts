import { readFileSync } from 'node:fs';
import { evaluate } from '@mdx-js/mdx';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import * as runtime from 'react/jsx-runtime';
import remarkMath from 'remark-math';
import { expect, it } from 'vitest';
import { FunctionPlot } from '@/components/jsxgraph/plane/function-plot';
import { SurfacePlot } from '@/components/jsxgraph/space/surface-plot';

it('renders every published JSXGraph example with valid configuration', async () => {
  const source = readFileSync('content/docs/math/function-plot.mdx', 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  const { default: Document } = await evaluate(source, { ...runtime, remarkPlugins: [remarkMath] });
  const html = renderToString(createElement(Document, { components: { FunctionPlot, SurfacePlot } }));
  expect(html).not.toContain('role="alert"');
  expect(html.match(/data-plot-mode="[23]d"/g)).toHaveLength(8);
});
