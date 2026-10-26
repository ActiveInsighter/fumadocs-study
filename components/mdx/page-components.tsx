import type { MDXComponents } from 'mdx/types';

/** Components registered only for specific documentation pages. */
const pageComponentRegistry: Record<string, MDXComponents> = {};

export function getPageMDXComponents(path: string): MDXComponents | undefined {
  return pageComponentRegistry[path.replaceAll('\\', '/')];
}
