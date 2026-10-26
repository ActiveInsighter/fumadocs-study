import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluate } from '@mdx-js/mdx';
import * as runtime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as study from '../components/english-study';
import type { ReactNode } from 'react';

const directory = join(process.cwd(), 'content/docs/english/kaoyan-zhenxiang-1026');
const Wrapper = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
const components = {
  ...study,
  ...Object.fromEntries(['Callout', 'Cards', 'Card', 'Steps', 'Step', 'Tabs', 'Tab', 'Accordions', 'Accordion'].map((name) => [name, Wrapper])),
};

describe('English study deployment content', () => {
  it('compiles and renders all annual MDX with every question and translation', async () => {
    const allIds = new Set<string>();
    let totalQuestions = 0;
    let readings = 0;
    for (let year = 2017; year <= 2025; year++) {
      const text = readFileSync(join(directory, `${year}.mdx`), 'utf8').replace(/^---\n[\s\S]*?\n---\n/u, '');
      const ids = [...text.matchAll(/<Question\s+id="([^"]+)"/gu)].map((match) => match[1]);
      for (const id of ids) {
        expect(allIds.has(id), `duplicate ID ${id}`).toBe(false);
        allIds.add(id);
      }
      const { default: Body } = await evaluate(text, runtime);
      const html = renderToStaticMarkup(<Body components={components} />);
      expect(html.match(/aria-label="原创巩固题"/gu)?.length).toBe(ids.length);
      expect(html.match(/查看本段译文/gu)?.length ?? 0).toBe((text.match(/<Translation>/gu) ?? []).length);
      for (const match of text.matchAll(/<Evidence for="([^"]+)"/gu)) {
        expect(ids).toContain(match[1]);
        expect(html).toContain(`id="evidence-${match[1]}"`);
      }
      totalQuestions += ids.length;
      readings += (text.match(/<EnglishReading>/gu) ?? []).length;
    }
    expect(totalQuestions).toBe(207);
    expect(readings).toBe(10);
  }, 30000);

  it('keeps answers hidden before submission and rejects ambiguous keys', () => {
    const html = renderToStaticMarkup(<study.Question id="example" type="single">
      <p>Which option?</p><study.Option correct>First</study.Option><study.Option>Second</study.Option>
      <study.Solution>Hidden explanation</study.Solution>
    </study.Question>);
    expect(html).toContain('type="radio"');
    expect(html).not.toContain('Hidden explanation');
    expect(() => renderToStaticMarkup(<study.Question id="bad" type="single">
      <study.Option correct>One</study.Option><study.Option correct>Two</study.Option>
      <study.Solution>Invalid</study.Solution>
    </study.Question>)).toThrow('Invalid study question: bad');
  });
});
