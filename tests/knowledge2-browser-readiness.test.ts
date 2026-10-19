import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { verifyKnowledge2Document } = createRequire(import.meta.url)('../scripts/verify-knowledge2-navigation.cjs');

const href = '/docs/408/knowledge2/data-structure/';
const title = '数据结构';

function browser({ path = href, heading = title, content = '课程目录与讲义链接', visible = true, text = content } = {}) {
  vi.stubGlobal('location', { pathname: path });
  vi.stubGlobal('document', {
    body: { innerText: text },
    querySelector: (selector: string) => selector === 'article h1'
      ? { textContent: heading }
      : { innerText: content, getClientRects: () => visible ? [{}] : [] },
  });
  return {
    waitForFunction: vi.fn(async (predicate: (...args: string[]) => boolean, _options: unknown, ...args: string[]) => {
      if (!predicate(...args)) throw new Error('Document has not committed');
    }),
    evaluate: vi.fn(async () => text),
    waitForNetworkIdle: vi.fn(async () => { throw new Error('Background prefetch is still pending'); }),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('Knowledge2 browser readiness', () => {
  it('accepts the visible target document while background prefetches remain pending', async () => {
    const page = browser();
    await expect(verifyKnowledge2Document(page, href, title)).resolves.toBeUndefined();
    expect(page.waitForNetworkIdle).not.toHaveBeenCalled();
  });

  it.each([
    ['the previous route', { path: '/docs/408/knowledge2/' }],
    ['a stale document heading', { heading: '408 知识点总结 2（优化版）' }],
    ['an empty document body', { content: '' }],
    ['a hidden document body', { visible: false }],
  ])('does not accept %s', async (_label, state) => {
    await expect(verifyKnowledge2Document(browser(state), href, title)).rejects.toThrow('Document has not committed');
  });

  it('reports a visible 404 immediately', async () => {
    await expect(verifyKnowledge2Document(browser({ text: 'This page could not be found.' }), href, title))
      .rejects.toThrow('Knowledge2 navigation rendered a 404: ' + href);
  });
});
