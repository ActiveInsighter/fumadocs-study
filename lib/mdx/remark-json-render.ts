import type { Root } from 'mdast';
import type { Transformer } from 'unified';
import { visit } from 'unist-util-visit';

/** Preserve the original fence for Markdown export, render it as a server component in MDX. */
export function remarkJsonRender(): Transformer<Root, Root> {
  return (tree) => {
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang !== 'json-render' || index === undefined || !parent) return;
      parent.children[index] = {
        type: 'mdxJsxFlowElement',
        name: 'SmartUI',
        attributes: [{ type: 'mdxJsxAttribute', name: 'code', value: node.value }],
        children: [],
      };
    });
  };
}
