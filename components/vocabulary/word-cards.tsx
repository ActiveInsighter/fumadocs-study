'use client';

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type WordMeaning = {
  pos?: string;
  text: string;
  key?: boolean;
  grammar?: string;
  phrase?: boolean;
};

export type WordExample = {
  text: string;
  translation: string;
};

export type WordSense = {
  gloss: string;
  count: number;
  examples?: WordExample[];
  percentage?: number;
};

export type WordCardData = {
  word: string;
  phonetic?: string;
  label?: string;
  meanings: WordMeaning[];
  senses?: WordSense[];
};

export type WordCardMode = 'compact' | 'full';

type WordCardsProps = {
  words: readonly WordCardData[];
  empty?: ReactNode;
};

type WordCardsProviderProps = {
  children: ReactNode;
  defaultMode?: WordCardMode;
};

type WordCardsContextValue = {
  mode: WordCardMode;
  setMode: (mode: WordCardMode) => void;
};

const WordCardsContext = createContext<WordCardsContextValue | null>(null);

function clampPercentage(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function getSensePercentage(sense: WordSense, total: number) {
  if (sense.percentage !== undefined) return clampPercentage(sense.percentage);
  if (total <= 0) return 0;
  return clampPercentage((sense.count / total) * 100);
}

function getWordLabel(word: WordCardData) {
  const label = word.label?.trim();
  return label || null;
}

function MeaningText({ meaning }: { meaning: WordMeaning }) {
  return (
    <>
      {meaning.grammar ? <span className="wc-gram">{meaning.grammar}</span> : null}
      {meaning.grammar ? ' ' : null}
      <span className={`wc-text${meaning.key ? ' wc-key' : ''}${meaning.phrase ? ' wc-phrase' : ''}`}>
        {meaning.text}
      </span>
    </>
  );
}

function SenseExample({ example }: { example: WordExample }) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="wc-example" data-open={open}>
      <button
        type="button"
        className="wc-example-trigger"
        aria-describedby={tooltipId}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
      >
        {example.text}
      </button>
      <span className="wc-example-tooltip" id={tooltipId} role="tooltip">
        {example.translation}
      </span>
    </span>
  );
}

function getGridColumnCount(element: HTMLElement) {
  const columns = getComputedStyle(element).gridTemplateColumns.trim();
  if (!columns || columns === 'none') return 1;
  return columns.split(/\s+/u).filter(Boolean).length;
}

function useCompactMasonry(mode: WordCardMode, wordCount: number) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const cards = Array.from(list.querySelectorAll<HTMLElement>(':scope > .word-card'));
    let frame = 0;
    let rowSize = 2;
    let rowGap = 10;

    const reset = () => {
      list.removeAttribute('data-masonry-ready');
      for (const card of cards) card.style.removeProperty('grid-row-end');
    };
    if (mode !== 'compact' || cards.length === 0) {
      reset();
      return;
    }

    const refreshMetrics = () => {
      const style = getComputedStyle(list);
      rowSize = Number.parseFloat(style.getPropertyValue('--wc-masonry-row')) || 2;
      rowGap = Number.parseFloat(style.getPropertyValue('--wc-masonry-gap')) || 10;
    };
    const measureCard = (card: HTMLElement) => {
      const height = card.getBoundingClientRect().height;
      const span = Math.max(1, Math.ceil((height + rowGap) / (rowSize + rowGap)));
      const nextValue = `span ${span}`;
      if (card.style.gridRowEnd !== nextValue) card.style.gridRowEnd = nextValue;
    };
    const measureAll = () => {
      if (getGridColumnCount(list) <= 1) {
        reset();
        return;
      }
      refreshMetrics();
      for (const card of cards) measureCard(card);
      list.setAttribute('data-masonry-ready', 'true');
    };
    const scheduleMeasureAll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measureAll);
    };

    scheduleMeasureAll();
    const observer = new ResizeObserver((entries) => {
      if (entries.some((entry) => entry.target === list)) {
        scheduleMeasureAll();
        return;
      }
      if (!list.hasAttribute('data-masonry-ready')) return;
      for (const entry of entries) {
        if (entry.target instanceof HTMLElement) measureCard(entry.target);
      }
    });
    observer.observe(list);
    for (const card of cards) observer.observe(card);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      reset();
    };
  }, [mode, wordCount]);
  return listRef;
}

