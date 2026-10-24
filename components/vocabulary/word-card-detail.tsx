'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { StudyPieChart } from '@/components/charts';
import {
  KnowledgeCard,
  KnowledgeCardAside,
  KnowledgeCardHeader,
  KnowledgeCardHero,
  KnowledgeCardMain,
  KnowledgeCardSection,
  KnowledgeCardStage,
  knowledgeCardReveal,
} from '@/components/ui/knowledge-card';
import {
  MeaningText,
  SenseExample,
  getSensePercentage,
  getTone,
  hasPhraseMeaning,
  prefersReducedMotion,
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
 * The full card of a compact word: the vocabulary content for the general
 * knowledge card deck (components/ui/knowledge-card.tsx), which owns the
 * modal, the pager, ←/→ and swipes, and the card-to-card motion.
 *
 *   aside   on the card's tone: headword, phonetic, label, meanings, and a
 *           donut of how the senses share the occurrences, with a legend
 *           that highlights a slice and jumps to its sense
 *   main    one bar-list row per sense (its share fills the row behind the
 *           gloss, in the sense's colour from the donut; count and share on
 *           the right), then examples whose translation shows on hover or
 *           tap (the same tooltip as the page)
 *
 * The left-hand chart and legend highlight each other; right-hand sense
 * interactions stay local to the right pane, without rerendering the chart.
 *
 * Text stays neutral; only backgrounds and marks carry the tone.
 */

/** Sense colours: the card's bar colour, each later sense lighter. */
function senseColor(order: number) {
  return `color-mix(in oklab, var(--bar-fill) ${Math.max(30, 100 - order * 22)}%, var(--card-bg))`;
}

function senseStyle(order: number) {
  return { '--wc-sense-color': senseColor(order) } as CSSProperties;
}

function formatOrder(order: number) {
  return String(order + 1).padStart(2, '0');
}

function senseId(word: string, order: number) {
  return `wc-detail-${encodeURIComponent(word)}-${order}`;
}

const FLASH_MS = 1100;

export function WordCardDetail({ words, index, open, onNavigate, onOpenChange, finalFocus }: WordCardDetailProps) {
  const word = words[index];
  if (!word) return null;

  const label = word.label?.trim() || null;
  const senses = word.senses ?? [];
  const itemKey = `${index}:${word.word}`;

  return (
    <KnowledgeCard
      open={open}
      onOpenChange={onOpenChange}
      count={words.length}
      index={index}
      onIndexChange={onNavigate}
      itemKey={itemKey}
      labels={{ group: '切换单词', prev: '上一个单词', next: '下一个单词' }}
      size="lg"
      height="44rem"
      className={`wc-detail${hasPhraseMeaning(word) ? ' has-phrase' : ''}`}
      data-tone={getTone(index)}
      finalFocus={finalFocus}
    >
      <KnowledgeCardHeader
        title={word.word}
        titleMode="scrolled"
        titleProps={{ lang: 'en', className: 'wc-detail-title' }}
      />
      <KnowledgeCardStage columns="minmax(0, 0.86fr) minmax(0, 1.14fr)">
        <WordCardBody key={itemKey} word={word} label={label} senses={senses} />
      </KnowledgeCardStage>
    </KnowledgeCard>
  );
}

/** Keep chart hover state inside the aside; right-pane interaction must not touch it. */
function WordCardBody({ word, label, senses }: { word: WordCardData; label: string | null; senses: readonly WordSense[] }) {
  return (
    <>
      <WordAside word={word} label={label} senses={senses} />
      <WordMain word={word} senses={senses} />
    </>
  );
}

function WordAside({
  word,
  label,
  senses,
}: {
  word: WordCardData;
  label: string | null;
  senses: readonly WordSense[];
}) {
  return (
    <KnowledgeCardAside className="wc-detail-side">
      <KnowledgeCardHero
        className="wc-detail-hero"
        title={word.word}
        titleProps={{ lang: 'en', className: 'wc-detail-word' }}
        subtitle={word.phonetic ? <span className="wc-detail-phonetic">{word.phonetic}</span> : null}
        badge={label ? <span className="wc-label">{label}</span> : null}
      >
        <div className="wc-detail-meanings" aria-label="释义" role="list">
          {word.meanings.map((meaning, meaningIndex) => (
            <div
              role="listitem"
              className={`wc-detail-meaning${meaning.key ? ' is-key' : ''}`}
              key={`${meaning.pos ?? 'meaning'}-${meaningIndex}`}
              {...knowledgeCardReveal(meaningIndex)}
            >
              <span className="wc-detail-pos">{meaning.pos ? <span className="wc-pos">{meaning.pos}</span> : null}</span>
              <span className="wc-detail-meaning-text">
                <MeaningText meaning={meaning} />
              </span>
            </div>
          ))}
        </div>
      </KnowledgeCardHero>
      {senses.length ? (
        <SenseDistribution word={word.word} senses={senses} offset={word.meanings.length} />
      ) : null}
    </KnowledgeCardAside>
  );
}

/**
 * How the occurrences split across senses: the study donut, total in the
 * hole, beside a legend. Hovering the chart or legend highlights only
 * the aside; choosing a sense scrolls the right pane to it.
 */
function SenseDistribution({
  word,
  senses,
  offset,
}: {
  word: string;
  senses: readonly WordSense[];
  offset: number;
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = senses.reduce((sum, sense) => sum + Math.max(0, sense.count), 0);
  // Preserve Pie.data identity when the active slice changes: Recharts otherwise
  // treats hover as fresh data and can replay its entry animation.
  const data = useMemo(() => senses.map((sense) => ({ gloss: sense.gloss, count: Math.max(0, sense.count) })), [senses]);
  const colors = useMemo(() => Object.fromEntries(senses.map((sense, order) => [sense.gloss, senseColor(order)])), [senses]);

  const show = (order: number) => {
    setActive(senses[order]?.gloss ?? null);
    const target = document.getElementById(senseId(word, order));
    if (!target) return;
    target.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    target.dataset.flash = '';
    window.setTimeout(() => delete target.dataset.flash, FLASH_MS);
  };
  const showByName = (name: string) => {
    const order = senses.findIndex((sense) => sense.gloss === name);
    if (order >= 0) show(order);
  };

  return (
    <KnowledgeCardSection
      className="wc-detail-summary"
      label="义项分布"
      meta={`${senses.length} 个义项 · 共 ${total} 次`}
      {...knowledgeCardReveal(offset)}
    >
      <div className="wc-detail-distribution">
        <div className="wc-detail-donut">
          <StudyPieChart
            variant="inline"
            title={`${word} 的义项分布`}
            summary={senses.map((sense) => `${sense.gloss} ${getSensePercentage(sense, total)}%`).join('，')}
            data={data}
            nameKey="gloss"
            valueKey="count"
            donut
            centerLabel={String(total)}
            centerCaption="次出现"
            colors={colors}
            maxSlices={Math.max(1, senses.length)}
            height={156}
            activeName={active}
            onActiveNameChange={setActive}
            onSliceClick={showByName}
          />
        </div>
        <ol className="wc-detail-legend" onPointerLeave={() => setActive(null)}>
          {senses.map((sense, order) => (
            <li key={`${sense.gloss}-${order}`}>
              <button
                type="button"
                className="wc-detail-legend-item"
                title={sense.gloss}
                data-active={active === sense.gloss ? '' : undefined}
                data-dim={active && active !== sense.gloss ? '' : undefined}
                style={senseStyle(order)}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') setActive(sense.gloss);
                }}
                onFocus={(event) => {
                  if (event.currentTarget.matches(':focus-visible')) setActive(sense.gloss);
                }}
                onBlur={() => setActive(null)}
                onClick={() => show(order)}
              >
                <span className="wc-detail-swatch" aria-hidden="true" />
                <span className="wc-detail-legend-gloss">{sense.gloss}</span>
                <span className="wc-detail-legend-pct">{getSensePercentage(sense, total)}%</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </KnowledgeCardSection>
  );
}

function WordMain({ word, senses }: { word: WordCardData; senses: readonly WordSense[] }) {
  const total = senses.reduce((sum, sense) => sum + Math.max(0, sense.count), 0);
  return (
    <KnowledgeCardMain>
      <KnowledgeCardSection label="真题语境" meta={senses.length ? '悬停或点按例句查看译文' : null}>
        {senses.length ? (
          <ol className="wc-detail-sense-list">
            {senses.map((sense, order) => (
              <SenseBlock
                key={`${sense.gloss}-${order}`}
                id={senseId(word.word, order)}
                sense={sense}
                order={order}
                total={total}
              />
            ))}
          </ol>
        ) : (
          <p className="wc-detail-empty">这个词暂时没有收录真题例句。</p>
        )}
      </KnowledgeCardSection>
    </KnowledgeCardMain>
  );
}

function SenseBlock({
  id,
  sense,
  order,
  total,
}: {
  id: string;
  sense: WordSense;
  order: number;
  total: number;
}) {
  const percentage = getSensePercentage(sense, total);
  const count = Math.max(0, sense.count);
  const style = { ...senseStyle(order), '--wc-share': `${percentage}%` } as CSSProperties;
  return (
    <li
      id={id}
      className="wc-detail-sense"
      {...knowledgeCardReveal(order + 1, style)}
    >
      {/* A bar list row: the share fills the row behind the gloss. */}
      <div className="wc-detail-sense-row">
        <span className="wc-detail-sense-fill" aria-hidden="true" />
        <span className="wc-detail-sense-index" aria-hidden="true">
          {formatOrder(order)}
        </span>
        <span className="wc-detail-sense-gloss">{sense.gloss}</span>
        <span className="wc-detail-sense-stats">
          <span className="wc-detail-count">
            {count}
            <span className="wc-detail-unit">次</span>
          </span>
          <span className="wc-detail-pct">{percentage}%</span>
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
