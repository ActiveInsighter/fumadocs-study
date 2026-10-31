'use client';

import { memo, useCallback, useState, type ReactNode } from 'react';
import { getTone, hasPhraseMeaning, type WordCardData } from './model';
import { useCompactMasonry } from './use-compact-masonry';
import { WordCardContent } from './word-card-content';
import { WordCardDetail } from './word-card-detail';
import { useWordCardMode, type WordCardMode } from './word-card-mode';

export type { WordCardData, WordExample, WordMeaning, WordSense } from './model';
export { WordCardModeToggle, WordCardsProvider, type WordCardMode } from './word-card-mode';

type WordCardsProps = {
  words: readonly WordCardData[];
  empty?: ReactNode;
};

/*
 * A list of vocabulary cards in the page's display mode:
 *
 *   full          one column; every sense with its share and examples
 *   compact       masonry of headword + meanings, each opening the detail modal
 *   dictation     compact, with the headword left out
 *   translation   compact, with the meanings left out
 *
 * Cards are memoised and share one stable open handler, so opening or
 * stepping through the modal rerenders the modal only, never the list.
 */
export function WordCards({ words, empty = null }: WordCardsProps) {
  const mode = useWordCardMode();
  const compactLayout = mode !== 'full';
  const listRef = useCompactMasonry(compactLayout, words.length);
  const [detailIndex, setDetailIndex] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = useCallback((index: number) => {
    setDetailIndex(index);
    setDetailOpen(true);
  }, []);

  // Return focus to the card that was last shown, which may differ from the
  // one that opened the modal after prev/next navigation.
  const detailFinalFocus = useCallback(
    () => listRef.current?.querySelectorAll<HTMLButtonElement>(':scope > .word-card .wc-expand-button')[detailIndex] ?? true,
    [detailIndex, listRef],
  );

  if (words.length === 0) return empty;

  return (
    <div className="word-list-shell">
      <div
        ref={listRef}
        className="word-list"
        data-word-card-mode={compactLayout ? 'compact' : 'full'}
        data-word-study-mode={mode}
      >
        {words.map((word, wordIndex) => (
          <WordCard key={`${word.word}-${wordIndex}`} word={word} index={wordIndex} mode={mode} onOpen={openDetail} />
        ))}
      </div>
      {/* Full mode already shows every detail, so the modal only exists in compact layouts. */}
      {compactLayout ? (
        <WordCardDetail
          words={words}
          index={Math.min(detailIndex, words.length - 1)}
          open={detailOpen}
          onNavigate={setDetailIndex}
          onOpenChange={setDetailOpen}
          finalFocus={detailFinalFocus}
        />
      ) : null}
    </div>
  );
}

type WordCardProps = {
  word: WordCardData;
  index: number;
  mode: WordCardMode;
  onOpen: (index: number) => void;
};

const WordCard = memo(function WordCard({ word, index, mode, onOpen }: WordCardProps) {
  const compactLayout = mode !== 'full';
  const hideHeadword = mode === 'dictation';
  const hideMeanings = mode === 'translation';
  return (
    <article
      className={`word-card${hasPhraseMeaning(word) ? ' has-phrase' : ''}`}
      data-word={hideHeadword ? undefined : word.word}
      data-tone={getTone(index)}
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
              onClick={() => onOpen(index)}
            >
              <ExpandIcon />
            </button>
          ) : null
        }
      />
    </article>
  );
});

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
    </svg>
  );
}
