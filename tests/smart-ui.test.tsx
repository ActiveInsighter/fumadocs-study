import { readFileSync } from 'node:fs';
import { compile } from '@mdx-js/mdx';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { shadcnComponentDefinitions } from '@json-render/shadcn/catalog';
import { resolveElementProps } from '@json-render/core';
import { studyCatalog } from '../lib/smart-ui/catalog';
import { parseStudySpec } from '../lib/smart-ui/validate';
import { remarkJsonRender } from '../lib/mdx/remark-json-render';
import { formatSpecJson, tokenizeJson } from '../lib/smart-ui/format-json';
import SmartUIRenderer from '../components/smart-ui/renderer';
import { SmartUI } from '../components/smart-ui';
import { JsonSource } from '../components/smart-ui/json-source';

const document = readFileSync('content/docs/408/knowledge/smart-ui-demo.mdx', 'utf8');
const examples = [...document.matchAll(/```json-render\n([\s\S]*?)\n```/gu)].map((match) => match[1]);
const minimal = () => ({ root: 'text', elements: { text: { type: 'Text', props: { text: '你好 <script>alert(1)</script>', variant: null }, children: [] as string[] } }, state: {} as Record<string, unknown> });

describe('official smart UI integration', () => {
  it('uses all 36 upstream schemas unchanged and covers them in real documents', () => {
    expect(studyCatalog.data.components).toBe(shadcnComponentDefinitions);
    expect(studyCatalog.componentNames).toHaveLength(36);
    expect(examples).toHaveLength(4);
    const used = new Set<string>();
    for (const code of examples) {
      const spec = parseStudySpec(code);
      Object.values(spec.elements).forEach((node) => used.add(node.type));
      const html = renderToStaticMarkup(<SmartUIRenderer spec={spec} code={code} />);
      expect(html).toContain('data-smart-ui="true"');
      expect(html).not.toContain('NaN');
    }
    expect([...used].sort()).toEqual(studyCatalog.componentNames.toSorted());
  });

  it('preserves state, bindings and event actions instead of stripping them', () => {
    const spec = parseStudySpec(examples[0]);
    expect(spec.state).toMatchObject({ answer: '', submitted: false });
    expect(spec.elements.question.props.value).toEqual({ $bindState: '/answer' });
    expect(spec.elements.submit.on).toEqual({ press: { action: 'setState', params: { statePath: '/submitted', value: true } } });
    expect(spec.elements.correct.visible).toBeDefined();
  });

  it('compiles the dedicated Markdown fence and preserves ordinary JSON fences', async () => {
    const compiled = String(await compile('```json-render\n' + JSON.stringify(minimal()) + '\n```', { remarkPlugins: [remarkJsonRender] }));
    expect(compiled).toContain('SmartUI');
    expect(compiled).toContain('code:');
    expect(String(await compile('```json\n{"a":1}\n```', { remarkPlugins: [remarkJsonRender] }))).not.toContain('SmartUI');
  });

  it('escapes text and degrades an invalid block without hiding surrounding prose', () => {
    const code = JSON.stringify(minimal());
    const html = renderToStaticMarkup(<SmartUIRenderer spec={parseStudySpec(code)} code={code} />);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    const invalid = renderToStaticMarkup(<article><p>正文前半部分</p><SmartUI code="{invalid" /><p>正文后半部分</p></article>);
    expect(invalid).toContain('交互内容暂时无法显示');
    expect(invalid).toContain('正文前半部分');
    expect(invalid).toContain('正文后半部分');
  });

  it.each([
    ['unknown component', (s: ReturnType<typeof minimal>) => { s.elements.text.type = 'MemoryAddress'; }],
    ['invalid props', (s: ReturnType<typeof minimal>) => { Object.assign(s.elements.text.props, { html: '<iframe>' }); }],
    ['wrong upstream prop type', (s: ReturnType<typeof minimal>) => { s.elements.text.props.text = 8 as never; }],
    ['missing child', (s: ReturnType<typeof minimal>) => { s.elements.text.type = 'Card'; s.elements.text.props = { title: null, description: null, maxWidth: null, centered: null, className: null } as never; s.elements.text.children = ['missing']; }],
    ['cycle', (s: ReturnType<typeof minimal>) => { s.elements.text.type = 'Card'; s.elements.text.props = { title: null, description: null, maxWidth: null, centered: null, className: null } as never; s.elements.text.children = ['text']; }],
    ['undeclared state', (s: ReturnType<typeof minimal>) => { s.elements.text.props.text = { $state: '/missing' } as never; }],
    ['unregistered function', (s: ReturnType<typeof minimal>) => { s.elements.text.props.text = { $computed: 'fetch' } as never; }],
    ['unsupported binding', (s: ReturnType<typeof minimal>) => { s.state.value = 'x'; s.elements.text.props.text = { $bindState: '/value' } as never; }],
    ['orphan', (s: ReturnType<typeof minimal>) => { Object.assign(s.elements, { extra: { type: 'Text', props: { text: 'unused', variant: null }, children: [] } }); }],
  ])('rejects %s', (_label, mutate) => {
    const spec = minimal(); mutate(spec);
    expect(() => parseStudySpec(JSON.stringify(spec))).toThrow();
  });

  it('rejects unsupported events and actions while allowing official array actions', () => {
    const spec = JSON.parse(examples[0]);
    spec.elements.submit.on.press.action = 'navigate';
    expect(() => parseStudySpec(JSON.stringify(spec))).toThrow();
    spec.elements.submit.on = { submit: { action: 'setState', params: { statePath: '/submitted', value: true } } };
    expect(() => parseStudySpec(JSON.stringify(spec))).toThrow(/未声明事件/);
    spec.state.items = [];
    spec.elements.submit.on = { press: { action: 'pushState', params: { statePath: '/items', value: 'new' } } };
    expect(() => parseStudySpec(JSON.stringify(spec))).not.toThrow();
  });

  it('rejects unsafe URLs, dangerous keys, invalid slider geometry and excessive size', () => {
    const link = { root: 'link', elements: { link: { type: 'Link', props: { label: 'link', href: 'javascript:alert(1)' }, children: [] } } };
    expect(() => parseStudySpec(JSON.stringify(link))).toThrow(/HTTPS/);
    link.elements.link.props.href = { $state: '/url' } as never;
    Object.assign(link, { state: { url: 'https://example.com' } });
    expect(() => parseStudySpec(JSON.stringify(link))).toThrow(/字面量/);
    expect(() => parseStudySpec('{"__proto__":{}}')).toThrow(/键/);
    expect(() => parseStudySpec(' '.repeat(100001))).toThrow(/100 KB/);
    const plan = JSON.parse(examples[2]); plan.elements.duration.props.min = 100;
    expect(() => parseStudySpec(JSON.stringify(plan))).toThrow(/范围/);
  });

  it('exports all official definitions and distinguishes the document guide from the upstream prompt', () => {
    const contract = JSON.parse(readFileSync('public/smart-ui/catalog.json', 'utf8'));
    expect(Object.keys(contract.components).sort()).toEqual(studyCatalog.componentNames.toSorted());
    expect(contract.componentLibrary).toBe('@json-render/shadcn@0.21.1');
    expect(readFileSync('public/smart-ui/upstream-prompt.md', 'utf8')).toBe(studyCatalog.prompt());
    expect(readFileSync('public/smart-ui/authoring-prompt.md', 'utf8')).toContain('不是 JSONL patches');
  });

  it('keeps the JSON view, reset and shared theme while scanning the bundled official utilities', () => {
    const code = JSON.stringify(minimal());
    const html = renderToStaticMarkup(<SmartUIRenderer spec={parseStudySpec(code)} code={code} />);
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="重置交互"');
    const source = renderToStaticMarkup(<JsonSource code={code} />);
    expect(source).toContain('aria-label="复制 JSON"');
    expect(source).toContain('&lt;script&gt;');
    expect(readFileSync('app/global.css', 'utf8')).toContain("@source '../node_modules/@json-render/shadcn/dist'");
  });

  it('counts real completed tasks independently of the focus duration', () => {
    const plan = parseStudySpec(examples[2]);
    for (let count = 0; count <= 3; count++) {
      const state = { ...plan.state, minutes: 90, concept: count >= 1, practice: count >= 2, review: count >= 3 };
      const progress = resolveElementProps(plan.elements.progress.props, { stateModel: state });
      const completion = resolveElementProps(plan.elements.completion.props, { stateModel: state });
      expect(progress.value).toBe(Math.round(count / 3 * 100));
      expect(completion.text).toContain(`${count} / 3`);
    }
  });

  it('starts main examples without redundant cards and keeps secondary controls optional', () => {
    for (const code of examples.slice(0, 3)) {
      const spec = parseStudySpec(code);
      expect(spec.elements[spec.root].type).toBe('Stack');
    }
    expect(document).toContain('<summary>展开组件体验区</summary>');
    expect(document).toContain('组件可以自定义吗');
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
