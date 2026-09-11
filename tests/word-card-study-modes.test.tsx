import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  WordCardModeToggle,
  WordCards,
  WordCardsProvider,
  type WordCardData,
} from '../components/vocabulary/word-cards';

const word: WordCardData = {
  word: 'constitute',
  phonetic: '/ˈkɒnstɪtjuːt/',
  label: '重要性 5',
  meanings: [
    { pos: 'v.', text: '构成；组成', key: true },
    { pos: 'v.', text: '设立；成立' },
  ],
  senses: [
    {
      gloss: '构成；组成',
      count: 3,
      examples: [{ text: 'Example sentence.', translation: '示例句子的翻译。' }],
    },
  ],
};

describe('vocabulary study modes', () => {
  it('offers compact, dictation, translation and full modes', () => {
    const html = renderToStaticMarkup(
      <WordCardsProvider>
        <WordCardModeToggle />
      </WordCardsProvider>,
    );

    expect(html).toContain('精简');
    expect(html).toContain('默写');
    expect(html).toContain('翻译');
    expect(html).toContain('完整');
    expect(html.match(/class="wc-mode-button"/gu)).toHaveLength(4);
  });

  it('uses the compact grid for dictation while removing the answer and phonetic from markup', () => {
    const html = renderToStaticMarkup(
      <WordCardsProvider defaultMode="dictation">
        <WordCards words={[word]} />
      </WordCardsProvider>,
    );

    expect(html).toContain('data-word-card-mode="compact"');
    expect(html).toContain('data-word-study-mode="dictation"');
    expect(html).toContain('class="wc-recall-blank"');
    expect(html).toContain('构成；组成');
    expect(html).toContain('重要性 5');
    expect(html).toContain('aria-label="查看完整卡片"');
    expect(html).not.toContain('constitute');
    expect(html).not.toContain('/ˈkɒnstɪtjuːt/');
    expect(html).not.toContain('Example sentence.');
  });

  it('uses the compact grid for translation while rendering the headword but not Chinese meanings', () => {
    const html = renderToStaticMarkup(
      <WordCardsProvider defaultMode="translation">
        <WordCards words={[word]} />
      </WordCardsProvider>,
    );

    expect(html).toContain('data-word-card-mode="compact"');
    expect(html).toContain('data-word-study-mode="translation"');
    expect(html).toContain('constitute');
    expect(html).toContain('/ˈkɒnstɪtjuːt/');
    expect(html).toContain('重要性 5');
    expect(html).toContain('class="wc-expand-button"');
    expect(html).not.toContain('构成；组成');
    expect(html).not.toContain('设立；成立');
    expect(html).not.toContain('class="wc-senses"');
  });

  it('places example translations above the hovered sentence and points the anchor downward', () => {
    const css = readFileSync(new URL('../styles/word-card-interactions.css', import.meta.url), 'utf8');

    expect(css).toMatch(/\.wc-example-tooltip\s*\{[^}]*top:\s*auto[^}]*bottom:\s*calc\(100%\s*\+\s*6px\)/u);
    expect(css).toMatch(/\.wc-example-tooltip\s*\{[^}]*transform-origin:\s*bottom\s+left/u);
    expect(css).toMatch(/\.wc-example-tooltip::after\s*\{[^}]*bottom:\s*-5px/u);
    expect(css).toMatch(/\.wc-example-tooltip::after\s*\{[^}]*border-bottom:\s*1px/u);
  });

  it('uses semantic conditional rendering instead of visually transparent answers', () => {
    const component = readFileSync(new URL('../components/vocabulary/word-cards.tsx', import.meta.url), 'utf8');

    expect(component).toContain("const hideHeadword = mode === 'dictation'");
    expect(component).toContain("const hideMeanings = mode === 'translation'");
    expect(component).toContain('{hideHeadword ? (');
    expect(component).toContain('{!hideMeanings ? (');
    expect(component).toContain("data-word={hideHeadword ? undefined : word.word}");
  });
});
