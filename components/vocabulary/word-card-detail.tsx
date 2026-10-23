'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Modal, ModalBody, ModalContent, ModalHeader, ModalTitle, ModalToolbar } from '@/components/ui/modal';
import {
  MeaningText,
  getSensePercentage,
  getTone,
  hasPhraseMeaning,
  type WordCardData,
  type WordExample,
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
 * The full card of a compact word, in the general Modal (components/ui/modal.tsx).
 *
 *   header  word (fades in once the hero scrolls under it) · pager · close
 *   hero    headword, phonetic and label on the card's tone, then the meanings
 *   senses  one block per sense: gloss, count and share, examples with their
 *           translation written out (no tooltips in the modal)
 *
 * ←/→ and the pager step through the list; the body slides in from the side
 * it came from and starts at the top again.
 */
export function WordCardDetail({ words, index, open, onNavigate, onOpenChange, finalFocus }: WordCardDetailProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState<'next' | 'prev' | null>(null);
  const word = words[index];
  const hasPrev = index > 0;
  const hasNext = index < words.length - 1;

  useLayoutEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [index]);

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

  const label = word.label?.trim() || null;
  const senses = word.senses ?? [];
  const total = senses.reduce((sum, sense) => sum + Math.max(0, sense.count), 0);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="md"
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
        <ModalBody ref={bodyRef} className="wc-detail-body">
          <div key={index} className="wc-detail-stage" data-direction={direction ?? undefined}>
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
                  <div
                    className={`wc-detail-meaning${meaning.key ? ' is-key' : ''}`}
                    key={`${meaning.pos ?? 'meaning'}-${meaningIndex}`}
                  >
                    <span className="wc-detail-pos">{meaning.pos ? <span className="wc-pos">{meaning.pos}</span> : null}</span>
                    <span className="wc-detail-meaning-text">
                      <MeaningText meaning={meaning} />
                    </span>
                  </div>
                ))}
              </div>
            </section>
            {senses.length ? (
              <section className="wc-detail-senses" aria-labelledby={`wc-detail-senses-${index}`}>
                <div className="wc-detail-section-label">
                  <span id={`wc-detail-senses-${index}`}>真题语境</span>
                  <span className="wc-detail-section-meta">
                    {senses.length} 个义项 · 共 {total} 次
                  </span>
                </div>
                <ol className="wc-detail-sense-list">
                  {senses.map((sense, senseIndex) => (
                    <SenseBlock key={`${sense.gloss}-${senseIndex}`} sense={sense} order={senseIndex + 1} total={total} />
                  ))}
                </ol>
              </section>
            ) : null}
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

function SenseBlock({ sense, order, total }: { sense: WordSense; order: number; total: number }) {
  const percentage = getSensePercentage(sense, total);
  return (
    <li className="wc-detail-sense">
      <div className="wc-detail-sense-head">
        <span className="wc-detail-sense-index" aria-hidden="true">
          {String(order).padStart(2, '0')}
        </span>
        <span className="wc-detail-sense-gloss">{sense.gloss}</span>
        <span className="wc-detail-sense-stats">
          <span className="wc-sense-count">{Math.max(0, sense.count)} 次</span>
          <span className="wc-sense-pct">{percentage}%</span>
        </span>
      </div>
      <span className="wc-detail-sense-bar" aria-hidden="true">
        <span className="wc-bar-fill" style={{ width: `${percentage}%` }} />
      </span>
      {sense.examples?.length ? (
        <ul className="wc-detail-examples">
          {sense.examples.map((example, exampleIndex) => (
            <DetailExample key={`${example.text}-${exampleIndex}`} example={example} />
          ))}
        </ul>
      ) : (
        <p className="wc-no-example">暂无例句</p>
      )}
    </li>
  );
}

function DetailExample({ example }: { example: WordExample }) {
  return (
    <li className="wc-detail-example">
      <span className="wc-detail-example-text" lang="en">
        {example.text}
      </span>
      <span className="wc-detail-example-translation">{example.translation}</span>
    </li>
  );
}
