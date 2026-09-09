import { describe, expect, it } from 'vitest';

type LoadedVocabulary = {
  kaoyanWords: Array<{
    word: string;
    phonetic?: string;
    label?: string;
    meanings: Array<{ text: string }>;
    senses?: Array<{
      gloss: string;
      count: number;
      examples?: Array<{ text: string; translation: string }>;
    }>;
  }>;
  kaoyanWordModules: Array<{
    slug: string;
    start: number;
    end: number;
    count: number;
    firstWord: string;
    lastWord: string;
  }>;
};

describe('考研英语词卡数据', () => {
  it('merges the four source exports into eight contiguous study modules', async () => {
    const { kaoyanWords, kaoyanWordModules } = (await import(
      new URL('../data/vocabulary/kaoyan-word-cards.mjs', import.meta.url).href
    )) as LoadedVocabulary;

    expect(kaoyanWords).toHaveLength(1779);
    expect(new Set(kaoyanWords.map((word) => word.word)).size).toBe(1779);
    expect(kaoyanWords[0]?.word).toBe('social');
    expect(kaoyanWords.at(-1)?.word).toBe('squeeze');

    expect(kaoyanWordModules).toHaveLength(8);
    expect(kaoyanWordModules.map((module) => module.count)).toEqual([
      225, 225, 225, 225, 225, 225, 225, 204,
    ]);
    expect(kaoyanWordModules[0]?.start).toBe(0);
    expect(kaoyanWordModules.at(-1)?.end).toBe(1779);

    for (const [index, module] of kaoyanWordModules.entries()) {
      expect(module.end - module.start).toBe(module.count);
      expect(module.firstWord).toBe(kaoyanWords[module.start]?.word);
      expect(module.lastWord).toBe(kaoyanWords[module.end - 1]?.word);
      expect(module.slug).toBe(`module-${String(index + 1).padStart(2, '0')}`);
      if (index > 0) {
        expect(module.start).toBe(kaoyanWordModules[index - 1]?.end);
      }
    }
  });

  it('keeps the card fields needed by the vocabulary renderer', async () => {
    const { kaoyanWords } = (await import(
      new URL('../data/vocabulary/kaoyan-word-cards.mjs', import.meta.url).href
    )) as LoadedVocabulary;

    expect(
      kaoyanWords.every(
        (word) =>
          word.word.length > 0 &&
          typeof word.phonetic === 'string' &&
          typeof word.label === 'string' &&
          word.meanings.length > 0 &&
          (word.senses ?? []).every(
            (sense) =>
              sense.gloss.length > 0 &&
              Number.isFinite(sense.count) &&
              (sense.examples ?? []).every(
                (example) => example.text.length > 0 && example.translation.length > 0,
              ),
          ),
      ),
    ).toBe(true);
  });
});
