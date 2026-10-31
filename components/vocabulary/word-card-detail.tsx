'use client';

import { useCallback, useId, useMemo, type CSSProperties } from 'react';
import {
  StudyCard,
  StudyCardAside,
  StudyCardHeader,
  StudyCardHero,
  StudyCardMain,
  StudyCardSection,
  StudyCardStage,
  studyCardReveal,
} from '@/components/ui/study-card';
import { MeaningText, PosTag } from './meaning-text';
import {
  cardLabel,
  formatOrder,
  getTone,
  hasPhraseMeaning,
  senseColor,
  summarizeSenses,
  type SenseStat,
  type SenseSummary,
  type WordCardData,
} from './model';
import { prefersReducedMotion } from './reduced-motion';
import { SenseDistribution } from './sense-distribution';
import { SenseExample } from './sense-example';

/*
 * The full card of a compact word: only the vocabulary content. The study
 * card deck (components/ui/study-card.tsx) owns everything else: the modal,
 * the split, the header badge and pager, ←/→ and swipes, and the motion.
 *
 *   aside   on the card's tone: headword, phonetic, meanings, and a donut
 *           of how the senses share the occurrences (sense-distribution.tsx)
 *   main    one bar-list row per sense (its share fills the row behind the
 *           gloss, in the sense's colour from the donut), then examples whose
 *           translation shows on hover or tap (sense-example.tsx)
 *
 * Text stays neutral; only backgrounds and marks carry the tone.
 */

/** The aside's share of the width on wide screens. */
const ASIDE_RATIO = 0.42;
const FLASH_MS = 1100;
const DECK_LABELS = { group: '切换单词', prev: '上一个单词', next: '下一个单词' };

type WordCardDetailProps = {
  words: readonly WordCardData[];
  index: number;
  open: boolean;
  onNavigate: (index: number) => void;
  onOpenChange: (open: boolean) => void;
  /** Where focus lands on close: the card last shown, not necessarily the one that opened it. */
  finalFocus: () => HTMLElement | boolean | null | undefined;
};

export function WordCardDetail({ words, index, open, onNavigate, onOpenChange, finalFocus }: WordCardDetailProps) {
  const word = words[index];
  if (!word) return null;

  const label = cardLabel(word);
  const itemKey = `${index}:${word.word}`;

  return (
    <StudyCard
      open={open}
      onOpenChange={onOpenChange}
      count={words.length}
      index={index}
      onIndexChange={onNavigate}
      itemKey={itemKey}
      labels={DECK_LABELS}
      size="lg"
      height="44rem"
      className={`wc-detail${hasPhraseMeaning(word) ? ' has-phrase' : ''}`}
      data-tone={getTone(index)}
      finalFocus={finalFocus}
    >
      <StudyCardHeader
        title={word.word}
        titleMode="scrolled"
        titleProps={{ lang: 'en', className: 'wc-detail-title' }}
        badge={label}
      />
      <StudyCardStage ratio={ASIDE_RATIO}>
        <WordCardBody key={itemKey} word={word} />
      </StudyCardStage>
    </StudyCard>
  );
}

/** Scrolls a sense into view in its pane and briefly outlines it. */
function revealSense(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  target.dataset.flash = '';
  window.setTimeout(() => delete target.dataset.flash, FLASH_MS);
}

/** One card's two panes; keyed by card so each step starts from fresh state. */
function WordCardBody({ word }: { word: WordCardData }) {
  const idPrefix = useId();
  const summary = useMemo(() => summarizeSenses(word.senses), [word.senses]);
  const senseId = useCallback((order: number) => `${idPrefix}-sense-${order}`, [idPrefix]);
  const showSense = useCallback((order: number) => revealSense(senseId(order)), [senseId]);

  return (
    <>
      <StudyCardAside className="wc-detail-side">
        <WordHero word={word} />
        {summary.senses.length ? (
          <SenseDistribution word={word.word} summary={summary} order={word.meanings.length} onSelect={showSense} />
        ) : null}
      </StudyCardAside>
      <StudyCardMain>
        <SenseContexts summary={summary} senseId={senseId} />
      </StudyCardMain>
    </>
  );
}

function WordHero({ word }: { word: WordCardData }) {
  return (
    <StudyCardHero
      className="wc-detail-hero"
      title={word.word}
      titleProps={{ lang: 'en', className: 'wc-detail-word' }}
      subtitle={word.phonetic ? <span className="wc-detail-phonetic">{word.phonetic}</span> : null}
    >
      <div className="wc-detail-meanings" aria-label="释义" role="list">
        {word.meanings.map((meaning, meaningIndex) => (
          <div
            role="listitem"
            className={`wc-detail-meaning${meaning.key ? ' is-key' : ''}`}
            key={`${meaning.pos ?? 'meaning'}-${meaningIndex}`}
            {...studyCardReveal(meaningIndex)}
          >
            <span className="wc-detail-pos">
              <PosTag pos={meaning.pos} />
            </span>
            <span className="wc-detail-meaning-text">
              <MeaningText meaning={meaning} />
            </span>
          </div>
        ))}
      </div>
    </StudyCardHero>
  );
}

function SenseContexts({ summary, senseId }: { summary: SenseSummary; senseId: (order: number) => string }) {
  const { senses } = summary;
  return (
    <StudyCardSection label="真题语境" meta={senses.length ? '悬停或点按例句查看译文' : null}>
      {senses.length ? (
        <ol className="wc-detail-sense-list">
          {senses.map((sense, order) => (
            <SenseBlock key={`${sense.gloss}-${order}`} id={senseId(order)} sense={sense} order={order} />
          ))}
        </ol>
      ) : (
        <p className="wc-detail-empty">这个词暂时没有收录真题例句。</p>
      )}
    </StudyCardSection>
  );
}

function SenseBlock({ id, sense, order }: { id: string; sense: SenseStat; order: number }) {
  const style = { '--wc-sense-color': senseColor(order), '--wc-share': `${sense.percentage}%` } as CSSProperties;
  return (
    <li id={id} className="wc-detail-sense" {...studyCardReveal(order + 1, style)}>
      {/* A bar list row: the share fills the row behind the gloss. */}
      <div className="wc-detail-sense-row">
        <span className="wc-detail-sense-fill" aria-hidden="true" />
        <span className="wc-detail-sense-index" aria-hidden="true">
          {formatOrder(order)}
        </span>
        <span className="wc-detail-sense-gloss">{sense.gloss}</span>
        <span className="wc-detail-sense-stats">
          <span className="wc-detail-count">
            {sense.count}
            <span className="wc-detail-unit">次</span>
          </span>
          <span className="wc-detail-pct">{sense.percentage}%</span>
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
    </li>
  );
}
