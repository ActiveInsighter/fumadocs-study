import { Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';

/*
 * Reading MDX children without rendering them.
 *
 * MDX parses a component written on one line with its content,
 * `<CardStep title="…">一句话</CardStep>`, as inline text, so consecutive
 * one-liners arrive wrapped in a single <p>. A list component unwraps those
 * paragraphs to get at its items; otherwise the items would render inside a
 * <p> (invalid HTML, a hydration error) as one grid cell.
 */

type AnyProps = Record<string, unknown>;

export function propsOf(node: ReactElement): AnyProps {
  return (node.props ?? {}) as AnyProps;
}

/** Elements at the top of a node, fragments opened; text is dropped. */
export function topLevelElements(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(topLevelElements);
  if (!isValidElement(node)) return [];
  if (node.type === Fragment) return topLevelElements(propsOf(node).children as ReactNode);
  return [node];
}

/** Whether a node holds text of its own, outside any element. */
function hasLooseText(node: ReactNode): boolean {
  if (Array.isArray(node)) return node.some(hasLooseText);
  if (typeof node === 'string') return node.trim().length > 0;
  return typeof node === 'number' || typeof node === 'bigint';
}

/**
 * Top-level elements, with each paragraph that holds nothing but items
 * (and whitespace) replaced by those items.
 */
export function topLevelItems(node: ReactNode, isItem: (element: ReactElement) => boolean): ReactElement[] {
  return topLevelElements(node).flatMap((element) => {
    if (element.type !== 'p') return [element];
    const children = propsOf(element).children as ReactNode;
    const inner = topLevelElements(children);
    return inner.length > 0 && inner.every(isItem) && !hasLooseText(children) ? inner : [element];
  });
}