export function WordCardsProvider({ children, defaultMode = 'full' }: WordCardsProviderProps) {
  const [mode, setMode] = useState<WordCardMode>(defaultMode);
  return <WordCardsContext.Provider value={{ mode, setMode }}>{children}</WordCardsContext.Provider>;
}

export function WordCardModeToggle() {
  const context = useContext(WordCardsContext);
  if (!context) return null;
  return (
    <div className="wc-mode-toggle" aria-label="词汇卡片显示模式">
      <span className="wc-mode-label">显示模式</span>
      <div className="wc-mode-segments" role="group" aria-label="切换词汇卡片显示模式">
        {([['compact', '精简'], ['full', '完整']] as const).map(([mode, label]) => {
          const active = context.mode === mode;
          return (
            <button
              key={mode}
              type="button"
              className="wc-mode-button"
              data-active={active}
              aria-pressed={active}
              onClick={() => context.setMode(mode)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WordCards({ words, empty = null }: WordCardsProps) {
  const context = useContext(WordCardsContext);
  const mode = context?.mode ?? 'full';
  const listRef = useCompactMasonry(mode, words.length);
  if (words.length === 0) return empty;
  return (
    <div className="word-list-shell">
      <div ref={listRef} className="word-list" data-word-card-mode={mode}>
        {words.map((word, wordIndex) => {
          const label = getWordLabel(word);
          const hasPhrase = word.meanings.some((meaning) => meaning.phrase);
          const senseTotal = word.senses?.reduce((sum, sense) => sum + Math.max(0, sense.count), 0) ?? 0;
          return (
            <article className={`word-card${hasPhrase ? ' has-phrase' : ''}`} key={`${word.word}-${wordIndex}`} data-word={word.word}>
              <div className="wc-header">
                <div className="wc-title">
                  <span className="wc-word">{word.word}</span>
                  {word.phonetic ? <span className="wc-phonetic">{word.phonetic}</span> : null}
                </div>
                {label ? <span className="wc-label">{label}</span> : null}
              </div>
              <div className="wc-meaning">
                {word.meanings.map((meaning, meaningIndex) => (
                  <div
                    className={`wc-meaning-item${meaning.key ? ' is-key' : ''}${meaning.phrase ? ' is-phrase' : ''}`}
                    key={`${meaning.pos ?? 'meaning'}-${meaningIndex}`}
                  >
                    {meaning.pos ? <span className="wc-pos">{meaning.pos}</span> : null}
                    <MeaningText meaning={meaning} />
                  </div>
                ))}
              </div>
              {mode === 'full' && word.senses?.length ? (
                <div className="wc-senses">
                  {word.senses.map((sense, senseIndex) => {
                    const percentage = getSensePercentage(sense, senseTotal);
                    return (
                      <div className="wc-sense" key={`${sense.gloss}-${senseIndex}`}>
                        <div className="wc-sense-main">
                          <div className="wc-sense-row">
                            <span className="wc-sense-dot" aria-hidden="true" />
                            <span className="wc-sense-gloss">{sense.gloss}</span>
                          </div>
                          <div className="wc-stats">
                            <span className="wc-sense-count">{Math.max(0, sense.count)} 次</span>
                            <span className="wc-bar" aria-hidden="true">
                              <span className="wc-bar-fill" style={{ width: `${percentage}%` }} />
                            </span>
                            <span className="wc-sense-pct">{percentage}%</span>
                          </div>
                        </div>
                        <div className="wc-sense-examples">
                          {sense.examples?.length ? (
                            sense.examples.map((example, exampleIndex) => (
                              <SenseExample key={`${example.text}-${exampleIndex}`} example={example} />
                            ))
                          ) : (
                            <span className="wc-no-example">暂无例句</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
