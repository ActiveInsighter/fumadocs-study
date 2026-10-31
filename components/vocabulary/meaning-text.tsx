import type { WordMeaning } from './model';

/** A part-of-speech chip; renders nothing for meanings without one. */
export function PosTag({ pos }: { pos?: string }) {
  return pos ? <span className="wc-pos">{pos}</span> : null;
}

/** One meaning's text: an optional English pattern, then the Chinese gloss. */
export function MeaningText({ meaning }: { meaning: WordMeaning }) {
  const textClass = `wc-text${meaning.key ? ' wc-key' : ''}${meaning.phrase ? ' wc-phrase' : ''}`;
  return (
    <>
      {meaning.grammar ? (
        <>
          <span className="wc-gram" lang="en">
            {meaning.grammar}
          </span>{' '}
        </>
      ) : null}
      <span className={textClass}>{meaning.text}</span>
    </>
  );
}
