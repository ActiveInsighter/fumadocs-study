import type { Root } from 'mdast';
import { describe, expect, it } from 'vitest';

import { parsePreviewMeta, remarkMdxPreview } from '../lib/mdx/remark-mdx-preview';

function transform(tree: Root) {
  remarkMdxPreview()(tree, undefined as never, undefined as never);
  return tree;
}

describe('remarkMdxPreview', () => {
  it('turns an mdx preview fence into a live canvas plus its source', () => {
    const source = '<StudyBarChart title="示例" data={[{ a: 1 }]} />';
    const tree = transform({
      type: 'root',
      children: [{ type: 'code', lang: 'mdx', meta: 'preview title="柱状图"', value: source }],
    });

    const node = tree.children[0] as unknown as {
      type: string;
      name: string;
      attributes: { name: string; value: string }[];
      children: [{ name: string; children: { type: string; name: string }[] }, { type: string; value: string }];
    };
    expect(node.type).toBe('mdxJsxFlowElement');
    expect(node.name).toBe('MdxPreview');
    expect(node.attributes).toEqual([{ type: 'mdxJsxAttribute', name: 'title', value: '柱状图' }]);
    expect(node.children[0].name).toBe('MdxPreviewCanvas');
    expect(node.children[0].children[0]).toMatchObject({ type: 'mdxJsxFlowElement', name: 'StudyBarChart' });
    expect(node.children[1]).toMatchObject({ type: 'code', value: source });
  });

  it('leaves ordinary mdx fences untouched', () => {
    const tree = transform({
      type: 'root',
      children: [{ type: 'code', lang: 'mdx', meta: 'title="x.mdx"', value: '<A />' }],
    });
    expect(tree.children[0]).toMatchObject({ type: 'code', value: '<A />' });
  });

  it('parses the preview flag strictly', () => {
    expect(parsePreviewMeta('preview')).toEqual({ title: undefined, rest: '' });
    expect(parsePreviewMeta('previewer')).toBeNull();
    expect(parsePreviewMeta(null)).toBeNull();
  });
});
