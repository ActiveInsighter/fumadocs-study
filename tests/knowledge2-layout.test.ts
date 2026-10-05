import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docsRoot = join(process.cwd(), 'content', 'docs');
const coursesRoot = join(docsRoot, '408');
const summaryRoot = join(coursesRoot, 'knowledge2');

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8')) as { pages?: string[] };
}

function findSingleFileLeafDirectories(root: string): string[] {
  const matches: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const directory = join(root, entry.name);
    const children = readdirSync(directory, { withFileTypes: true });
    const files = children.filter((child) => child.isFile());
    const directories = children.filter((child) => child.isDirectory());

    if (files.length === 1 && directories.length === 0) {
      matches.push(directory);
      continue;
    }

    matches.push(...findSingleFileLeafDirectories(directory));
  }

  return matches;
}

function getMarkdownFiles(root: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...getMarkdownFiles(path));
    } else if (entry.isFile() && /\.(?:md|mdx)$/u.test(entry.name)) {
      files.push(path);
    }
  }

  return files;
}

describe('408 knowledge2 documentation layout', () => {
  it('uses the ASCII knowledge2 route from the 408 module entry point', () => {
    const moduleMeta = readJson(join(coursesRoot, 'meta.json'));
    const moduleIndex = readFileSync(join(coursesRoot, 'index.md'), 'utf8');

    expect(moduleMeta.pages).toContain('knowledge2');
    expect(moduleMeta.pages).not.toContain('知识点总结2');
    expect(moduleIndex).toContain('(./knowledge2/)');
  });

  it('does not keep a leaf directory whose only file is its index page', () => {
    expect(findSingleFileLeafDirectories(summaryRoot)).toEqual([]);
    expect(
      existsSync(
        join(
          summaryRoot,
          'computer-organization',
          '05-cpu',
          '05-parallel-multicore.mdx',
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(join(summaryRoot, 'computer-organization', 'cpu', 'multicore.mdx')),
    ).toBe(false);
  });

  it('does not link to the retired Unicode summary route', () => {
    const staleLinks = getMarkdownFiles(summaryRoot).filter((path) =>
      readFileSync(path, 'utf8').includes('/docs/408/知识点总结2'),
    );

    expect(staleLinks).toEqual([]);
  });
});
