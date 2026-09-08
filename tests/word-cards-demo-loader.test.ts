import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('word cards MDX data loader', () => {
  it('loads demo data through a native ESM-compatible adapter', async () => {
    const mdx = await readFile(
      new URL('../content/docs/english/word-cards-demo.mdx', import.meta.url),
      'utf8',
    );
    const adapterUrl = new URL('../data/vocabulary/word-cards-demo.mjs', import.meta.url);
    const { default: words } = await import(adapterUrl.href);

    expect(mdx).toContain(
      "import demoWords from '../../../data/vocabulary/word-cards-demo.mjs';",
    );
    expect(words).toHaveLength(8);
    expect(words[0]?.word).toBe('constitute');
    expect(words.at(-1)?.word).toBe('in terms of');
  });
});
