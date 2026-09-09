import { describe, expect, it } from 'vitest';

type SupplementalVocabulary = {
  supplementalWords: Array<{
    word: string;
    phonetic?: string;
    label?: string;
    meanings: Array<{ text: string }>;
  }>;
  supplementalWordModules: Array<{
    slug: string;
    count: number;
    firstWord: string;
    lastWord: string;
  }>;
};

type PhraseVocabulary = {
  phraseWords: Array<{
    word: string;
    label?: string;
    meanings: Array<{ phrase?: boolean; key?: boolean }>;
  }>;
  phraseModules: Array<{
    slug: string;
    count: number;
    firstWord: string;
    lastWord: string;
  }>;
};

async function loadSupplementalVocabulary() {
  return (await import(
    new URL('../data/vocabulary/supplemental-word-cards.mjs', import.meta.url)
      .href
  )) as SupplementalVocabulary;
}

async function loadPhraseVocabulary() {
  return (await import(
    new URL('../data/vocabulary/phrase-cards.mjs', import.meta.url).href
  )) as PhraseVocabulary;
}

describe('additional vocabulary loaders', () => {
  it('loads the 410 additional word cards without changing their source order', async () => {
    const { supplementalWords } = await loadSupplementalVocabulary();

    expect(supplementalWords).toHaveLength(410);
    expect(supplementalWords[0]).toMatchObject({
      word: 'emotional',
      phonetic: '/ɪˈməʊʃənəl/',
      label: '重要性 40',
    });
    expect(supplementalWords.at(-1)?.word).toBe('unlimited');
    expect(new Set(supplementalWords.map((word) => word.word)).size).toBe(410);
    expect(supplementalWords.every((word) => word.meanings.length > 0)).toBe(
      true,
    );
  });

  it('splits additional word cards into three navigable modules', async () => {
    const { supplementalWordModules } = await loadSupplementalVocabulary();

    expect(supplementalWordModules.map((module) => module.slug)).toEqual([
      'module-01',
      'module-02',
      'module-03',
    ]);
    expect(supplementalWordModules.map((module) => module.count)).toEqual([
      140, 140, 130,
    ]);
    expect(supplementalWordModules.map((module) => module.firstWord)).toEqual([
      'emotional',
      'virtually',
      'caffeine',
    ]);
    expect(supplementalWordModules.map((module) => module.lastWord)).toEqual([
      'vastly',
      'behavioural',
      'unlimited',
    ]);
  });

  it('loads the 680 phrase cards with phrase semantics intact', async () => {
    const { phraseWords } = await loadPhraseVocabulary();

    expect(phraseWords).toHaveLength(680);
    expect(phraseWords[0]).toMatchObject({ word: 'such as', label: '重要性 120' });
    expect(phraseWords[0].meanings[0]).toMatchObject({ phrase: true, key: true });
    expect(phraseWords.at(-1)?.word).toBe('as a result of');
    expect(new Set(phraseWords.map((word) => word.word)).size).toBe(680);
    expect(
      phraseWords.every((word) =>
        word.meanings.some((meaning) => meaning.phrase),
      ),
    ).toBe(true);
  });

  it('splits phrase cards into four navigable modules', async () => {
    const { phraseModules } = await loadPhraseVocabulary();

    expect(phraseModules.map((module) => module.slug)).toEqual([
      'module-01',
      'module-02',
      'module-03',
      'module-04',
    ]);
    expect(phraseModules.map((module) => module.count)).toEqual([
      170, 170, 170, 170,
    ]);
    expect(phraseModules.map((module) => module.firstWord)).toEqual([
      'such as',
      'vulnerable to',
      'filled with',
      'anticipation of',
    ]);
    expect(phraseModules.map((module) => module.lastWord)).toEqual([
      'move on',
      'in essence',
      'take pride in',
      'as a result of',
    ]);
  });
});
