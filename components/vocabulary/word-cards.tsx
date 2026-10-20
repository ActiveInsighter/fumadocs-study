'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { flushSync } from 'react-dom';

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

export type WordCardMode = 'compact' | 'dictation' | 'translation' | 'full';

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

type SelectedWord = {
  word: WordCardData;
  index: number;
};

const WordCardsContext = createContext<WordCardsContextValue | null>(null);

const MODE_OPTIONS = [
  ['compact', '精简'],
  ['dictation', '默写'],
  ['translation', '翻译'],
  ['full', '完整'],
] as const satisfies readonly (readonly [WordCardMode, string])[];

const TONE_COUNT = 7;

/** Slightly longer than the 160ms `wc-detail-exit` animation. */
const DIALOG_EXIT_FALLBACK_MS = 220;

function getTone(index: number) {
  return (index % TONE_COUNT) + 1;
}

function hasPhraseMeaning(word: WordCardData) {
  return word.meanings.some((meaning) => meaning.phrase);
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

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
      {meaning.grammar ? (
        <span className="wc-gram" lang="en">
          {meaning.grammar}
        </span>
      ) : null}
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
        lang="en"
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

function WordCardContent({
  word,
  showSenses,
  hideHeadword = false,
  hideMeanings = false,
  headerAction,
}: {
  word: WordCardData;
  showSenses: boolean;
  hideHeadword?: boolean;
  hideMeanings?: boolean;
  headerAction?: ReactNode;
}) {
  const label = getWordLabel(word);
  const senseTotal = word.senses?.reduce((sum, sense) => sum + Math.max(0, sense.count), 0) ?? 0;
  return (
    <>
      <div className="wc-header">
        <div className="wc-title">
          {hideHeadword ? (
            <span className="wc-recall-blank" role="img" aria-label="单词和音标已隐藏" />
          ) : (
            <>
              <span className="wc-word" lang="en">
                {word.word}
              </span>
              {word.phonetic ? <span className="wc-phonetic">{word.phonetic}</span> : null}
            </>
          )}
        </div>
        {label || headerAction ? (
          <div className="wc-card-actions">
            {label ? <span className="wc-label">{label}</span> : null}
            {headerAction}
          </div>
        ) : null}
      </div>
      {!hideMeanings ? (
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
      ) : null}
      {showSenses && word.senses?.length ? (
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
    </>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function getGridColumnCount(element: HTMLElement) {
  const columns = getComputedStyle(element).gridTemplateColumns.trim();
  if (!columns || columns === 'none') return 1;
  return columns.split(/\s+/u).filter(Boolean).length;
}

/**
 * Packs compact cards into a masonry layout on a 1px row grid. Each card spans
 * `height + gap` rows, so the visual gap stays exact instead of drifting by a
 * whole row track. The first pass runs in a layout effect so mode switches
 * (including view-transition snapshots) never paint an unpacked grid.
 */
function useCompactMasonry(compactLayout: boolean, wordCount: number) {
  const listRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const cards = Array.from(list.querySelectorAll<HTMLElement>(':scope > .word-card'));
    let frame = 0;
    let rowGap = 14;

    const reset = () => {
      list.removeAttribute('data-masonry-ready');
      for (const card of cards) card.style.removeProperty('grid-row-end');
    };
    if (!compactLayout || cards.length === 0) {
      reset();
      return;
    }

    const applySpan = (card: HTMLElement, height: number) => {
      const nextValue = `span ${Math.max(1, Math.ceil(height + rowGap))}`;
      if (card.style.gridRowEnd !== nextValue) card.style.gridRowEnd = nextValue;
    };
    const measureAll = () => {
      if (getGridColumnCount(list) <= 1) {
        reset();
        return;
      }
      rowGap = Number.parseFloat(getComputedStyle(list).getPropertyValue('--wc-masonry-gap')) || 14;
      // Read every height before writing any span to avoid layout thrashing.
      const heights = cards.map((card) => card.getBoundingClientRect().height);
      cards.forEach((card, index) => applySpan(card, heights[index]));
      list.setAttribute('data-masonry-ready', 'true');
    };
    const scheduleMeasureAll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measureAll);
    };

    measureAll();
    const observer = new ResizeObserver((entries) => {
      if (entries.some((entry) => entry.target === list)) {
        scheduleMeasureAll();
        return;
      }
      if (!list.hasAttribute('data-masonry-ready')) return;
      for (const entry of entries) {
        if (!(entry.target instanceof HTMLElement)) continue;
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
        applySpan(entry.target, height);
      }
    });
    observer.observe(list);
    for (const card of cards) observer.observe(card);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      reset();
    };
  }, [compactLayout, wordCount]);
  return listRef;
}

