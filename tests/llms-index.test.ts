import { source } from '@/lib/source';
import { buildLLMIndex } from '@/lib/llms-index';
import { describe, expect, it } from 'vitest';

describe('LLM documentation index', () => {
  it('lists every documentation page with browser and Markdown links', () => {
    const index = buildLLMIndex();
    const pages = source.getPages();

    expect(index).toContain('# Study 文档目录');
    expect(index).toContain('## 408');
    expect(index).toContain('## 数学');
    expect(index).toContain('## 英语');
    expect(index).toContain('## 政治');

    for (const page of pages) {
      expect(index).toContain(`](${page.url})`);
      expect(index).toContain(`[Markdown](/llms.mdx${page.url})`);
    }

    expect(index).toContain(`共 ${pages.length} 篇文档。`);
  });
});
