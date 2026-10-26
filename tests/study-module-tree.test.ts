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
  const politicsMeta = readJson(join(docsRoot, 'politics', 'meta.json'));
  const englishMeta = readJson(join(docsRoot, 'english', 'meta.json'));
  const englishVocabularyMeta = readJson(
    join(docsRoot, 'english', 'vocabulary', 'meta.json'),
  );
  const englishSupplementMeta = readJson(
    join(docsRoot, 'english', 'supplement-vocabulary', 'meta.json'),
  );
  const englishPhraseMeta = readJson(join(docsRoot, 'english', 'phrases', 'meta.json'));
  const coursesMeta = readJson(join(docsRoot, '408', 'meta.json'));
  const coursesSummaryMeta = readJson(join(docsRoot, '408', 'knowledge2', 'meta.json'));
  const coursesComputerOrganizationMeta = readJson(
    join(docsRoot, '408', 'knowledge2', 'computer-organization', 'meta.json'),
  );
  const coursesDataStructureMeta = readJson(
    join(docsRoot, '408', 'knowledge2', 'data-structure', 'meta.json'),
  );
  const coursesOperatingSystemMeta = readJson(
    join(docsRoot, '408', 'knowledge2', 'operating_system', 'meta.json'),
  );
  const coursesComputerNetworkMeta = readJson(
    join(docsRoot, '408', 'knowledge2', 'computer_network', 'meta.json'),
  );
  const coursesExamMeta = readJson(join(docsRoot, '408', 'exam', 'meta.json'));

  it('exposes exactly five physical and sidebar root modules', () => {
    expect(rootMeta.pages).toEqual(['politics', 'english', 'math', '408', 'algorithm']);

    const rootDirectories = readdirSync(docsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(rootDirectories).toEqual(['408', 'algorithm', 'english', 'math', 'politics'].sort());
  });

  it('keeps the active math study collections in order', () => {
    expect(mathMeta.root).toBe(true);
    expect(mathMeta.pages).toEqual([
      'index',
      'formulas',
      'mind-maps',
      'visualizations',
      '题目分析',
      '解题方法',
    ]);
  });

  it('exposes the four complete 408 courses at the module root', () => {
    expect(coursesMeta.root).toBe(true);
    expect(coursesMeta.pages).toEqual([
      'index',
      'knowledge2',
      'question-summary',
      'exam',
    ]);
    expect(coursesSummaryMeta.pages).toEqual([
      'index',
      'data-structure',
      'computer-organization',
      'operating_system',
      'computer_network',
    ]);
    expect(coursesComputerOrganizationMeta.pages).toEqual([
      'index',
      '01-computer-system-overview',
      '02-data-representation',
      '03-storage-system',
      '04-instruction-system',
      '05-cpu',
      '06-bus-io',
    ]);
    expect(coursesDataStructureMeta.pages).toEqual([
      'index',
      '01-introduction',
      '02-linear-list',
      '03-stack-queue-array',
      '04-string',
      '05-tree',
      '06-graph',
      '07-search',
      '08-sort',
    ]);
    expect(coursesOperatingSystemMeta.pages).toEqual([
      'index',
      '01-computer-system-overview',
      '02-process-management',
      '03-memory-management',
      '04-file-management',
      '05-io-management',
    ]);
    expect(coursesComputerNetworkMeta.pages).toEqual([
      'index',
      '01-network-architecture',
      '02-physical-layer',
      '03-data-link-layer',
      '04-network-layer',
      '05-transport-layer',
      '06-application-layer',
    ]);
    expect(coursesExamMeta.pages).toEqual(['index']);
  });

  it('keeps politics special reviews and recitation collections in order', () => {
    expect(politicsMeta.pages).toEqual([
      'index',
      'special-review',
      'xiao-1000-notes',
      'beisong-shouce',
      '27肖帽子题背诵版',
    ]);
  });

  it('organizes English vocabulary as a dedicated eight-part study path', () => {
    expect(englishMeta.pages).toEqual([
      'index',
      'vocabulary',
      'supplement-vocabulary',
      'phrases',
      'kaoyan-methods',
      'kaoyan-changnanju',
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
