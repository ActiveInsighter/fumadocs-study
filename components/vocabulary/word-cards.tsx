import type { ReactNode } from 'react';

export type WordMeaning = {
  pos?: string;
  text: string;
  key?: boolean;
  grammar?: string;
  phrase?: boolean;
};

export type WordSense = {
  gloss: string;
  count: number;
  examples?: string[];
  percentage?: number;
};

export type WordCardData = {
  word: string;
  phonetic?: string;
  frequency?: number;
  frequencyLabel?: string;
  meanings: WordMeaning[];
  senses?: WordSense[];
};

type WordCardsProps = {
  words: readonly WordCardData[];
  empty?: ReactNode;
};

function clampPercentage(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function getSensePercentage(sense: WordSense, total: number) {
  if (sense.percentage !== undefined) return clampPercentage(sense.percentage);
  if (total <= 0) return 0;
  return clampPercentage((sense.count / total) * 100);
}

function getFrequencyLabel(word: WordCardData) {
  if (word.frequencyLabel?.trim()) return word.frequencyLabel.trim();
  if (word.frequency !== undefined) return `考频 ${word.frequency}`;
  return null;
}

function MeaningText({ meaning }: { meaning: WordMeaning }) {
  const content = (
    <>
      {meaning.grammar ? <span className="wc-gram">{meaning.grammar}</span> : null}
      {meaning.grammar ? ' ' : null}
      {meaning.phrase ? <span className="wc-phrase">{meaning.text}</span> : meaning.text}
    </>
  );

  return meaning.key ? <span className="wc-key">{content}</span> : content;
}

export function WordCards({ words, empty = null }: WordCardsProps) {
  if (words.length === 0) return empty;

  return (
    <div className="word-list">
      {words.map((word, wordIndex) => {
        const frequencyLabel = getFrequencyLabel(word);
        const senseTotal = word.senses?.reduce((sum, sense) => sum + Math.max(0, sense.count), 0) ?? 0;

        return (
          <article className="word-card" key={`${word.word}-${wordIndex}`} data-word={word.word}>
            <div className="wc-header">
              <div className="wc-title">
                <span className="wc-word">{word.word}</span>
                {word.phonetic ? <span className="wc-phonetic">{word.phonetic}</span> : null}
              </div>

              {frequencyLabel ? <span className="wc-freq">{frequencyLabel}</span> : null}
            </div>

            <div className="wc-meaning">
              {word.meanings.map((meaning, meaningIndex) => (
                <span key={`${meaning.pos ?? 'meaning'}-${meaningIndex}`}>
                  {meaning.pos ? <span className="wc-pos">{meaning.pos}</span> : null}
                  <MeaningText meaning={meaning} />
                  {meaningIndex < word.meanings.length - 1 ? '；' : null}
                </span>
              ))}
            </div>

            {word.senses?.length ? (
              <div className="wc-senses">
                {word.senses.map((sense, senseIndex) => (
                  <div className="wc-sense" key={`${sense.gloss}-${senseIndex}`}>
                    <div className="wc-sense-row">
                      <span className="wc-sense-dot" aria-hidden="true" />
                      <span className="wc-sense-gloss">
                        {sense.gloss}
                        <span className="wc-sense-count">{Math.max(0, sense.count)} 次</span>
                      </span>
                      <span className="wc-sense-pct">{getSensePercentage(sense, senseTotal)}%</span>
                    </div>

                    {sense.examples?.length ? (
                      <div className="wc-sense-examples">
                        {sense.examples.map((example, exampleIndex) => (
                          <div key={`${example}-${exampleIndex}`}>{example}</div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
