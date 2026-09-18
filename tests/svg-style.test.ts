import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const imagesRoot = join(process.cwd(), 'public', 'images');

function getSvgFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return getSvgFiles(path);
    return entry.isFile() && entry.name.endsWith('.svg') ? [path] : [];
  });
}

describe('SVG visual style', () => {
  it('uses flat colors instead of SVG gradients', () => {
    const offenders = getSvgFiles(imagesRoot)
      .filter((path) => /<(?:linearGradient|radialGradient)\b/iu.test(readFileSync(path, 'utf8')))
      .map((path) => path.replace(process.cwd(), ''));

    expect(offenders).toEqual([]);
  });
});
