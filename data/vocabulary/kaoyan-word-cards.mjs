import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// The exports are adjacent frequency bands from the same 1,779-word list.
// Keep their source order: it is the study order used by the vocabulary pages.
const sourceWords = [
  require('./kaoyan-source/01-core.json'),
  require('./kaoyan-source/02-advanced.json'),
  require('./kaoyan-source/03-expanded.json'),
  require('./kaoyan-source/04-foundation.json'),
];

export const kaoyanWords = sourceWords.flatMap((words) => words);

const moduleRanges = [
  {
    slug: 'module-01',
    title: '01 · 极高频起步',
    start: 0,
    end: 225,
  },
  {
    slug: 'module-02',
    title: '02 · 核心高频',
    start: 225,
    end: 450,
  },
  {
    slug: 'module-03',
    title: '03 · 高频阅读',
    start: 450,
    end: 675,
  },
  {
    slug: 'module-04',
    title: '04 · 高频巩固',
    start: 675,
    end: 900,
  },
  {
    slug: 'module-05',
    title: '05 · 中频核心',
    start: 900,
    end: 1125,
  },
  {
    slug: 'module-06',
    title: '06 · 中频扩展',
    start: 1125,
    end: 1350,
  },
  {
    slug: 'module-07',
    title: '07 · 低频补强',
    start: 1350,
    end: 1575,
  },
  {
    slug: 'module-08',
    title: '08 · 低频收束',
    start: 1575,
    end: 1779,
  },
];

function getImportance(word) {
  const value = String(word?.label ?? '').match(/[0-9]+/u)?.[0];
  return value ? Number(value) : null;
}

export const kaoyanWordModules = moduleRanges.map((range) => {
  const first = kaoyanWords[range.start];
  const last = kaoyanWords[range.end - 1];
  const firstImportance = getImportance(first);
  const lastImportance = getImportance(last);

  return {
    ...range,
    count: range.end - range.start,
    firstWord: first.word,
    lastWord: last.word,
    importanceRange:
      firstImportance === lastImportance
        ? `重要性 ${firstImportance}`
        : `重要性 ${firstImportance} → ${lastImportance}`,
    description: `第 ${range.start + 1}–${range.end} 张 · ${
      firstImportance === lastImportance
        ? `重要性 ${firstImportance}`
        : `重要性 ${firstImportance}–${lastImportance}`
    }`,
  };
});

