import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const docsRoot = join(process.cwd(), 'content/docs');
const summaryRoot = join(docsRoot, '408/knowledge2');
const courses = ['data-structure', 'computer-organization', 'operating_system', 'computer_network'];

function markdownFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = join(root, entry.name);
    return entry.isDirectory() ? markdownFiles(file) : /\.mdx?$/.test(entry.name) ? [file] : [];
  });
}

function pageUrl(file: string): string {
  const slug = relative(docsRoot, file).replaceAll('\\', '/').replace(/\.mdx?$/, '').replace(/\/index$/, '');
  return `/docs/${slug}/`;
}

function localLinks(file: string): string[] {
  const base = new URL(pageUrl(file), 'https://study.test');
  return [...readFileSync(file, 'utf8').matchAll(/\[[^\]\n]+\]\(([^)\s]+)\)/g)]
    .map((match) => new URL(match[1], base))
    .filter((url) => url.origin === base.origin && url.pathname.startsWith('/docs/'))
    .map((url) => decodeURIComponent(url.pathname).replace(/\/$/, ''));
}

describe('408 knowledge2 navigation', () => {
  it('resolves every local Markdown link to an actual document, including course directories', () => {
    const missing = markdownFiles(summaryRoot).flatMap((file) => localLinks(file)
      .filter((url) => {
        const target = join(docsRoot, url.slice('/docs/'.length));
        return !['.mdx', '.md', '/index.mdx', '/index.md'].some((suffix) => existsSync(target + suffix));
      })
      .map((url) => `${relative(summaryRoot, file)} -> ${url}`));
    expect(missing).toEqual([]);
  });

  it.each(courses)('%s has an overview linking to every lecture', (course) => {
    const root = join(summaryRoot, course);
    const overview = join(root, 'index.mdx');
    expect(existsSync(overview), `${course} overview is missing`).toBe(true);
    const meta = JSON.parse(readFileSync(join(root, 'meta.json'), 'utf8')) as { pages: string[] };
    expect(meta.pages[0]).toBe('index');
    const lectures = markdownFiles(root).filter((file) => file !== overview);
    const links = localLinks(overview).filter((url) => url.startsWith(pageUrl(overview)));
    expect(links).toHaveLength(lectures.length);
    expect([...links].sort()).toEqual(lectures.map((file) => pageUrl(file).replace(/\/$/, '')).sort());
  });

  it('identifies the current imported release on the summary page', () => {
    const source = readFileSync(join(summaryRoot, 'index.mdx'), 'utf8');
    expect(source).toContain('2026-10-07');
    expect(source).toContain('1007');
  });
});
