import {
  parseFrontmatterTitle,
  renderStaticMarkdown,
  splitFrontmatter,
} from '../lib/markdown-export.mjs';
export {
  parseFrontmatterTitle,
  renderStaticMarkdown,
  splitFrontmatter,
  stripMdxRuntimeSyntax,
} from '../lib/markdown-export.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Static markdown generation for the CDN documentation package.
 *
 * Replaces the dynamic `app/llms.mdx/docs/[[...slug]]` route handler during
 * static export: source files under `content/docs` are converted directly
 * into plain markdown documents published next to the HTML pages.
 */

function normalizeSourcePath(relativePath) {
  return relativePath.replaceAll('\\', '/');
}

function stripExtension(relativePath) {
  return relativePath.replace(/\.(md|mdx)$/i, '');
}

function collapseIndexSegment(relativePath) {
  return relativePath.replace(/(^|\/)index$/i, '');
}

/**
 * Map a source path (relative to `content/docs`) to the page URL
 * following Fumadocs conventions (`index` files collapse to the folder).
 */
export function getStaticDocsPageUrl(relativePath) {
  const slug = collapseIndexSegment(stripExtension(normalizeSourcePath(relativePath)));

  return `/docs${slug ? `/${slug}` : ''}`;
}

/**
 * Map a source path (relative to `content/docs`) to the static markdown
 * output path (relative to the export root), e.g. `math/index.mdx` ->
 * `docs/math.md`.
 */
export function getStaticMarkdownOutputPath(relativePath) {
  const slug = collapseIndexSegment(stripExtension(normalizeSourcePath(relativePath)));

  return `docs${slug ? `/${slug}` : ''}.md`;
}

/**
 * Read a source document and produce both its static output path and its
 * rendered markdown content.
 */
export async function buildStaticMarkdownDocument(sourcePath, relativePath) {
  const content = await readFile(sourcePath, 'utf8');
  const { frontmatter } = splitFrontmatter(content);
  const slug = collapseIndexSegment(stripExtension(normalizeSourcePath(relativePath)));
  const fallbackTitle = slug.split('/').pop() || 'Untitled';
  const title = parseFrontmatterTitle(frontmatter) ?? fallbackTitle;

  return {
    outputPath: getStaticMarkdownOutputPath(relativePath),
    markdown: await renderStaticMarkdown(content, {
      title,
      url: getStaticDocsPageUrl(relativePath),
    }),
  };
}

export function isStaticDocSourceFile(filePath) {
  return /\.(md|mdx)$/i.test(path.basename(filePath));
}
