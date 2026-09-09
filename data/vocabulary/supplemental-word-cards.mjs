import { createRequire } from 'node:module';
import { createCardModules } from './card-modules.mjs';

const require = createRequire(import.meta.url);

export const supplementalWords = require('./supplemental-source/other-frequency.json');

const supplementalRanges = [
  {
    slug: 'module-01',
    title: '01 · 补充高频',
    start: 0,
    end: 140,
  },
  {
    slug: 'module-02',
    title: '02 · 补充核心',
    start: 140,
    end: 280,
  },
  {
    slug: 'module-03',
    title: '03 · 补充扩展',
    start: 280,
    end: 410,
  },
];

export const supplementalWordModules = createCardModules(supplementalWords, supplementalRanges);
