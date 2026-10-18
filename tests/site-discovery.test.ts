import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/source', () => ({
  source: {
    getPages: () => [
      { url: '/docs/politics', path: 'politics/index.md', data: { title: '政治总览' } },
      { url: '/docs/math/formulas', path: 'math/formulas.md', data: { title: '公式手册' } },
    ],
  },
  blogSource: {
    getPages: () => [{ url: '/blog/hello', path: 'hello.mdx', data: { title: 'Hello' } }],
  },
}));

const { default: robots } = await import('@/app/robots');
const { default: sitemap } = await import('@/app/sitemap');
const { toAbsoluteSiteUrl } = await import('@/lib/site-url');

describe('crawler discovery metadata', () => {
  it('publishes every documentation page and AI entry points in the sitemap', () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toContain(toAbsoluteSiteUrl('/'));
    expect(urls).toContain(toAbsoluteSiteUrl('/llms.txt'));
    expect(urls).toContain(toAbsoluteSiteUrl('/docs/politics/'));
    expect(urls).toContain(toAbsoluteSiteUrl('/docs/math/formulas/'));
    expect(urls).toContain(toAbsoluteSiteUrl('/blog/hello/'));
    // `/llms.mdx` is a dynamic route that the static deployment does not ship.
    expect(urls.some((url) => url.includes('/llms.mdx'))).toBe(false);

    for (const url of urls) {
      expect(url.startsWith(toAbsoluteSiteUrl('/'))).toBe(true);
      // Static export uses trailing slashes; advertise final URLs, not redirects.
      if (!url.endsWith('.txt')) expect(url.endsWith('/')).toBe(true);
    }
  });

  it('defaults to the production study domain', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(toAbsoluteSiteUrl('/')).toBe('https://fumadocscf.any1.tech/');
  });

  it('allows crawling and advertises the sitemap', () => {
    const metadata = robots();
    expect(metadata.sitemap).toBe(toAbsoluteSiteUrl('/sitemap.xml'));
    expect(metadata.rules).toEqual([{ userAgent: '*', allow: '/' }]);
  });
});
