import { describe, expect, it, vi } from 'vitest';

const pages = [
  { url: '/docs/408', path: '408/index.md', data: { title: '408 总览', description: '408 导航。' } },
  { url: '/docs/408/computer-organization', path: '408/computer-organization/index.md', data: { title: '计算机组成原理' } },
  { url: '/docs/408/computer-organization/01-overview', path: '408/computer-organization/01-overview.md', data: { title: '第一章 概述' } },
  { url: '/docs/math', path: 'math/index.md', data: { title: '数学总览' } },
];
const page = (url: string) => ({ type: 'page', url, name: url });

vi.mock('@/lib/source', () => ({
  source: {
    getPages: () => pages,
    getPageTree: () => ({
      name: 'docs',
      children: [
        {
          type: 'folder',
          root: true,
          name: '408',
          $ref: { folder: '408' },
          index: page('/docs/408'),
          children: [
            {
              type: 'folder',
              name: '计算机组成原理',
              $ref: { folder: '408/computer-organization' },
              index: page('/docs/408/computer-organization'),
              children: [page('/docs/408/computer-organization/01-overview')],
            },
          ],
        },
        {
          type: 'folder',
          root: true,
          name: '数学',
          $ref: { folder: 'math' },
          index: page('/docs/math'),
          children: [],
        },
      ],
    }),
  },
}));

const { buildLLMIndex } = await import('@/lib/llms-index');

describe('LLM documentation index', () => {
  it('lists the documentation tree with absolute browser and static Markdown links', () => {
    const index = buildLLMIndex('https://fumadocs.any1.tech');

    expect(index).toContain('# Study 文档目录');
    expect(index).toContain('## 408');
    expect(index).toContain('### 计算机组成原理');
    expect(index).toContain('## 数学');
    expect(index).toContain('不要依赖搜索引擎重新检索站点');

    for (const { url } of pages) {
      expect(index).toContain(`](https://fumadocs.any1.tech${url}/)`);
      expect(index).toContain(`[Markdown](https://fumadocs.any1.tech${url}.md)`);
    }

    expect(index).not.toContain('](/docs/');
    expect(index).not.toContain('/llms.mdx/');
    expect(index).toContain(`共 ${pages.length} 篇文档。`);
  });
});
