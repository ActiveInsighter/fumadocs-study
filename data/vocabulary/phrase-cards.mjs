import { createRequire } from 'node:module';
import { createCardModules } from './card-modules.mjs';

const require = createRequire(import.meta.url);

export const phraseWords = require('./phrase-source/kaoyan-phrases.json');

const phraseRanges = [
  {
    slug: 'module-01',
    title: '01 · 核心短语',
    start: 0,
    end: 170,
  },
  {
    slug: 'module-02',
    title: '02 · 高频搭配',
    start: 170,
    end: 340,
  },
  {
    slug: 'module-03',
    title: '03 · 阅读短语',
    start: 340,
    end: 510,
  },
  {
    slug: 'module-04',
    title: '04 · 补充短语',
    start: 510,
    end: 680,
  },
];

export const phraseModules = createCardModules(phraseWords, phraseRanges);
