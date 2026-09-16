import { buildLLMIndex } from '@/lib/llms-index';
import { toAbsoluteSiteUrl } from '@/lib/site-url';
import { source } from '@/lib/source';
import { describe, expect, it } from 'vitest';

describe('LLM documentation index', () => {
  it('lists the documentation tree with absolute browser and Markdown links', () => {
    const origin = 'https://docs.any1.tech';
    const index = buildLLMIndex(origin);
    const pages = source.getPages();

    expect(index).toContain('# Study 文档目录');
    expect(index).toContain('## 408');
    expect(index).toContain('#### 计算机组成原理');
    expect(index).toContain('## 数学');
    expect(index).toContain('## 英语');
    expect(index).toContain('## 政治');
    expect(index).toContain('不要依赖搜索引擎重新检索站点');

    for (const page of pages) {
      const browserUrl = toAbsoluteSiteUrl(page.url, origin);
      const markdownUrl = toAbsoluteSiteUrl(`/llms.mdx${page.url}`, origin);
      expect(index).toContain(`](${browserUrl})`);
      expect(index).toContain(`[Markdown](${markdownUrl})`);
    }

    expect(index).not.toContain('](/docs/');
    expect(index).toContain(`共 ${pages.length} 篇文档。`);
  });
});
