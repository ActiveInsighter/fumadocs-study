/*
 * Vocabulary card data and the pure derivations shared by the card face
 * (word-card-content.tsx) and the detail modal (word-card-detail.tsx).
 * No React and no DOM here, so every rule is testable on its own.
 */

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

/** A sense with its count made non-negative and its share of the word resolved. */
export type SenseStat = WordSense & { percentage: number };

export type SenseSummary = {
  total: number;
  senses: readonly SenseStat[];
};

/** Number of palettes in styles/word-cards.css (`data-tone="1"` … `"7"`). */
const TONE_COUNT = 7;

export function getTone(index: number) {
  return (index % TONE_COUNT) + 1;
}

export function hasPhraseMeaning(word: WordCardData) {
  return word.meanings.some((meaning) => meaning.phrase);
}

export function cardLabel(word: WordCardData) {
  return word.label?.trim() || null;
}

function clampPercentage(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** An explicit percentage wins; otherwise the sense's share of all occurrences. */
export function getSensePercentage(sense: WordSense, total: number) {
  if (sense.percentage !== undefined) return clampPercentage(sense.percentage);
  if (total <= 0) return 0;
  return clampPercentage((Math.max(0, sense.count) / total) * 100);
}

const EMPTY_SUMMARY: SenseSummary = { total: 0, senses: [] };

/** Resolves counts and shares once, so views never re-derive them per row. */
export function summarizeSenses(senses: readonly WordSense[] | undefined): SenseSummary {
  if (!senses?.length) return EMPTY_SUMMARY;
  const total = senses.reduce((sum, sense) => sum + Math.max(0, sense.count), 0);
  return {
    total,
    senses: senses.map((sense) => ({
      ...sense,
      count: Math.max(0, sense.count),
      percentage: getSensePercentage(sense, total),
    })),
  };
}

/** Sense colours in the detail modal: the card's bar colour, each later sense lighter. */
export function senseColor(order: number) {
  return `color-mix(in oklab, var(--bar-fill) ${Math.max(30, 100 - order * 22)}%, var(--card-bg))`;
}

/** Two-digit sense numbers: 01, 02, … */
export function formatOrder(order: number) {
  return String(order + 1).padStart(2, '0');
}
