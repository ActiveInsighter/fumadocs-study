'use client';

import { useState, type ReactNode } from 'react';
import { useCompactMasonry } from './use-compact-masonry';
import { ExpandIcon, WordCardContent, getTone, hasPhraseMeaning, type WordCardData } from './word-card-content';
import { WordCardDetailDialog } from './word-card-detail-dialog';
import { useWordCardMode } from './word-card-mode';

export type { WordCardData, WordExample, WordMeaning, WordSense } from './word-card-content';
export { WordCardModeToggle, WordCardsProvider, type WordCardMode } from './word-card-mode';

type WordCardsProps = {
  words: readonly WordCardData[];
  empty?: ReactNode;
};

export function WordCards({ words, empty = null }: WordCardsProps) {
  const mode = useWordCardMode();
  const compactLayout = mode !== 'full';
  const listRef = useCompactMasonry(compactLayout, words.length);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);

  if (words.length === 0) return empty;

  const hideHeadword = mode === 'dictation';
  const hideMeanings = mode === 'translation';
  // Full mode already shows every detail, so the dialog only exists in compact layouts.
  const openIndex = compactLayout && detailIndex !== null && detailIndex < words.length ? detailIndex : null;

  const handleDetailClosed = () => {
    const index = detailIndex;
    setDetailIndex(null);
    if (index === null) return;
    // Return focus to the card that was last shown, which may differ from the
    // one that opened the dialog after prev/next navigation.
    window.requestAnimationFrame(() => {
      listRef.current?.querySelectorAll<HTMLButtonElement>(':scope > .word-card .wc-expand-button')[index]?.focus();
    });
  };

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
                    onClick={() => setDetailIndex(wordIndex)}
                  >
                    <ExpandIcon />
                  </button>
                ) : null
              }
            />
          </article>
        ))}
      </div>
      {openIndex !== null ? (
        <WordCardDetailDialog
          words={words}
          index={openIndex}
          onNavigate={setDetailIndex}
          onClosed={handleDetailClosed}
        />
      ) : null}
    </div>
  );
}
