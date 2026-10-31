import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Braces } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { Card, Cards, CardStep, CardSteps } from '../components/mdx/card';
import {
  charactersPerLine,
  fitsRow,
  measureNode,
  cardsMinWidth,
  cardWidth,
  measureCard,
  resolveCardStepsLayout,
  rowColumns,
  textWidth,
  type CardMetrics,
} from '../components/mdx/card/layout';
import { Icon, renderIcon, resolveLucideIcon } from '../components/mdx/icon';
import { renderStaticMarkdown } from '../scripts/static-docs-markdown.mjs';

const short = (title = '定义状态', body = '明确含义'): CardMetrics => measureCard({ title, children: body });

describe('Lucide icons by name', () => {
  it('matches a name however it is written, aliases included', () => {
    for (const name of ['Braces', 'braces', 'BracesIcon', 'LucideBraces', 'curly-braces', 'CurlyBraces']) {
      expect(resolveLucideIcon(name), name).toBe(Braces);
    }
    for (const name of ['ArrowRight', 'arrow-right', 'arrowRight', 'arrow_right', 'arrow right']) {
      expect(resolveLucideIcon(name), name).toBeDefined();
    }
    expect(resolveLucideIcon('git-branch')).toBe(resolveLucideIcon('GitBranch'));
  });

  it('renders text glyphs as text, nodes as given, and unknown names as nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(renderToStaticMarkup(<>{renderIcon('🚀')}</>)).toBe('<span data-slot="icon-glyph" aria-hidden="true">🚀</span>');
    expect(renderToStaticMarkup(<>{renderIcon(<b>x</b>)}</>)).toBe('<b>x</b>');
    expect(renderIcon('no-such-icon-anywhere')).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no-such-icon-anywhere'));
    expect(renderIcon('')).toBeNull();
  });

  it('draws inline icons in the line, decorative unless labelled', () => {
    const decorative = renderToStaticMarkup(<Icon name="terminal" />);
    expect(decorative).toContain('lucide-terminal');
    expect(decorative).toContain('aria-hidden="true"');
    expect(decorative).toContain('display:inline-block');
    const labelled = renderToStaticMarkup(<Icon name="terminal" label="终端" />);
    expect(labelled).toContain('role="img"');
    expect(labelled).toContain('aria-label="终端"');
    expect(labelled).not.toContain('aria-hidden');
  });

  it('resolves every icon name used in the documentation', () => {
    const missing: string[] = [];
    const visit = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) visit(path);
        else if (/\.mdx?$/u.test(entry.name)) {
          const source = readFileSync(path, 'utf8');
          for (const [, name] of source.matchAll(/<(?:Card|CardStep)\b[^>]*?\bicon="([^"]+)"/gu)) {
            if (/^[A-Za-z][\w -]*$/u.test(name) && !resolveLucideIcon(name)) missing.push(`${path}: ${name}`);
          }
          for (const [, name] of source.matchAll(/<Icon\b[^>]*?\bname="([^"]+)"/gu)) {
            if (!resolveLucideIcon(name)) missing.push(`${path}: ${name}`);
          }
        }
      }
    };
    visit(join(process.cwd(), 'content'));
    expect(missing).toEqual([]);
  });
});

