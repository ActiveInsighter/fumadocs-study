import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as study from '../components/english-study';

describe('English study question components', () => {
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
