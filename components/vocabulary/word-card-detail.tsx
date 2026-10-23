'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Modal, ModalContent, ModalHeader, ModalPane, ModalSplit, ModalTitle, ModalToolbar } from '@/components/ui/modal';
import {
  MeaningText,
  SenseExample,
  getSensePercentage,
  getTone,
  hasPhraseMeaning,
  type WordCardData,
  type WordSense,
} from './word-card-content';

type WordCardDetailProps = {
  words: readonly WordCardData[];
  index: number;
  open: boolean;
  onNavigate: (index: number) => void;
  onOpenChange: (open: boolean) => void;
  /** Where focus lands on close: the card last shown, not necessarily the one that opened it. */
  finalFocus: () => HTMLElement | boolean | null | undefined;
};

/*
 * The full card of a compact word, in the general Modal (components/ui/modal.tsx)
 * at a fixed height, so stepping through words never makes it jump.
 *
 *   header      word (phones: once the hero scrolls under it) · pager · close
 *   left pane   on the card's tone: headword, phonetic, label, meanings, and
 *               how the senses share the occurrences (each entry jumps to its sense)
 *   right pane  one row per sense: gloss, count and share, examples whose
 *               translation shows on hover or tap (the same tooltip as the page)
 *
 * Wide screens show the panes side by side, phones as one column. Text stays
 * neutral; only backgrounds and marks carry the tone. ←/→ and the pager step
 * through the list: the old card drifts out, the new one settles in from the
 * side it came from, and both panes start at the top again.
 */

type Direction = 'next' | 'prev' | null;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;

const stageVariants: Variants = {
  enter: (direction: Direction) => ({
    opacity: 0,
    x: direction === 'next' ? 28 : direction === 'prev' ? -28 : 0,
    filter: 'blur(6px)',
  }),
  center: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.42, ease: EASE_OUT, staggerChildren: 0.035 },
    transitionEnd: { filter: 'none' },
  },
  exit: (direction: Direction) => ({
    opacity: 0,
    x: direction === 'next' ? -18 : direction === 'prev' ? 18 : 0,
    filter: 'blur(4px)',
    transition: { duration: 0.16, ease: EASE_IN },
  }),
};

const reducedStageVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

/** Rows inside a stage rise in one after another as it settles. */
const rowVariants: Variants = {
  enter: { opacity: 0, y: 10 },
  center: { opacity: 1, y: 0, transition: { duration: 0.38, ease: EASE_OUT } },
};