describe('Card', () => {
  it('keeps the official props and markup hooks', () => {
    const html = renderToStaticMarkup(
      <Card icon="git-branch" title="分支" description="描述" href="/docs/x" tone="info">
        正文
      </Card>,
    );
    expect(html).toMatch(/^<a href="\/docs\/x" data-card="true" data-slot="card" data-tone="info">/u);
    expect(html).toContain('<span data-slot="card-icon" class="not-prose"><svg');
    expect(html).toContain('lucide-git-branch');
    expect(html).toContain('<h3 data-slot="card-title" class="not-prose">分支</h3>');
    expect(html).toContain('<p data-slot="card-description">描述</p>');
    expect(html).toContain('<div data-slot="card-body" class="prose-no-margin">正文</div>');
  });

  it('leaves out the tile, tone and body when they are not given', () => {
    const html = renderToStaticMarkup(<Card title="只有标题" tone="default" />);
    expect(html).toBe('<div data-card="true" data-slot="card"><h3 data-slot="card-title" class="not-prose">只有标题</h3></div>');
  });

  it('still accepts a React node as the icon', () => {
    expect(renderToStaticMarkup(<Card icon={<svg data-own="" />} title="t" />)).toContain('<svg data-own="">');
  });

  it('turns one-line cards that MDX wrapped in a paragraph back into grid cells', () => {
    const wrapped = renderToStaticMarkup(
      <Cards>
        <p>
          <Card title="a" />
          {'\n'}
          <Card title="b" />
        </p>
      </Cards>,
    );
    expect(wrapped).not.toContain('<p>');
    expect(wrapped.match(/data-slot="card"/gu)).toHaveLength(2);
    // A paragraph with text of its own is content, not a wrapper.
    expect(renderToStaticMarkup(<Cards><p>说明 <Card title="a" /></p></Cards>)).toContain('<p>说明 ');
  });

  it('sets the column count only when asked, within 1–4', () => {
    expect(renderToStaticMarkup(<Cards />)).toBe('<div data-slot="cards"></div>');
    expect(renderToStaticMarkup(<Cards columns={3} />)).toContain('style="--cards-columns:3"');
    expect(renderToStaticMarkup(<Cards columns={9} />)).toContain('style="--cards-columns:4"');
  });

  it('lets short cards shrink to two a row on a phone, and keeps long ones wide', () => {
    const short = renderToStaticMarkup(
      <Cards columns={4}>
        <Card icon="rocket" title="rocket" />
        <Card icon="rocket" title="LucideRocket" />
      </Cards>,
    );
    expect(short).toContain('style="--cards-columns:4;--cards-min:9rem"');
    const long = renderToStaticMarkup(
      <Cards>
        <Card title="a">{'很长的说明'.repeat(12)}</Card>
        <Card title="b">x</Card>
      </Cards>,
    );
    expect(long).toBe(
      '<div data-slot="cards"><div data-card="true" data-slot="card"><h3 data-slot="card-title" class="not-prose">a</h3>' +
        `<div data-slot="card-body" class="prose-no-margin">${'很长的说明'.repeat(12)}</div></div>` +
        '<div data-card="true" data-slot="card"><h3 data-slot="card-title" class="not-prose">b</h3><div data-slot="card-body" class="prose-no-margin">x</div></div></div>',
    );
    expect(renderToStaticMarkup(<Cards style={{ ['--cards-min' as string]: '12rem' }}><Card title="a" /></Cards>)).toContain('--cards-min:12rem');
  });
});

describe('CardSteps layout', () => {
  it('measures text in full-width characters', () => {
    expect(textWidth('步骤')).toBe(2);
    expect(textWidth('ab')).toBeCloseTo(1.1);
    expect(measureNode(<p>动态<strong>规划</strong>{3}</p>).width).toBeCloseTo(4.55);
    expect(measureNode(<span dangerouslySetInnerHTML={{ __html: '<span>x</span>' }} />).width).toBeCloseTo(0.55);
    expect(measureNode(<pre><code>x</code></pre>).wide).toBe(true);
    expect(measureNode(<span className="katex-display" />).wide).toBe(true);
  });

  it('finds the narrowest card each item reads comfortably in', () => {
    expect(cardWidth([short('标题', '一'.repeat(20))])).toBeCloseTo((20 / 4) * 0.875 + 2.25);
    expect(cardWidth([measureCard({ title: 't', children: <pre>x</pre> })])).toBe(Infinity);
    expect(cardsMinWidth([short('标题', '一二三')])).toBe(9);
    expect(cardsMinWidth([short('标题', '一'.repeat(30))])).toBe(11);
    expect(cardsMinWidth([short('标题', '一'.repeat(200))])).toBe(15);
    expect(cardsMinWidth([])).toBe(15);
  });

  it('balances rows of up to four cards', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((count) => rowColumns(count))).toEqual([1, 2, 3, 4, 3, 3, 4, 4, 3, 4]);
    expect(charactersPerLine(4)).toBeLessThan(charactersPerLine(2));
  });

  it('puts short steps in a row and long ones in a column', () => {
    expect(resolveCardStepsLayout([short(), short(), short()])).toEqual({ layout: 'row', columns: 3, compact: true });
    const long = short('标题', '很长的说明'.repeat(30));
    expect(resolveCardStepsLayout([short(), long, short()])).toEqual({ layout: 'column', columns: 1, compact: false });
    expect(resolveCardStepsLayout([short()])).toEqual({ layout: 'column', columns: 1, compact: false });
  });

  it('falls back to two a row when four a row is too tight', () => {
    const medium = short('标题', '一'.repeat(Math.ceil(charactersPerLine(4) * 5) + 5));
    expect(fitsRow(medium, 4)).toBe(false);
    expect(fitsRow(medium, 2)).toBe(true);
    expect(resolveCardStepsLayout([medium, medium, medium, medium])).toEqual({ layout: 'row', columns: 2, compact: false });
  });

  it('stacks steps holding code, tables or many blocks', () => {
    const code = measureCard({ title: 't', children: <pre>x</pre> });
    const blocks = measureCard({ title: 't', children: [<p key="1">a</p>, <p key="2">b</p>, <p key="3">c</p>] });
    expect(resolveCardStepsLayout([short(), code])).toEqual({ layout: 'column', columns: 1, compact: false });
    expect(resolveCardStepsLayout([short(), blocks])).toEqual({ layout: 'column', columns: 1, compact: false });
  });

  it('honours an explicit layout and column count', () => {
    const long = short('标题', '很长的说明'.repeat(30));
    expect(resolveCardStepsLayout([long, long], { layout: 'row' })).toEqual({ layout: 'row', columns: 2, compact: false });
    expect(resolveCardStepsLayout([short(), short()], { layout: 'column' })).toEqual({ layout: 'column', columns: 1, compact: false });
    expect(resolveCardStepsLayout([short(), short(), short(), short()], { columns: 2 })).toEqual({ layout: 'row', columns: 2, compact: true });
    expect(resolveCardStepsLayout([short(), short()], { layout: 'row', columns: 7 })).toEqual({ layout: 'row', columns: 4, compact: true });
  });
});

