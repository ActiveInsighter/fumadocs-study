import type { ReactNode } from 'react';
import { MeaningText, PosTag } from './meaning-text';
import { cardLabel, summarizeSenses, type SenseStat, type WordCardData } from './model';
import { SenseExample } from './sense-example';

type WordCardContentProps = {
  word: WordCardData;
  /** Full cards list every sense with its share and examples. */
  showSenses: boolean;
  /** Dictation: the headword and phonetic are left out of the markup. */
  hideHeadword?: boolean;
  /** Translation: the Chinese meanings are left out of the markup. */
  hideMeanings?: boolean;
  /** A control at the end of the header row, after the label. */
  headerAction?: ReactNode;
};

/** The face of one vocabulary card: header, meanings and (in full mode) senses. */
export function WordCardContent({
  word,
  showSenses,
  hideHeadword = false,
  hideMeanings = false,
  headerAction,
}: WordCardContentProps) {
  const label = cardLabel(word);
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
              <PosTag pos={meaning.pos} />
              <MeaningText meaning={meaning} />
            </div>
          ))}
        </div>
      ) : null}
      {showSenses && word.senses?.length ? <SenseList senses={summarizeSenses(word.senses).senses} /> : null}
    </>
  );
}

function SenseList({ senses }: { senses: readonly SenseStat[] }) {
  return (
    <div className="wc-senses">
      {senses.map((sense, senseIndex) => (
        <div className="wc-sense" key={`${sense.gloss}-${senseIndex}`}>
          <div className="wc-sense-main">
            <div className="wc-sense-row">
              <span className="wc-sense-dot" aria-hidden="true" />
              <span className="wc-sense-gloss">{sense.gloss}</span>
            </div>
            <div className="wc-stats">
              <span className="wc-sense-count">{sense.count} 次</span>
              <span className="wc-bar" aria-hidden="true">
                <span className="wc-bar-fill" style={{ width: `${sense.percentage}%` }} />
              </span>
              <span className="wc-sense-pct">{sense.percentage}%</span>
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
      ))}
    </div>
  );
}
