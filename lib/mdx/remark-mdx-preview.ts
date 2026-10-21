import type { Code, Root, RootContent } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import { mdxjs } from 'micromark-extension-mdxjs';
import type { Transformer } from 'unified';
import { visit } from 'unist-util-visit';

export interface RemarkMdxPreviewOptions {
  /** Fence language that can carry the `preview` meta flag. */
  lang?: string;
  /** Component that receives `[canvas, code]` children. */
  component?: string;
}

/**
 * Live examples written once.
 *
 * A fence such as
 *
 *     ```mdx preview title="分组柱状图"
 *     <StudyBarChart … />
 *     ```
 *
 * becomes `<MdxPreview title="…"><MdxPreviewCanvas>{parsed MDX}</MdxPreviewCanvas>
 * ```mdx …```</MdxPreview>`, so the rendered example and the source a reader
 * copies are guaranteed to be the same text. The code node is left in place
 * for the regular Shiki pipeline to highlight. Fences without the `preview`
 * flag are untouched.
 */
export function remarkMdxPreview(options: RemarkMdxPreviewOptions = {}): Transformer<Root, Root> {
  const { lang = 'mdx', component = 'MdxPreview' } = options;

  return (tree) => {
    visit(tree, 'code', (node: Code, index, parent) => {
      if (node.lang !== lang || typeof index !== 'number' || !parent) return;
      const meta = parsePreviewMeta(node.meta);
      if (!meta) return;

      const parsed = fromMarkdown(node.value, {
        extensions: [mdxjs()],
        mdastExtensions: [mdxFromMarkdown()],
      });

      const code: Code = { type: 'code', lang, meta: meta.rest || null, value: node.value };
      const attributes = meta.title
        ? [{ type: 'mdxJsxAttribute' as const, name: 'title', value: meta.title }]
        : [];

      parent.children[index] = {
        type: 'mdxJsxFlowElement',
        name: component,
        attributes,
        children: [
          {
            type: 'mdxJsxFlowElement',
            name: `${component}Canvas`,
            attributes: [],
            children: parsed.children as never,
          },
          code,
        ],
      } as RootContent;
    });
  };
}

/** Returns null unless the meta string contains the standalone `preview` flag. */
export function parsePreviewMeta(meta: string | null | undefined): { title?: string; rest: string } | null {
  if (!meta) return null;
  const tokens: string[] = meta.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  if (!tokens.includes('preview')) return null;

  let title: string | undefined;
  const rest: string[] = [];
  for (const token of tokens) {
    if (token === 'preview') continue;
    const match = /^title="(.*)"$/.exec(token);
    if (match) {
      title = match[1];
      continue;
    }
    rest.push(token);
  }
  return { title, rest: rest.join(' ') };
}
