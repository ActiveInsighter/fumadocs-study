import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  WordCardModeToggle,
  WordCards,
  WordCardsProvider,
  type WordCardData,
} from '../components/vocabulary/word-cards';
import { WORD_CARD_MODE_STORAGE_KEY, readStoredMode, storeMode } from '../components/vocabulary/word-card-mode';

const componentSource = () =>
  ['word-cards.tsx', 'word-card-content.tsx', 'word-card-mode.tsx', 'word-card-detail.tsx', 'use-compact-masonry.ts']
    .map((file) => readFileSync(new URL(`../components/vocabulary/${file}`, import.meta.url), 'utf8'))
    .join('\n');

const deckSource = () => readFileSync(new URL('../components/ui/knowledge-card.tsx', import.meta.url), 'utf8');
const deckCss = () => readFileSync(new URL('../styles/knowledge-card.css', import.meta.url), 'utf8');

const words: WordCardData[] = [
  {
    word: 'constitute',
    phonetic: '/ˈkɒnstɪtjuːt/',
    label: '考频 8',
    meanings: [
      { pos: 'v.', text: '构成；组成', key: true },
      { pos: 'v.', text: '设立；成立' },
    ],
    senses: [
      {
        gloss: '构成；组成',
        count: 6,
        examples: [{ text: 'Example sentence.', translation: '示例句子的翻译。' }],
      },
      { gloss: '设立；成立', count: 2 },
    ],
  },
  { word: 'notwithstanding', label: '外刊 3', meanings: [{ pos: 'prep.', text: '尽管；虽然' }] },
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
    expect(html).toContain('class="wc-label"');
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
            meanings: [{ pos: 'v.', grammar: 'derive A from B', text: '从 B 中获得 A', key: true }],
          },
        ]}
      />,
    );
    expect(html).toContain('外刊 3');
    expect(html).toContain('class="wc-text wc-key wc-phrase"');
    expect(html).toContain('class="wc-gram"');
    expect(html).toContain('derive A from B');
    expect(html).toContain('100%');
  });

  it('groups meanings into scannable rows and marks phrase cards', () => {
    const html = renderToStaticMarkup(<WordCards words={words} />);
    expect(html).toContain('class="word-card has-phrase"');
    expect(html).toContain('class="wc-meaning-item is-key is-phrase"');
    expect(html).toContain('class="wc-text wc-key wc-phrase"');
    expect(html.match(/class="wc-meaning-item/gu)).toHaveLength(4);
  });

  it('renders a visual sense bar and a clear empty-example state', () => {
    const html = renderToStaticMarkup(
      <WordCards
        words={[
          {
            word: 'abandon',
            meanings: [{ pos: 'v.', text: '放弃', key: true }],
            senses: [
              { gloss: '停止做某事', count: 3 },
              { gloss: '遗弃', count: 1, examples: [] },
            ],
          },
        ]}
      />,
    );
    expect(html).toContain('class="wc-bar"');
    expect(html).toContain('class="wc-bar-fill"');
    expect(html).toContain('style="width:75%"');
    expect(html).toContain('暂无例句');
  });

  it('returns the supplied empty state when there are no cards', () => {
    expect(renderToStaticMarkup(<WordCards words={[]} empty={<span>暂无词汇</span>} />)).toBe('<span>暂无词汇</span>');
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

  it('adds a detail button only to compact cards', () => {
    const compactHtml = renderToStaticMarkup(
      <WordCardsProvider defaultMode="compact">
        <WordCards words={words.slice(0, 1)} />
      </WordCardsProvider>,
    );
    const fullHtml = renderToStaticMarkup(<WordCards words={words.slice(0, 1)} />);
    expect(compactHtml).toContain('class="wc-expand-button"');
    expect(compactHtml).toContain('aria-label="查看 constitute 完整卡片"');
    expect(fullHtml).not.toContain('class="wc-expand-button"');
  });

  it('opens the compact detail view in the general Modal with focus return to the last shown card', () => {
    const component = componentSource();
    const deck = deckSource();
    expect(component).toContain("from '@/components/ui/knowledge-card'");
    expect(deck).toContain("from \"@/components/ui/modal\"");
    expect(deck).toContain('<Modal open={open} onOpenChange={onOpenChange}>');
    expect(component).toContain("titleProps={{ lang: 'en', className: 'wc-detail-title' }}");
    expect(component).toContain('data-tone={getTone(index)}');
    expect(component).toContain('onClick={() => openDetail(wordIndex)}');
    expect(component).toContain(":scope > .word-card .wc-expand-button')[detailIndex] ?? true");
    expect(component).toContain('finalFocus={detailFinalFocus}');
    expect(component).not.toContain('<dialog');
  });

  it('lets the detail modal step through cards with buttons and arrow keys', () => {
    const component = componentSource();
    const deck = deckSource();
    expect(component).toContain("labels={{ group: '切换单词', prev: '上一个单词', next: '下一个单词' }}");
    expect(deck).toContain('aria-label={labels.prev}');
    expect(deck).toContain('aria-label={labels.next}');
    expect(deck).toContain('event.key === "ArrowLeft" && hasPrev');
    expect(deck).toContain('event.key === "ArrowRight" && hasNext');
    expect(component).toContain('onIndexChange={onNavigate}');
    expect(component).toContain('onNavigate={setDetailIndex}');
  });

  it('remembers the chosen display mode in localStorage and ignores invalid or unavailable storage', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      },
    });
    expect(readStoredMode()).toBeNull();
    storeMode('dictation');
    expect(store.get(WORD_CARD_MODE_STORAGE_KEY)).toBe('dictation');
    expect(readStoredMode()).toBe('dictation');
    store.set(WORD_CARD_MODE_STORAGE_KEY, 'bogus');
    expect(readStoredMode()).toBeNull();

    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('denied');
        },
        setItem: () => {
          throw new Error('denied');
        },
      },
    });
    expect(readStoredMode()).toBeNull();
    expect(() => storeMode('full')).not.toThrow();
  });

  it('restores the stored mode only on the client so server markup stays on the default mode', () => {
    const component = componentSource();
    expect(component).toMatch(/useLayoutEffect\(\(\) => \{\s*const storedMode = readStoredMode\(\);/u);
    expect(component).toMatch(/storeMode\(nextMode\);/u);
    const html = renderToStaticMarkup(
      <WordCardsProvider>
        <WordCards words={words.slice(0, 1)} />
      </WordCardsProvider>,
    );
    expect(html).toContain('data-word-card-mode="full"');
  });

  it('animates mode switches and detail navigation while respecting reduced motion', () => {
    const component = componentSource();
    const css = readFileSync(new URL('../styles/word-card-interactions.css', import.meta.url), 'utf8');
    const detailCss = readFileSync(new URL('../styles/word-card-detail.css', import.meta.url), 'utf8');
    expect(component).toContain('document.startViewTransition(');
    expect(component).toContain('flushSync(() => setModeState(nextMode))');
    expect(component).toContain("prefers-reduced-motion: reduce");
    const deck = deckSource();
    const deckStyles = deckCss();
    const modalCss = readFileSync(new URL('../styles/modal.css', import.meta.url), 'utf8');
    expect(deck).toContain('go: (target) => step(target, target > index ? "next" : "prev")');
    expect(deck).toContain('data-kc-stage="leaving"');
    expect(deck).toContain('data-kc-stage="current"');
    expect(deckStyles).toMatch(/\[data-kc-stage='current'\]\[data-direction='next'\] \[data-slot='kc-content'\]\s*\{[^}]*kc-content-in-next/u);
    expect(deckStyles).toMatch(/@media \(prefers-reduced-motion: reduce\)/u);
    expect(modalCss).toMatch(/\[data-slot='modal-pane'\]\s*\{[^}]*transition:\s*background-color/u);
    expect(detailCss).toMatch(/\.wc-detail-sense-fill\s*\{[^}]*animation:\s*wc-share-in/u);
    expect(css).toMatch(/html\[data-wc-mode-transition\]::view-transition-new\(root\)/u);
    expect(css).toMatch(/\.wc-mode-indicator\s*\{[^}]*transform:\s*translateX\(calc\(var\(--wc-active-index/u);
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
    expect(html).toContain('--wc-active-index:3');
    expect(html).toContain('class="wc-mode-indicator"');
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

  it('shows translations on hover/keyboard focus/tap and styles the shared mode control', () => {
    const css = readFileSync(new URL('../styles/word-card-interactions.css', import.meta.url), 'utf8');
    const component = componentSource();
    expect(component).toContain("if (event.pointerType === 'mouse') setOpen(nextOpen)");
    expect(component).toContain("event.currentTarget.matches(':focus-visible')");
    expect(css).toMatch(/\.wc-example\[data-open='true'\]\s+\.wc-example-tooltip/u);
    expect(css).toMatch(/\.wc-mode-button\[data-active='true'\]/u);
  });

  it('lays out the fixed-height detail modal with a toned card pane, neutral text and hover/tap translations', () => {
    const component = componentSource();
    const cardCss = readFileSync(new URL('../styles/word-cards.css', import.meta.url), 'utf8');
    const detailCss = readFileSync(new URL('../styles/word-card-detail.css', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../styles/word-card-interactions.css', import.meta.url), 'utf8');
    expect(cardCss).toMatch(/\.word-card\[data-tone='3'\],\s*\.wc-detail\[data-tone='3'\]\s*\{/u);
    expect(cardCss).toMatch(/\.dark \.word-card,\s*\.dark \.wc-detail\s*\{/u);
    expect(component).toContain('height="44rem"');
    expect(component).toContain('<KnowledgeCardAside className="wc-detail-side">');
    expect(component).toContain('<KnowledgeCardStage columns=');
    expect(detailCss).toMatch(/--modal-pane-muted:\s*var\(--card-bg\)/u);
    expect(detailCss).toMatch(/\.wc-detail,\s*\.dark \.wc-detail\s*\{[^}]*--word-text:\s*var\(--foreground\)[^}]*--phrase-text:\s*var\(--foreground\)/u);
    expect(component).toContain('titleMode="scrolled"');
    expect(deckCss()).toMatch(/\[data-knowledge-card\]\[data-scrolled\] \[data-kc-title='scrolled'\]\s*\{[^}]*opacity:\s*1/u);
    expect(component).toContain('<StudyPieChart');
    expect(component).toContain('variant="inline"');
    expect(component).toContain('<SenseDistribution word={word.word} senses={senses} offset={word.meanings.length} />');
    expect(component).toContain('<WordCardBody key={itemKey}');
    expect(component).toContain('<SenseExample example={example} />');
    expect(component).not.toContain('wc-detail-example-translation');
    expect(detailCss).toMatch(/\.wc-detail-swatch\s*\{[^}]*var\(--wc-sense-color\)/u);
    expect(detailCss).toMatch(/\.wc-detail-sense-fill\s*\{[^}]*var\(--wc-sense-color\)/u);
    expect(css).toMatch(/\.wc-expand-button:focus-visible/u);
    expect(css).not.toMatch(/wc-detail-dialog/u);
  });


  it('keeps the sense distribution immersive and isolates right-hand interactions from the donut', () => {
    const detail = readFileSync(new URL('../components/vocabulary/word-card-detail.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('../styles/word-card-detail.css', import.meta.url), 'utf8');
    const pie = readFileSync(new URL('../components/charts/types/pie-chart.tsx', import.meta.url), 'utf8');
    const rightPane = detail.slice(detail.indexOf('function WordMain('));

    expect(detail).toContain('const [active, setActive] = useState<string | null>(null);');
    expect(detail).toContain('const data = useMemo(');
    expect(detail).toContain('const colors = useMemo(');
    expect(rightPane).not.toContain('setActive(');
    expect(rightPane).not.toContain('highlight={highlight}');
    expect(rightPane).not.toContain('data-active={active');
    expect(styles).toMatch(/\\.wc-detail-summary\\s*\\{[^}]*background:\\s*transparent;[^}]*box-shadow:\\s*none/u);
    expect(styles).not.toContain('.dark .wc-detail-summary');
    expect(styles).toContain('.wc-detail-sense:hover .wc-detail-sense-row');
    expect(styles).toContain('.wc-detail-donut .recharts-sector');
    expect(pie).toContain('const visible = useMemo(');
    expect(pie).toContain('innerRadius={active && !inline ?');
    expect(pie).toContain('outerRadius={active && !inline ?');
    expect(pie).toContain('isAnimationActive={inline ? false : shouldAnimate}');
  });

  it('flips and shifts example tooltips so they stay inside an enclosing modal or the viewport', () => {
    const css = readFileSync(new URL('../styles/word-card-interactions.css', import.meta.url), 'utf8');
    const component = componentSource();
    expect(component).toContain(`root.closest<HTMLElement>('[data-slot="modal-content"]')`);
    expect(component).toContain("modal.querySelector<HTMLElement>('[data-slot=\"modal-header\"]')");
    expect(component).toContain('const { offsetWidth: width, offsetHeight: height } = tooltip;');
    expect(component).toContain("root.dataset.placement = placement");
    expect(css).toMatch(/\.wc-example\[data-placement='bottom'\]\s+\.wc-example-tooltip\s*\{[^}]*top:\s*calc\(100%\s*\+\s*6px\)/u);
    expect(css).toMatch(/\.wc-example-tooltip\s*\{[^}]*inset-inline-start:\s*var\(--wc-tooltip-shift/u);
  });

  it('keeps the mode control compact and gives the example tooltip a clear anchor', () => {
    const css = readFileSync(new URL('../styles/word-card-interactions.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.wc-mode-button\s*\{[^}]*min-width:\s*42px/u);
    expect(css).toMatch(/\.wc-mode-button\[data-active='true'\]\s*\{[^}]*box-shadow:\s*none/u);
    expect(css).toMatch(/\.wc-example-trigger\s*\{[^}]*text-decoration:\s*underline\s+dashed/u);
    expect(css).toMatch(/\.wc-example-tooltip::after\s*\{/u);
  });

  it('turns compact cards into an adaptive two-or-three-column masonry grid with exact gaps', () => {
    const css = readFileSync(new URL('../styles/word-cards.css', import.meta.url), 'utf8');
    const component = componentSource();
    expect(css).toMatch(/\.word-list-shell\s*\{[^}]*container:\s*word-cards\s*\/\s*inline-size/u);
    expect(css).toMatch(/\.word-list\[data-word-card-mode='compact'\]\s*\{[^}]*display:\s*grid/u);
    expect(css).toMatch(/\.word-list\[data-word-card-mode='compact'\]\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*1fr\)/u);
    expect(css).toMatch(/--wc-masonry-row:\s*1px/u);
    expect(css).toMatch(/--wc-masonry-gap:\s*14px/u);
    expect(css).toMatch(/\.word-list\[data-word-card-mode='compact'\]\[data-masonry-ready='true'\]\s*\{[^}]*grid-auto-rows:\s*var\(--wc-masonry-row\)/u);
    expect(css).toMatch(/\.word-list\[data-word-card-mode='compact'\]\[data-masonry-ready='true'\]\s*\{[^}]*row-gap:\s*0/u);
    expect(component).toContain('Math.ceil(heights[index] + rowGap)');
    expect(component).toContain('useLayoutEffect(() => {');
    expect(css).not.toMatch(/grid-auto-flow:\s*dense/u);
    expect(component).toContain('new ResizeObserver');
    expect(component).toContain('card.style.gridRowEnd = nextValue');
    expect(component).toContain('const scheduleMeasure = () =>');
    expect(component).toContain("list.setAttribute('data-masonry-ready', 'true')");
    expect(css).toMatch(/@container\s+word-cards\s*\(min-width:\s*1440px\)[\s\S]*?grid-template-columns:\s*repeat\(3,\s*1fr\)/u);
    expect(css).toMatch(/@media\s+screen\s+and\s*\(max-width:\s*760px\)[\s\S]*?grid-template-columns:\s*1fr/u);
    expect(css).toMatch(/\.word-list\[data-word-card-mode='compact'\]\s+\.word-card\s*\{[^}]*margin-bottom:\s*0/u);
  });

  it('wraps compact card headers before a long word can cover its card label', () => {
    const css = readFileSync(new URL('../styles/word-cards.css', import.meta.url), 'utf8');
    const component = componentSource();
    expect(css).toMatch(/\.wc-header\s*\{[^}]*flex-wrap:\s*wrap/u);
    expect(css).toMatch(/\.wc-title\s*\{[^}]*flex:\s*1\s+1\s+0/u);
    expect(css).toMatch(/\.wc-word\s*\{[^}]*min-width:\s*0/u);
    expect(css).toMatch(/\.wc-word\s*\{[^}]*overflow-wrap:\s*break-word/u);
    expect(css).toMatch(/\.wc-word\s*\{[^}]*hyphens:\s*auto/u);
    expect(component).toMatch(/className="wc-word" lang="en"/u);
  });
});