describe('CardSteps', () => {
  it('renders an ordered list of cards with counters, index and connectors', () => {
    const html = renderToStaticMarkup(
      <CardSteps>
        <CardStep title="定义状态" icon="braces">明确含义</CardStep>
        <CardStep title="寻找来源">推导转移</CardStep>
        <CardStep title="收尾" step="✓" tone="success" />
      </CardSteps>,
    );
    expect(html).toMatch(/^<div data-slot="card-steps" data-layout="row" data-columns="3" data-density="compact"><ol data-slot="card-steps-list">/u);
    expect(html.match(/<li data-slot="card-step">/gu)).toHaveLength(3);
    expect(html.match(/data-slot="card-step-connector"/gu)).toHaveLength(3);
    // Icon in the tile, padded number in the corner.
    expect(html).toContain('lucide-braces');
    expect(html).toContain('<span data-slot="card-step-index" aria-hidden="true"><span data-slot="card-step-count" data-format="padded"></span></span>');
    // No icon: the number fills the tile; `step` replaces it.
    expect(html).toContain('<span data-slot="card-icon" class="not-prose" aria-hidden="true"><span data-slot="card-step-count"></span></span>');
    expect(html).toContain('<span data-slot="card-icon" class="not-prose" aria-hidden="true">✓</span>');
    expect(html).toContain('data-tone="success"');
    // Title and body share one wrapper, so the text moves beside or under the tile as a block.
    expect(html).toContain('<div data-slot="card-step-text"><h3 data-slot="card-title" class="not-prose">寻找来源</h3><div data-slot="card-body" class="prose-no-margin">推导转移</div></div>');
    expect(html.match(/<div data-card="true" data-slot="card" data-card-step="">/gu)).toHaveLength(2);
  });

  it('marks only rows whose steps fit a phone-width card as compact', () => {
    const long = renderToStaticMarkup(
      <CardSteps layout="row">
        <CardStep title="a">{'很长的说明'.repeat(12)}</CardStep>
        <CardStep title="b">x</CardStep>
      </CardSteps>,
    );
    expect(long).toContain('data-layout="row" data-columns="2">');
    expect(long).not.toContain('data-density');
  });

  it('takes back one-line steps that MDX wrapped in a paragraph', () => {
    const html = renderToStaticMarkup(
      <CardSteps>
        <p>
          <CardStep title="a">x</CardStep>
          {'\n'}
          <CardStep title="b">y</CardStep>
        </p>
      </CardSteps>,
    );
    expect(html).not.toContain('<p>');
    expect(html.match(/<li data-slot="card-step">/gu)).toHaveLength(2);
    expect(html).toContain('data-layout="row" data-columns="2"');
  });

  it('starts counting from `start` and wraps foreign children in list items', () => {
    const html = renderToStaticMarkup(
      <CardSteps start={3} layout="column">
        <CardStep title="a" />
        <>
          <Card title="b" />
        </>
      </CardSteps>,
    );
    expect(html).toContain('data-layout="column" data-columns="1"');
    expect(html).toContain('<ol data-slot="card-steps-list" start="3" style="counter-reset:card-step 2">');
    expect(html).toContain('<li data-slot="card-step"><div data-card="true" data-slot="card"><h3 data-slot="card-title" class="not-prose">b</h3></div></li>');
  });
});

describe('CardStep Markdown export', () => {
  it('keeps step titles and descriptions like Card', async () => {
    const result = await renderStaticMarkdown(
      [
        '<CardSteps>',
        '<CardStep title="定义状态" description="dp 的含义" icon="braces">',
        '明确每个维度的意义。',
        '</CardStep>',
        '</CardSteps>',
      ].join('\n'),
      { title: '卡片步骤', url: '/docs/card-steps' },
    );
    expect(result).toContain('**定义状态**');
    expect(result).toContain('dp 的含义');
    expect(result).toContain('明确每个维度的意义。');
    expect(result).not.toContain('title=');
  });
});
