'use client';

import {
  createContext,
  useContext,
  useId,
  useState,
  type ReactNode,
} from 'react';

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

export type WordCardMode = 'compact' | 'full';

type WordCardsProps = {
  words: readonly WordCardData[];
  empty?: ReactNode;
};

type WordCardsProviderProps = {
  children: ReactNode;
  defaultMode?: WordCardMode;
};

type WordCardsContextValue = {
  mode: WordCardMode;
  setMode: (mode: WordCardMode) => void;
};

const WordCardsContext = createContext<WordCardsContextValue | null>(null);

function clampPercentage(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function getSensePercentage(sense: WordSense, total: number) {
  if (sense.percentage !== undefined) return clampPercentage(sense.percentage);
  if (total <= 0) return 0;
  return clampPercentage((sense.count / total) * 100);
}

function getWordLabel(word: WordCardData) {
  const label = word.label?.trim();
  return label || null;
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

function SenseExample({ example }: { example: WordExample }) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  return (
    <span className="wc-example" data-open={open}>
      <button
        type="button"
        className="wc-example-trigger"
        aria-describedby={tooltipId}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
      >
        {example.text}
      </button>
      <span className="wc-example-tooltip" id={tooltipId} role="tooltip">
        {example.translation}
      </span>
    </span>
  );
}

export function WordCardsProvider({
  children,
  defaultMode = 'full',
}: WordCardsProviderProps) {
  const [mode, setMode] = useState<WordCardMode>(defaultMode);

  return (
    <WordCardsContext.Provider value={{ mode, setMode }}>
      {children}
    </WordCardsContext.Provider>
  );
}

export function WordCardModeToggle() {
  const context = useContext(WordCardsContext);
  if (!context) return null;

  return (
    <div className="wc-mode-toggle" aria-label="词汇卡片显示模式">
      <span className="wc-mode-label">显示模式</span>
      <div className="wc-mode-segments" role="group" aria-label="切换词汇卡片显示模式">
        {(
          [
            ['compact', '精简'],
            ['full', '完整'],
          ] as const
        ).map(([mode, label]) => {
          const active = context.mode === mode;

          return (
            <button
              key={mode}
              type="button"
              className="wc-mode-button"
              data-active={active}
              aria-pressed={active}
              onClick={() => context.setMode(mode)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WordCards({ words, empty = null }: WordCardsProps) {
  const context = useContext(WordCardsContext);
  const mode = context?.mode ?? 'full';

  if (words.length === 0) return empty;

  return (
    <div className="word-list-shell">
      <div className="word-list" data-word-card-mode={mode}>
        {words.map((word, wordIndex) => {
          const label = getWordLabel(word);
          const senseTotal =
            word.senses?.reduce((sum, sense) => sum + Math.max(0, sense.count), 0) ?? 0;

          return (
            <article className="word-card" key={`${word.word}-${wordIndex}`} data-word={word.word}>
              <div className="wc-header">
                <div className="wc-title">
                  <span className="wc-word">{word.word}</span>
                  {word.phonetic ? <span className="wc-phonetic">{word.phonetic}</span> : null}
                </div>

                {label ? <span className="wc-label">{label}</span> : null}
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

              {mode === 'full' && word.senses?.length ? (
                <div className="wc-senses">
                  {word.senses.map((sense, senseIndex) => (
                    <div className="wc-sense" key={`${sense.gloss}-${senseIndex}`}>
                      <div className="wc-sense-row">
                        <span className="wc-sense-dot" aria-hidden="true" />
                        <span className="wc-sense-gloss">
                          {sense.gloss}
                          <span className="wc-sense-count">{Math.max(0, sense.count)} 次</span>
                        </span>
                        <span className="wc-sense-pct">
                          {getSensePercentage(sense, senseTotal)}%
                        </span>
                      </div>

                      {sense.examples?.length ? (
                        <div className="wc-sense-examples">
                          {sense.examples.map((example, exampleIndex) => (
                            <SenseExample
                              key={`${example.text}-${exampleIndex}`}
                              example={example}
                            />
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
    </div>
  );
}
