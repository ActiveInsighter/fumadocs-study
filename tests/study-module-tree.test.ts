import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docsRoot = join(process.cwd(), 'content', 'docs');

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

describe('study module metadata structure', () => {
  const rootMeta = readJson(join(docsRoot, 'meta.json'));
  const mathMeta = readJson(join(docsRoot, 'math', 'meta.json'));
  const mathKnowledgeMeta = readJson(join(docsRoot, 'math', 'knowledge', 'meta.json'));
  const mathSupplementsMeta = readJson(join(docsRoot, 'math', 'supplements', 'meta.json'));
  const mathProblemSolvingMeta = readJson(join(docsRoot, 'math', 'problem-solving', 'meta.json'));
  const mathExamMeta = readJson(join(docsRoot, 'math', 'exam', 'meta.json'));
  const politicsMeta = readJson(join(docsRoot, 'politics', 'meta.json'));
  const examPoliticsMeta = readJson(join(docsRoot, 'politics', 'exam-politics', 'meta.json'));
  const englishMeta = readJson(join(docsRoot, 'english', 'meta.json'));
  const englishVocabularyMeta = readJson(
    join(docsRoot, 'english', 'vocabulary', 'meta.json'),
  );
  const englishSupplementMeta = readJson(
    join(docsRoot, 'english', 'supplement-vocabulary', 'meta.json'),
  );
  const englishPhraseMeta = readJson(join(docsRoot, 'english', 'phrases', 'meta.json'));
  const coursesMeta = readJson(join(docsRoot, '408', 'meta.json'));
  const coursesKnowledgeMeta = readJson(join(docsRoot, '408', 'knowledge', 'meta.json'));
  const coursesProblemSolvingMeta = readJson(join(docsRoot, '408', 'problem-solving', 'meta.json'));
  const coursesExamMeta = readJson(join(docsRoot, '408', 'exam', 'meta.json'));

  it('exposes exactly four physical and sidebar root modules', () => {
    expect(rootMeta.pages).toEqual(['politics', 'english', 'math', '408']);

    const rootDirectories = readdirSync(docsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(rootDirectories).toEqual(['408', 'english', 'math', 'politics'].sort());
  });

  it('keeps math split into core knowledge, supplements, problem solving, and exams', () => {
    expect(mathMeta.root).toBe(true);
    expect(mathMeta.pages).toEqual(['index', 'knowledge', 'supplements', 'problem-solving', 'exam']);
    expect(mathKnowledgeMeta.pages).toEqual([
      'index',
      'advanced-mathematics',
      'linear-algebra',
      'probability-statistics',
    ]);
    expect(mathSupplementsMeta.pages).toEqual([
      'index',
      'advanced-mathematics',
      'linear-algebra',
      'probability-statistics',
    ]);
    expect(mathProblemSolvingMeta.pages).toEqual([
      'index',
      'advanced-mathematics',
      'linear-algebra',
      'probability-statistics',
    ]);
    expect(mathExamMeta.pages).toEqual(['index']);
  });

  it('uses the same three-way hierarchy for 408', () => {
    expect(coursesMeta.root).toBe(true);
    expect(coursesMeta.pages).toEqual(['index', 'knowledge', 'problem-solving', 'exam']);
    expect(coursesKnowledgeMeta.pages).toEqual([
      'index',
      'data-structures',
      'computer-organization',
      'operating-systems',
      'computer-networks',
    ]);
    expect(coursesProblemSolvingMeta.pages).toEqual([
      'index',
      'data-structures',
      'computer-organization',
      'operating-systems',
      'computer-networks',
    ]);
    expect(coursesExamMeta.pages).toEqual(['index']);
  });

  it('keeps the politics module unchanged', () => {
    expect(politicsMeta.pages).toEqual(['index', 'exam-politics']);
    expect(examPoliticsMeta.title).toBe('考研政治系统讲义');
  });

  it('organizes English vocabulary as a dedicated eight-part study path', () => {
    expect(englishMeta.pages).toEqual([
      'index',
      'vocabulary',
      'supplement-vocabulary',
      'phrases',
      'word-cards-demo',
    ]);
    expect(englishVocabularyMeta.pages).toEqual([
      'index',
      'module-01',
      'module-02',
      'module-03',
      'module-04',
      'module-05',
      'module-06',
      'module-07',
      'module-08',
    ]);
  });

  it('organizes additional English card sets into focused review paths', () => {
    expect(englishSupplementMeta.pages).toEqual([
      'index',
      'module-01',
      'module-02',
      'module-03',
    ]);
    expect(englishPhraseMeta.pages).toEqual([
      'index',
      'module-01',
      'module-02',
      'module-03',
      'module-04',
    ]);
  });

  it('keeps vocabulary overview cards inside the vocabulary route', () => {
    const vocabularyIndex = readFileSync(
      join(docsRoot, 'english', 'vocabulary', 'index.mdx'),
      'utf8',
    );

    expect(vocabularyIndex).toContain('href={`/docs/english/vocabulary/${module.slug}`}');
    expect(vocabularyIndex).not.toContain('href={`./${module.slug}`}');
  });

  it('keeps additional card overview links inside their own routes', () => {
    const supplementIndex = readFileSync(
      join(docsRoot, 'english', 'supplement-vocabulary', 'index.mdx'),
      'utf8',
    );
    const phraseIndex = readFileSync(join(docsRoot, 'english', 'phrases', 'index.mdx'), 'utf8');

    expect(supplementIndex).toContain(
      'href={`/docs/english/supplement-vocabulary/${module.slug}`}',
    );
    expect(phraseIndex).toContain('href={`/docs/english/phrases/${module.slug}`}');
    expect(supplementIndex).not.toContain('href={`./${module.slug}`}');
    expect(phraseIndex).not.toContain('href={`./${module.slug}`}');
  });
});
