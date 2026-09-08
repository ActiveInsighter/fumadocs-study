import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  WordCardModeToggle,
  WordCards,
  WordCardsProvider,
  type WordCardData,
} from '../components/vocabulary/word-cards';

const words: WordCardData[] = [
  {
    word: 'constitute',
    phonetic: '/ˈkɒnstɪtjuːt/',
    frequency: 8,
    meanings: [
      { pos: 'v.', text: '构成；组成', key: true },
      { pos: 'v.', text: '设立；成立' },
    ],
    senses: [
      {
        gloss: '构成；组成',
        count: 6,
        examples: [
          {
            text: 'Example sentence.',
            translation: '示例句子的翻译。',
          },
        ],
      },
      { gloss: '设立；成立', count: 2 },
    ],
  },
  {
    word: 'notwithstanding',
    frequencyLabel: '外刊 3',
    meanings: [{ pos: 'prep.', text: '尽管；虽然' }],
  },
  {
    word: 'in terms of',
    meanings: [{ text: '就……而言', phrase: true, key: true }],
    senses: [{ gloss: '就某方面而言', count: 1, percentage: 120 }],
  },
];

describe('WordCards', () => {
  it('renders the vocabulary card structure, automatic percentages and translated examples', () => {
    const html = renderToStaticMarkup(<WordCards words={words} />);

    expect(html).toContain('class="word-list"');
    expect(html).toContain('data-word-card-mode="full"');
    expect(html).toContain('class="word-card"');
    expect(html).toContain('constitute');
    expect(html).toContain('考频 8');
    expect(html).toContain('75%');
    expect(html).toContain('25%');
    expect(html).toContain('Example sentence.');
    expect(html).toContain('示例句子的翻译。');
    expect(html).toContain('class="wc-example-tooltip"');
  });

  it('supports custom labels, missing phonetics or senses, grammar and phrase styling', () => {
    const html = renderToStaticMarkup(
      <WordCards
        words={[
          ...words,
          {
            word: 'derive',
            meanings: [
              {
                pos: 'v.',
                grammar: 'derive A from B',
                text: '从 B 中获得 A',
                key: true,
              },
            ],
          },
        ]}
      />,
    );

    expect(html).toContain('外刊 3');
    expect(html).toContain('class="wc-phrase"');
    expect(html).toContain('class="wc-gram"');
    expect(html).toContain('derive A from B');
    expect(html).toContain('100%');
  });

  it('returns the supplied empty state when there are no cards', () => {
    const html = renderToStaticMarkup(<WordCards words={[]} empty={<span>暂无词汇</span>} />);
    expect(html).toBe('<span>暂无词汇</span>');
  });

  it('applies compact mode to every WordCards instance inside the page provider', () => {
    const html = renderToStaticMarkup(
      <WordCardsProvider defaultMode="compact">
        <WordCards words={words.slice(0, 1)} />
        <WordCards words={words.slice(1)} />
      </WordCardsProvider>,
    );

    expect(html.match(/data-word-card-mode="compact"/gu)).toHaveLength(2);
    expect(html).not.toContain('class="wc-senses"');
    expect(html).not.toContain('Example sentence.');
    expect(html).not.toContain('75%');
    expect(html).toContain('构成；组成');
  });

  it('renders a shared compact/full segmented control from the provider state', () => {
    const html = renderToStaticMarkup(
      <WordCardsProvider>
        <WordCardModeToggle />
      </WordCardsProvider>,
    );

    expect(html).toContain('显示模式');
    expect(html).toContain('精简');
    expect(html).toContain('完整');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('data-active="true"');
  });

  it('keeps sense examples on the same line-height as their metadata row', () => {
    const css = readFileSync(new URL('../styles/word-cards.css', import.meta.url), 'utf8');

    expect(css).toMatch(/\.wc-sense-examples\s*\{[^}]*line-height:\s*inherit/u);
  });

  it('centers sense dots against the gloss text', () => {
    const css = readFileSync(new URL('../styles/word-cards.css', import.meta.url), 'utf8');

    expect(css).toMatch(/\.wc-sense-dot\s*\{[^}]*margin-top:\s*0\.63em/u);
    expect(css).not.toMatch(/\.word-list\s*>\s*\.word-card\s+\.wc-sense-dot/u);
  });

  it('keeps cards static instead of applying hover motion', () => {
    const css = readFileSync(new URL('../styles/word-cards.css', import.meta.url), 'utf8');

    expect(css).not.toMatch(/\.word-list\s*>\s*\.word-card:hover/u);
    expect(css).not.toMatch(/transition:\s*transform/u);
  });

  it('shows translations on hover/focus and styles the shared mode control', () => {
    const css = readFileSync(
      new URL('../styles/word-card-interactions.css', import.meta.url),
      'utf8',
    );

    expect(css).toMatch(/\.wc-example:hover\s+\.wc-example-tooltip/u);
    expect(css).toMatch(/\.wc-example:focus-within\s+\.wc-example-tooltip/u);
    expect(css).toMatch(/\.wc-example\[data-open='true'\]\s+\.wc-example-tooltip/u);
    expect(css).toMatch(/\.wc-mode-button\[data-active='true'\]/u);
  });
});
