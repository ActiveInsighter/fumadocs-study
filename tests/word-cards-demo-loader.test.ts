import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { WordCardData } from '../components/vocabulary/word-cards';

describe('word cards MDX data loader', () => {
  it('loads demo data through a native ESM-compatible adapter', async () => {
    const mdx = await readFile(
      new URL('../content/docs/english/word-cards-demo.mdx', import.meta.url),
      'utf8',
    );
    const adapterUrl = new URL('../data/vocabulary/word-cards-demo.mjs', import.meta.url);
    const { default: words } = (await import(adapterUrl.href)) as {
      default: WordCardData[];
    };

    expect(mdx).toContain(
      "import demoWords from '../../../data/vocabulary/word-cards-demo.mjs';",
    );
    expect(words).toHaveLength(8);
    expect(words[0]?.word).toBe('constitute');
    expect(words.at(-1)?.word).toBe('in terms of');

    const firstExample = words[0]?.senses?.[0]?.examples?.[0];
    expect(firstExample).toEqual({
      text: 'Women constitute about half of the workforce.',
      translation: '女性约占劳动力的一半。',
    });

    expect(
      words
        .flatMap((word) => word.senses ?? [])
        .flatMap((sense) => sense.examples ?? [])
        .every(
          (example) =>
            typeof example === 'object' &&
            typeof example.text === 'string' &&
            example.text.length > 0 &&
            typeof example.translation === 'string' &&
            example.translation.length > 0,
        ),
    ).toBe(true);
  });
});
