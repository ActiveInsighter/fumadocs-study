import { describe, expect, it } from 'vitest';
import {
  supplementalWordModules,
  supplementalWords,
} from '../data/vocabulary/supplemental-word-cards.mjs';
import { phraseModules, phraseWords } from '../data/vocabulary/phrase-cards.mjs';

describe('additional vocabulary loaders', () => {
  it('loads the 410 additional word cards without changing their source order', () => {
    expect(supplementalWords).toHaveLength(410);
    expect(supplementalWords[0]).toMatchObject({
      word: 'emotional',
      phonetic: '/ɪˈməʊʃənəl/',
      label: '重要性 40',
    });
    expect(supplementalWords.at(-1)?.word).toBe('unlimited');
    expect(new Set(supplementalWords.map((word) => word.word)).size).toBe(410);
    expect(supplementalWords.every((word) => word.meanings.length > 0)).toBe(true);
  });

  it('splits additional word cards into three navigable modules', () => {
    expect(supplementalWordModules.map((module) => module.slug)).toEqual([
      'module-01',
      'module-02',
      'module-03',
    ]);
    expect(supplementalWordModules.map((module) => module.count)).toEqual([140, 140, 130]);
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

  it('loads the 680 phrase cards with phrase semantics intact', () => {
    expect(phraseWords).toHaveLength(680);
    expect(phraseWords[0]).toMatchObject({ word: 'such as', label: '重要性 120' });
    expect(phraseWords[0].meanings[0]).toMatchObject({ phrase: true, key: true });
    expect(phraseWords.at(-1)?.word).toBe('as a result of');
    expect(new Set(phraseWords.map((word) => word.word)).size).toBe(680);
    expect(phraseWords.every((word) => word.meanings.some((meaning) => meaning.phrase))).toBe(true);
  });

  it('splits phrase cards into four navigable modules', () => {
    expect(phraseModules.map((module) => module.slug)).toEqual([
      'module-01',
      'module-02',
      'module-03',
      'module-04',
    ]);
    expect(phraseModules.map((module) => module.count)).toEqual([170, 170, 170, 170]);
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
