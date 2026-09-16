import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { toAbsoluteSiteUrl } from '@/lib/site-url';
import { source } from '@/lib/source';
import { describe, expect, it } from 'vitest';

describe('crawler discovery metadata', () => {
  it('publishes every documentation page and AI entry points in the sitemap', () => {
    const entries = sitemap();
    const urls = new Set(entries.map((entry) => entry.url));

    expect(urls).toContain(toAbsoluteSiteUrl('/'));
    expect(urls).toContain(toAbsoluteSiteUrl('/llms.txt'));
    expect(urls).toContain(toAbsoluteSiteUrl('/llms.mdx'));

    for (const page of source.getPages()) {
      expect(urls).toContain(toAbsoluteSiteUrl(page.url));
    }
  });

  it('allows crawling and advertises the sitemap', () => {
    const metadata = robots();
    expect(metadata.sitemap).toBe(toAbsoluteSiteUrl('/sitemap.xml'));
    expect(metadata.rules).toEqual([{ userAgent: '*', allow: '/' }]);
  });
});
