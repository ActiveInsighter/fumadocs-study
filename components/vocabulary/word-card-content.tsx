'use client';

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

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

const TONE_COUNT = 7;
/** Minimum distance kept between a tooltip and the edge of its clipping box. */
const TOOLTIP_EDGE_GAP = 8;

export function getTone(index: number) {
  return (index % TONE_COUNT) + 1;
}

export function hasPhraseMeaning(word: WordCardData) {
  return word.meanings.some((meaning) => meaning.phrase);
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function clampPercentage(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function getSensePercentage(sense: WordSense, total: number) {
  if (sense.percentage !== undefined) return clampPercentage(sense.percentage);
  if (total <= 0) return 0;
  return clampPercentage((sense.count / total) * 100);
}

export function MeaningText({ meaning }: { meaning: WordMeaning }) {
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

/** The visible box of an enclosing modal page: below its floating header. */
function modalClip(page: HTMLElement) {
  const rect = page.getBoundingClientRect();
  const header = page.querySelector<HTMLElement>('[data-slot="modal-header"]');
  return { top: rect.top + (header?.offsetHeight ?? 0), left: rect.left, right: rect.right, bottom: rect.bottom };
}

/**
 * Flips the tooltip below its sentence when there is no room above, and shifts
 * it sideways so it stays inside an enclosing modal (or the viewport on the page).
 */
function placeTooltip(root: HTMLElement, tooltip: HTMLElement) {
  const page = root.closest<HTMLElement>('[data-slot="modal-page"]');
  const clip = page
    ? modalClip(page)
    : { top: 0, left: 0, right: document.documentElement.clientWidth, bottom: window.innerHeight };
  const anchor = root.getBoundingClientRect();
  // Layout size: the tooltip is still scaled down by its entry transform here.
  const { offsetWidth: width, offsetHeight: height } = tooltip;
  const spaceAbove = anchor.top - clip.top;
  const spaceBelow = clip.bottom - anchor.bottom;
  const placement = spaceAbove < height + TOOLTIP_EDGE_GAP && spaceBelow > spaceAbove ? 'bottom' : 'top';
  const maxLeft = clip.right - TOOLTIP_EDGE_GAP - width;
  const left = Math.max(clip.left + TOOLTIP_EDGE_GAP, Math.min(anchor.left, maxLeft));
  root.dataset.placement = placement;
  root.style.setProperty('--wc-tooltip-shift', `${Math.round(left - anchor.left)}px`);
}

export function SenseExample({ example }: { example: WordExample }) {
  const tooltipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const pointerTypeRef = useRef('mouse');
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    if (open && rootRef.current && tooltipRef.current) placeTooltip(rootRef.current, tooltipRef.current);
  }, [open]);

  const handleHover = (event: PointerEvent<HTMLSpanElement>, nextOpen: boolean) => {
    if (event.pointerType === 'mouse') setOpen(nextOpen);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Escape' || !open) return;
    // Close only the tooltip; keep an enclosing modal open.
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
  };

  return (
    <span
      ref={rootRef}
      className="wc-example"
      data-open={open}
      onPointerEnter={(event) => handleHover(event, true)}
      onPointerLeave={(event) => handleHover(event, false)}
    >
      <button
        type="button"
        className="wc-example-trigger"
        lang="en"
        aria-describedby={tooltipId}
        aria-expanded={open}
        onPointerDown={(event) => {
          pointerTypeRef.current = event.pointerType;
        }}
        // Mouse users already see the hover tooltip; touch users toggle it.
        onClick={() => setOpen((value) => (pointerTypeRef.current === 'mouse' ? true : !value))}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
      >
        {example.text}
      </button>
      <span ref={tooltipRef} className="wc-example-tooltip" id={tooltipId} role="tooltip">
        <span className="wc-example-tooltip-label">译文</span>
        <span lang="zh-CN">{example.translation}</span>
      </span>
    </span>
  );
}

function SenseList({ senses }: { senses: readonly WordSense[] }) {
  const total = senses.reduce((sum, sense) => sum + Math.max(0, sense.count), 0);
  return (
    <div className="wc-senses">
      {senses.map((sense, senseIndex) => {
        const percentage = getSensePercentage(sense, total);
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
  );
}

export function WordCardContent({
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
  const label = word.label?.trim() || null;
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
      {showSenses && word.senses?.length ? <SenseList senses={word.senses} /> : null}
    </>
  );
}

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={path} />
    </svg>
  );
}

export const ExpandIcon = () => <Icon path="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />;
