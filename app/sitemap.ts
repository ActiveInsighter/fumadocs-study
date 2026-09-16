import { toAbsoluteSiteUrl } from '@/lib/site-url';
import { source } from '@/lib/source';
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = source.getPages().map((page) => ({
    url: toAbsoluteSiteUrl(page.url),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [
    {
      url: toAbsoluteSiteUrl('/'),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: toAbsoluteSiteUrl('/llms.txt'),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    {
      url: toAbsoluteSiteUrl('/llms.mdx'),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    ...pages,
  ];
}
