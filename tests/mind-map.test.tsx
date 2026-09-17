import type { Root } from 'mdast';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MindMap } from '../components/mdx/mind-map';
import { remarkMdxMindmap } from '../lib/mdx/remark-mindmap';

function transform(tree: Root) {
  remarkMdxMindmap()(tree, undefined as never, undefined as never);
  return tree;
}

describe('remarkMdxMindmap', () => {
  it('converts mindmap code fences into MindMap MDX components', () => {
    const tree = transform({
      type: 'root',
      children: [
        {
          type: 'code',
          lang: 'mindmap',
          value: '\n# 计算机系统\n\n## 硬件\n- CPU\n',
        },
      ],
    } as Root);

    expect(tree.children[0]).toEqual({
      type: 'mdxJsxFlowElement',
      name: 'MindMap',
      attributes: [
        {
          type: 'mdxJsxAttribute',
          name: 'markdown',
          value: '# 计算机系统\n\n## 硬件\n- CPU',
        },
      ],
      children: [],
    });
  });

  it('only transforms non-empty mindmap fences and leaves other code alone', () => {
    const normalCode = {
      type: 'code' as const,
      lang: 'tsx',
      value: '<MindMap />',
    };
    const emptyMindmap = {
      type: 'code' as const,
      lang: 'mindmap',
      value: '   ',
    };
    const tree = transform({
      type: 'root',
      children: [normalCode, emptyMindmap],
    } as Root);

    expect(tree.children[0]).toBe(normalCode);
    expect(tree.children[1]).toBe(emptyMindmap);
  });
});

describe('MindMap', () => {
  it('renders a labelled, interactive shell while the browser renderer loads', () => {
    const html = renderToStaticMarkup(
      <MindMap markdown="# 计算机系统" title="计算机系统知识结构" />,
    );

    expect(html).toContain('data-mind-map="true"');
    expect(html).toContain('aria-label="计算机系统知识结构"');
    expect(html).toContain('适应窗口');
    expect(html).toContain('全屏查看');
    expect(html).toContain('滚轮缩放');
    expect(html).toContain('正在生成思维导图');
  });

  it('renders a useful empty state for direct component usage', () => {
    const html = renderToStaticMarkup(<MindMap markdown="  " />);

    expect(html).toContain('data-status="error"');
    expect(html).toContain('思维导图内容为空');
  });
});
