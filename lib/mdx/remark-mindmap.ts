import type { Root } from 'mdast';
import type { Transformer } from 'unified';
import { visit } from 'unist-util-visit';

export interface RemarkMdxMindmapOptions {
  /** The fenced-code language that should become a mind map. */
  lang?: string;
}

function toMDX(code: string) {
  return {
    type: 'mdxJsxFlowElement' as const,
    name: 'MindMap',
    attributes: [
      {
        type: 'mdxJsxAttribute' as const,
        name: 'markdown',
        value: code.trim(),
      },
    ],
    children: [],
  };
}

/** Convert non-empty `mindmap` code fences into the shared MindMap component. */
export function remarkMdxMindmap(
  options: RemarkMdxMindmapOptions = {},
): Transformer<Root, Root> {
  const { lang = 'mindmap' } = options;

  return (tree) => {
    visit(tree, 'code', (node, index, parent) => {
      if (
        node.lang !== lang ||
        !node.value.trim() ||
        typeof index !== 'number' ||
        !parent
      ) {
        return;
      }

      parent.children[index] = toMDX(node.value);
    });
  };
}