export function WordCardDetail({ words, index, open, onNavigate, onOpenChange, finalFocus }: WordCardDetailProps) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState<Direction>(null);
  const reducedMotion = useReducedMotion();
  const word = words[index];
  const hasPrev = index > 0;
  const hasNext = index < words.length - 1;

  if (!word) return null;

  const go = (next: number) => {
    if (next < 0 || next >= words.length || next === index) return;
    setDirection(next > index ? 'next' : 'prev');
    onNavigate(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' && hasPrev) go(index - 1);
    else if (event.key === 'ArrowRight' && hasNext) go(index + 1);
    else return;
    event.preventDefault();
  };

  // The next card starts at the top: reset once the old one has left.
  const resetScroll = () => {
    for (const pane of [leftRef.current, rightRef.current]) if (pane) pane.scrollTop = 0;
    const split = leftRef.current?.parentElement;
    if (split) split.scrollTop = 0;
  };

  const showSense = (order: number) => {
    document.getElementById(senseId(index, order))?.scrollIntoView({
      block: 'start',
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  };

  const label = word.label?.trim() || null;
  const senses = word.senses ?? [];
  const total = senses.reduce((sum, sense) => sum + Math.max(0, sense.count), 0);
  const variants = reducedMotion ? reducedStageVariants : stageVariants;
  const stage = { custom: direction, variants, initial: 'enter', animate: 'center', exit: 'exit' } as const;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="lg"
        height="44rem"
        className={`wc-detail${hasPhraseMeaning(word) ? ' has-phrase' : ''}`}
        data-tone={getTone(index)}
        finalFocus={finalFocus}
        onKeyDown={handleKeyDown}
      >
        <ModalHeader>
          <ModalTitle className="wc-detail-title" lang="en">
            {word.word}
          </ModalTitle>
          {words.length > 1 ? (
            <ModalToolbar aria-label="切换单词">
              <span className="wc-pager">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="wc-pager-step"
                  aria-label="上一个单词"
                  title="上一个（←）"
                  disabled={!hasPrev}
                  onClick={() => go(index - 1)}
                >
                  <ChevronLeftIcon />
                </Button>
                <span className="wc-pager-count" aria-live="polite">
                  <span className="sr-only">第 </span>
                  {index + 1}
                  <span className="wc-pager-total"> / {words.length}</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="wc-pager-step"
                  aria-label="下一个单词"
                  title="下一个（→）"
                  disabled={!hasNext}
                  onClick={() => go(index + 1)}
                >
                  <ChevronRightIcon />
                </Button>
              </span>
            </ModalToolbar>
          ) : null}
        </ModalHeader>
        <ModalSplit className="wc-detail-split" columns="minmax(0, 0.82fr) minmax(0, 1.18fr)">
          <ModalPane ref={leftRef} tone="muted" className="wc-detail-side">
            <AnimatePresence mode="wait" initial={false} custom={direction} onExitComplete={resetScroll}>
              <motion.div key={index} className="wc-detail-stage" {...stage}>
                <section className="wc-detail-hero" aria-label="单词与释义">
                  <div className="wc-detail-headline">
                    <span className="wc-detail-word" lang="en">
                      {word.word}
                    </span>
                    {label ? <span className="wc-label">{label}</span> : null}
                  </div>
                  {word.phonetic ? <div className="wc-detail-phonetic">{word.phonetic}</div> : null}
                  <div className="wc-detail-meanings">
                    {word.meanings.map((meaning, meaningIndex) => (
                      <motion.div
                        variants={rowVariants}
                        className={`wc-detail-meaning${meaning.key ? ' is-key' : ''}`}
                        key={`${meaning.pos ?? 'meaning'}-${meaningIndex}`}
                      >
                        <span className="wc-detail-pos">{meaning.pos ? <span className="wc-pos">{meaning.pos}</span> : null}</span>
                        <span className="wc-detail-meaning-text">
                          <MeaningText meaning={meaning} />
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </section>
                {senses.length ? (
                  <SenseSummary senses={senses} total={total} onSelect={showSense} />
                ) : null}
              </motion.div>
            </AnimatePresence>
          </ModalPane>
          <ModalPane ref={rightRef} className="wc-detail-main">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.section key={index} className="wc-detail-stage" aria-labelledby={`wc-detail-senses-${index}`} {...stage}>
                <div className="wc-detail-section-label">
                  <span id={`wc-detail-senses-${index}`}>真题语境</span>
                  {senses.length ? <span className="wc-detail-hint">悬停或点按例句查看译文</span> : null}
                </div>
                {senses.length ? (
                  <ol className="wc-detail-sense-list">
                    {senses.map((sense, order) => (
                      <SenseBlock
                        key={`${sense.gloss}-${order}`}
                        id={senseId(index, order)}
                        sense={sense}
                        order={order}
                        total={total}
                      />
                    ))}
                  </ol>
                ) : (
                  <p className="wc-detail-empty">这个词暂时没有收录真题例句。</p>
                )}
              </motion.section>
            </AnimatePresence>
          </ModalPane>
        </ModalSplit>
      </ModalContent>
    </Modal>
  );
}

function senseId(wordIndex: number, order: number) {
  return `wc-detail-sense-${wordIndex}-${order}`;
}

/** Each sense's tone: the first at the full bar colour, later ones lighter. */
function senseTone(order: number) {
  return { '--wc-seg-mix': `${Math.max(28, 100 - order * 24)}%` } as CSSProperties;
}

function formatOrder(order: number) {
  return String(order + 1).padStart(2, '0');
}

/** How the occurrences split across senses: one bar, then a legend that jumps to each sense. */
function SenseSummary({
  senses,
  total,
  onSelect,
}: {
  senses: readonly WordSense[];
  total: number;
  onSelect: (order: number) => void;
}) {
  return (
    <motion.section variants={rowVariants} className="wc-detail-summary" aria-label="义项分布">
      <div className="wc-detail-summary-head">
        <span>义项分布</span>
        <span className="wc-detail-summary-meta">
          {senses.length} 个义项 · 共 {total} 次
        </span>
      </div>
      <div className="wc-detail-distribution" aria-hidden="true">
        {senses.map((sense, order) => (
          <span
            key={`${sense.gloss}-${order}`}
            className="wc-detail-segment"
            style={{ ...senseTone(order), flexGrow: Math.max(1, getSensePercentage(sense, total)) }}
          />
        ))}
      </div>
      <ol className="wc-detail-legend">
        {senses.map((sense, order) => (
          <li key={`${sense.gloss}-${order}`}>
            <button type="button" className="wc-detail-legend-item" onClick={() => onSelect(order)}>
              <span className="wc-detail-swatch" style={senseTone(order)} aria-hidden="true" />
              <span className="wc-detail-legend-order">{formatOrder(order)}</span>
              <span className="wc-detail-legend-gloss">{sense.gloss}</span>
              <span className="wc-detail-legend-pct">{getSensePercentage(sense, total)}%</span>
            </button>
          </li>
        ))}
      </ol>
    </motion.section>
  );
}

function SenseBlock({ id, sense, order, total }: { id: string; sense: WordSense; order: number; total: number }) {
  return (
    <motion.li variants={rowVariants} id={id} className="wc-detail-sense">
      <div className="wc-detail-sense-head">
        <span className="wc-detail-sense-index" style={senseTone(order)} aria-hidden="true">
          {formatOrder(order)}
        </span>
        <span className="wc-detail-sense-gloss">{sense.gloss}</span>
        <span className="wc-detail-sense-stats">
          <span className="wc-sense-count">{Math.max(0, sense.count)} 次</span>
          <span className="wc-sense-pct">{getSensePercentage(sense, total)}%</span>
        </span>
      </div>
      {sense.examples?.length ? (
        <ul className="wc-detail-examples">
          {sense.examples.map((example, exampleIndex) => (
            <li className="wc-detail-example" key={`${example.text}-${exampleIndex}`}>
              <SenseExample example={example} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="wc-no-example">暂无例句</p>
      )}
    </motion.li>
  );
}