export function WordCardsProvider({ children, defaultMode = 'full' }: WordCardsProviderProps) {
  const [mode, setModeState] = useState<WordCardMode>(defaultMode);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const setMode = useCallback((nextMode: WordCardMode) => {
    if (nextMode === modeRef.current) return;
    if (typeof document.startViewTransition !== 'function' || prefersReducedMotion()) {
      setModeState(nextMode);
      return;
    }
    // Cross-fade the layout change; the transition attribute scopes the custom
    // view-transition timing to word-card mode switches only.
    const root = document.documentElement;
    root.setAttribute('data-wc-mode-transition', '');
    const transition = document.startViewTransition(() => {
      flushSync(() => setModeState(nextMode));
    });
    transition.finished.finally(() => root.removeAttribute('data-wc-mode-transition'));
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <WordCardsContext.Provider value={value}>{children}</WordCardsContext.Provider>;
}

export function WordCardModeToggle() {
  const context = useContext(WordCardsContext);
  if (!context) return null;
  const activeIndex = MODE_OPTIONS.findIndex(([mode]) => mode === context.mode);
  return (
    <div className="wc-mode-toggle" aria-label="词汇卡片显示模式">
      <span className="wc-mode-label">显示模式</span>
      <div
        className="wc-mode-segments"
        role="group"
        aria-label="切换词汇卡片显示模式"
        style={{ '--wc-active-index': activeIndex } as CSSProperties}
      >
        <span className="wc-mode-indicator" aria-hidden="true" />
        {MODE_OPTIONS.map(([mode, label]) => {
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
  const compactLayout = mode !== 'full';
  const listRef = useCompactMasonry(compactLayout, words.length);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [selectedWord, setSelectedWord] = useState<SelectedWord | null>(null);

  useEffect(() => {
    if (!selectedWord || !compactLayout) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const bodyPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;

    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) body.style.paddingRight = `${bodyPaddingRight + scrollbarWidth}px`;
    if (!dialog.open) dialog.showModal();

    return () => {
      if (dialog.open) dialog.close();
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [compactLayout, selectedWord]);

  useEffect(() => {
    if (!compactLayout && selectedWord) setSelectedWord(null);
  }, [compactLayout, selectedWord]);

  const closeDialog = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open || dialog.hasAttribute('data-closing')) return;
    if (prefersReducedMotion()) {
      dialog.close();
      return;
    }
    // Play the exit animation first; getAnimations() only covers the dialog
    // itself, so nested bar animations cannot end the wait early. The timeout
    // guarantees the close even when the browser skips frames (hidden tab).
    dialog.setAttribute('data-closing', 'true');
    const finish = () => dialog.close();
    window.setTimeout(finish, DIALOG_EXIT_FALLBACK_MS);
    Promise.allSettled(dialog.getAnimations().map((animation) => animation.finished)).then(finish);
  }, []);

  if (words.length === 0) return empty;

  const handleDialogClose = () => {
    setSelectedWord(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  };

  const handleDialogBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const clickedBackdrop =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (clickedBackdrop) closeDialog();
  };

  const handleDialogCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    closeDialog();
  };

  const hideHeadword = mode === 'dictation';
  const hideMeanings = mode === 'translation';

  return (
    <div className="word-list-shell">
      <div
        ref={listRef}
        className="word-list"
        data-word-card-mode={compactLayout ? 'compact' : 'full'}
        data-word-study-mode={mode}
      >
        {words.map((word, wordIndex) => (
          <article
            className={`word-card${hasPhraseMeaning(word) ? ' has-phrase' : ''}`}
            key={`${word.word}-${wordIndex}`}
            data-word={hideHeadword ? undefined : word.word}
            data-tone={getTone(wordIndex)}
          >
            <WordCardContent
              word={word}
              showSenses={!compactLayout}
              hideHeadword={hideHeadword}
              hideMeanings={hideMeanings}
              headerAction={
                compactLayout ? (
                  <button
                    type="button"
                    className="wc-expand-button"
                    aria-label={hideHeadword ? '查看完整卡片' : `查看 ${word.word} 完整卡片`}
                    title="查看完整卡片"
                    onClick={(event) => {
                      triggerRef.current = event.currentTarget;
                      setSelectedWord({ word, index: wordIndex });
                    }}
                  >
                    <ExpandIcon />
                  </button>
                ) : null
              }
            />
          </article>
        ))}
      </div>
      {compactLayout && selectedWord ? (
        <dialog
          ref={dialogRef}
          className={`word-card wc-detail-dialog${hasPhraseMeaning(selectedWord.word) ? ' has-phrase' : ''}`}
          data-word={selectedWord.word.word}
          data-tone={getTone(selectedWord.index)}
          aria-label={`${selectedWord.word.word} 完整词汇卡片`}
          onCancel={handleDialogCancel}
          onClose={handleDialogClose}
          onClick={handleDialogBackdropClick}
        >
          <WordCardContent
            word={selectedWord.word}
            showSenses
            headerAction={
              <button
                type="button"
                className="wc-detail-close"
                aria-label="关闭完整词汇卡片"
                title="关闭"
                onClick={closeDialog}
              >
                <CloseIcon />
              </button>
            }
          />
        </dialog>
      ) : null}
    </div>
  );
}
