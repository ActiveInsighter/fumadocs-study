import { readFileSync } from 'node:fs';
import { compile } from '@mdx-js/mdx';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseStudySpec } from '../lib/smart-ui/validate';
import { decomposeAddress } from '../lib/smart-ui/memory-address';
import { remarkJsonRender } from '../lib/mdx/remark-json-render';
import { formatSpecJson, tokenizeJson } from '../lib/smart-ui/format-json';
import SmartUIRenderer from '../components/smart-ui/renderer';
import { SmartUI } from '../components/smart-ui';
import { JsonSource } from '../components/smart-ui/json-source';

const document = readFileSync('content/docs/408/knowledge/smart-ui-demo.mdx', 'utf8');
const examples = [...document.matchAll(/```json-render\n([\s\S]*?)\n```/gu)].map((match) => match[1]);
const minimal = () => ({ root: 'text', elements: { text: { type: 'Text', props: { text: '你好 <script>alert(1)</script>' }, children: [] } }, state: {} });

describe('smart UI document contract', () => {
  it('validates and server-renders all four real examples', () => {
    expect(examples).toHaveLength(4);
    for (const code of examples) {
      const spec = parseStudySpec(code);
      const html = renderToStaticMarkup(<SmartUIRenderer spec={spec} code={code} />);
      expect(html).toContain('data-smart-ui="true"');
      expect(html).not.toContain('NaN');
    }
  });

  it('compiles Markdown fences to SmartUI with the original JSON as a string', async () => {
    const compiled = String(await compile('```json-render\n' + JSON.stringify(minimal()) + '\n```', { remarkPlugins: [remarkJsonRender] }));
    expect(compiled).toContain('SmartUI');
    expect(compiled).toContain('code:');
    const ordinary = String(await compile('```json\n{"a":1}\n```', { remarkPlugins: [remarkJsonRender] }));
    expect(ordinary).not.toContain('SmartUI');
  });

  it('escapes generated strings rather than executing HTML', () => {
    const code = JSON.stringify(minimal());
    const html = renderToStaticMarkup(<SmartUIRenderer spec={parseStudySpec(code)} code={code} />);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('keeps surrounding document text readable when a block is invalid', () => {
    const html = renderToStaticMarkup(<article><p>正文前半部分</p><SmartUI code="{invalid" /><p>正文后半部分</p></article>);
    expect(html).toContain('role="alert"');
    expect(html).toContain('交互内容暂时无法显示');
    expect(html).toContain('正文前半部分');
    expect(html).toContain('正文后半部分');
  });

  it.each([
    ['unknown component', (s: ReturnType<typeof minimal>) => { s.elements.text.type = 'ArbitraryCode'; }],
    ['invalid props', (s: ReturnType<typeof minimal>) => { Object.assign(s.elements.text.props, { html: '<iframe>' }); }],
    ['missing child', (s: ReturnType<typeof minimal>) => { s.elements.text.type = 'Stack'; s.elements.text.props = {} as never; s.elements.text.children = ['missing'] as never; }],
    ['cycle', (s: ReturnType<typeof minimal>) => { s.elements.text.type = 'Stack'; s.elements.text.props = {} as never; s.elements.text.children = ['text'] as never; }],
    ['undeclared state', (s: ReturnType<typeof minimal>) => { s.elements.text.props.text = { $state: '/missing' } as never; }],
    ['unsupported expression', (s: ReturnType<typeof minimal>) => { s.elements.text.props.text = { $computed: 'fetch' } as never; }],
    ['watchers', (s: ReturnType<typeof minimal>) => { Object.assign(s.elements.text, { watch: { '/x': { action: 'navigate' } } }); }],
    ['unknown action', (s: ReturnType<typeof minimal>) => { Object.assign(s.elements.text, { on: { press: { action: 'navigate', params: { url: 'https://example.com' } } } }); }],
    ['orphan', (s: ReturnType<typeof minimal>) => { Object.assign(s.elements, { extra: { type: 'Text', props: { text: 'unused' }, children: [] } }); }],
  ])('rejects %s', (_label, mutate) => {
    const spec = minimal();
    mutate(spec);
    expect(() => parseStudySpec(JSON.stringify(spec))).toThrow();
  });

  it('rejects prototype keys, oversized JSON and empty fences', () => {
    expect(() => parseStudySpec('{"__proto__":{}}')).toThrow(/键/);
    expect(() => parseStudySpec(' '.repeat(100001))).toThrow(/100 KB/);
    expect(() => parseStudySpec('')).toThrow();
  });

  it('rejects changes to state types and actions that break component constraints', () => {
    const spec = JSON.parse(examples[1]);
    spec.elements.sameBlock.on.press.params.value = '53';
    expect(() => parseStudySpec(JSON.stringify(spec))).toThrow(/状态类型/);
    spec.elements.sameBlock.on.press.params.value = 99999;
    expect(() => parseStudySpec(JSON.stringify(spec))).toThrow();
  });

  it('rejects invalid cache geometry', () => {
    const spec = JSON.parse(examples[1]);
    spec.elements.bits.props.lines = 3;
    expect(() => parseStudySpec(JSON.stringify(spec))).toThrow(/2 的幂/);
  });

  it('exports a prompt and machine-readable catalog matching registered components', () => {
    const prompt = readFileSync('public/smart-ui/authoring-prompt.md', 'utf8');
    const contract = JSON.parse(readFileSync('public/smart-ui/catalog.json', 'utf8'));
    expect(Object.keys(contract.components)).toHaveLength(9);
    expect(prompt).toContain('不是 JSONL patches');
    const example = /```json-render\n([\s\S]*?)\n```/u.exec(prompt);
    expect(example).not.toBeNull();
    expect(() => parseStudySpec(example![1])).not.toThrow();
  });
});

describe('16-bit direct-mapped Cache arithmetic', () => {
  it('distinguishes byte offsets, lines and conflicting tags', () => {
    expect(decomposeAddress(52, 16, 8)).toMatchObject({ block: 3, line: 3, offset: 4, tag: 0 });
    expect(decomposeAddress(53, 16, 8)).toMatchObject({ block: 3, line: 3, offset: 5, tag: 0 });
    expect(decomposeAddress(64, 16, 8)).toMatchObject({ block: 4, line: 4, offset: 0, tag: 0 });
    expect(decomposeAddress(180, 16, 8)).toMatchObject({ block: 11, line: 3, offset: 4, tag: 1 });
  });

  it('handles zero-width fields and reconstructs the largest unsigned address', () => {
    const result = decomposeAddress(65535, 256, 256);
    expect(result.fields[0]).toMatchObject({ width: 0, bits: '', value: 0 });
    expect(result.fields.map((field) => field.bits).join('')).toBe('1111111111111111');
    expect(decomposeAddress(0, 1, 1).fields.map((field) => field.bits).join('')).toBe('0000000000000000');
  });
});

describe('unified visual system', () => {
  const css = readFileSync('components/smart-ui/smart-ui.css', 'utf8');
  const sources = ['registry.tsx', 'renderer.tsx', 'json-source.tsx', 'index.tsx', 'lazy.tsx']
    .map((file) => readFileSync(`components/smart-ui/${file}`, 'utf8'))
    .join('\n');

  it('draws only from the shared black-and-white theme tokens', () => {
    // No hard-coded colours: the stylesheet and components must use semantic tokens.
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/iu);
    expect(css).not.toMatch(/\b(?:rgb|hsl|oklch)\(/iu);
    expect(sources).not.toMatch(/#[0-9a-f]{3,8}\b/iu);
    expect(sources).not.toMatch(/\b(?:red|green|blue|amber|emerald|yellow|orange|sky|indigo|violet)-\d{2,3}\b/u);
  });

  it('reuses the shared Tabs and code-surface tokens instead of bespoke widgets', () => {
    expect(sources).toContain("@/components/ui/tabs");
    expect(sources).toContain('--docs-code-block-background');
    expect(sources).not.toContain('smart-ui-card');
  });

  it('wraps every block in a rounded bordered frame with preview and JSON tabs', () => {
    const code = JSON.stringify(minimal());
    const html = renderToStaticMarkup(<SmartUIRenderer spec={parseStudySpec(code)} code={code} />);
    expect(html).toContain('rounded-xl border');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('预览');
    expect(html).toContain('>JSON<');
    expect(html).toContain('aria-label="重置交互"');
  });

  it('renders the pretty-printed JSON source in the shared code surface', () => {
    const code = JSON.stringify(minimal());
    const html = renderToStaticMarkup(<JsonSource code={code} />);
    expect(html).toContain('data-slot="smart-ui-source"');
    expect(html).toContain('aria-label="复制 JSON"');
    expect(html).toContain('&quot;root&quot;');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders neutral success and warning feedback with icons rather than colours', () => {
    const spec = { root: 'stack', state: {}, elements: {
      stack: { type: 'Stack', props: {}, children: ['ok', 'no'] },
      ok: { type: 'Text', props: { text: '正确', tone: 'success' }, children: [] },
      no: { type: 'Text', props: { text: '再想想', tone: 'warning' }, children: [] },
    } };
    const code = JSON.stringify(spec);
    const html = renderToStaticMarkup(<SmartUIRenderer spec={parseStudySpec(code)} code={code} />);
    expect(html.match(/role="status"/gu)).toHaveLength(2);
    expect(html.match(/<svg/gu)!.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('border-dashed');
  });

  it('gives only nested cards their own border', () => {
    const spec = { root: 'outer', state: {}, elements: {
      outer: { type: 'Card', props: { title: '外层' }, children: ['inner'] },
      inner: { type: 'Card', props: { title: '内层' }, children: [] },
    } };
    const code = JSON.stringify(spec);
    const html = renderToStaticMarkup(<SmartUIRenderer spec={parseStudySpec(code)} code={code} />);
    expect(html.match(/data-slot="smart-card"/gu)).toHaveLength(2);
    expect(html).toContain('in-data-[slot=smart-card]:border');
  });
});

describe('JSON source formatting', () => {
  it('pretty-prints minified JSON and leaves invalid text readable', () => {
    expect(formatSpecJson('{"a":[1,2],"b":{"c":true}}')).toBe('{\n  "a": [\n    1,\n    2\n  ],\n  "b": {\n    "c": true\n  }\n}');
    expect(formatSpecJson('  {oops ')).toBe('{oops');
  });

  it('tokenizes keys, strings, numbers, literals and punctuation losslessly', () => {
    const text = '{"k":"v \\"q\\"","n":-1.5e3,"t":true,"z":null}';
    const tokens = tokenizeJson(text);
    expect(tokens.map((token) => token.text).join('')).toBe(text);
    const types = (type: string) => tokens.filter((token) => token.type === type).map((token) => token.text);
    expect(types('key')).toEqual(['"k"', '"n"', '"t"', '"z"']);
    expect(types('string')).toEqual(['"v \\"q\\""']);
    expect(types('number')).toEqual(['-1.5e3']);
    expect(types('literal')).toEqual(['true', 'null']);
  });

  it('keeps a colon inside a string value from being treated as a key', () => {
    const tokens = tokenizeJson('{"url":"a:b"}');
    expect(tokens.filter((token) => token.type === 'key').map((token) => token.text)).toEqual(['"url"']);
    expect(tokens.find((token) => token.text === '"a:b"')?.type).toBe('string');
  });
});
