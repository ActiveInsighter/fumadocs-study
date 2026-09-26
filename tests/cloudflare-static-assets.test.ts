import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
// @ts-expect-error The deployment helper is intentionally a Node.js ESM script.
import {
  buildCloudflareAssetsIgnore,
  buildCloudflareRedirects,
  CLOUDFLARE_DYNAMIC_REDIRECT_LIMIT,
  prepareCloudflareStaticAssets,
} from '../scripts/prepare-cloudflare-static-assets.mjs';

describe('Cloudflare Workers Static Assets deployment', () => {
  it('uses an assets-only SSG configuration with canonical trailing-slash handling', () => {
    const config = JSON.parse(readFileSync(resolve('wrangler.jsonc'), 'utf8'));

    expect(config.name).toBe('fumadocs-static-docs');
    expect(config.main).toBeUndefined();
    expect(config.workers_dev).toBe(true);
    expect(config.assets).toEqual({
      directory: './.static-docs',
      not_found_handling: '404-page',
      html_handling: 'auto-trailing-slash',
    });
  });

  it('translates guarded EdgeOne RSC rewrites to supported Cloudflare redirects', () => {
    const redirects = buildCloudflareRedirects([
      {
        source: '/docs/*/index.txt',
        destination: '/docs/:splat/__next._full.txt',
      },
      {
        source: '/docs/*/__next.docs.txt',
        destination: '/docs/__next.docs.txt',
      },
    ]);

    expect(redirects).toContain('/docs/*/index.txt /docs/:splat/__next._full.txt 302');
    expect(redirects).toContain('/docs/*/__next.docs.txt /docs/__next.docs.txt 302');

    const ruleLines = redirects
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));

    expect(ruleLines.every((line) => !/\s200$/.test(line))).toBe(true);
  });


  it('repairs a root index that contains the exported Next.js 404 page', async () => {
    const outputRoot = mkdtempSync(join(tmpdir(), 'fumadocs-cloudflare-'));
    mkdirSync(join(outputRoot, 'docs'), { recursive: true });

    writeFileSync(join(outputRoot, 'index.html'), '<html>This page could not be found.</html>');
    writeFileSync(join(outputRoot, 'docs', 'index.html'), '<html>Study docs home</html>');
    writeFileSync(join(outputRoot, '404.html'), '<html>404</html>');
    writeFileSync(
      join(outputRoot, 'edgeone.json'),
      JSON.stringify({
        rewrites: [
          {
            source: '/docs/*/index.txt',
            destination: '/docs/:splat/__next._full.txt',
          },
        ],
      }),
    );

    await prepareCloudflareStaticAssets(outputRoot);

    expect(readFileSync(join(outputRoot, 'index.html'), 'utf8')).toContain('Study docs home');
  });

  it('keeps Cloudflare dynamic redirects within the documented limit', () => {
    expect(CLOUDFLARE_DYNAMIC_REDIRECT_LIMIT).toBe(100);
    const tooMany = Array.from({ length: 101 }, (_, index) => ({
      source: `/docs/path-${index}/*`,
      destination: `/docs/path-${index}/:splat`,
    }));

    expect(() => buildCloudflareRedirects(tooMany)).toThrow(/at most 100 dynamic/);
  });

  it('refuses unsupported multi-splat or external redirects', () => {
    expect(() =>
      buildCloudflareRedirects([
        { source: '/docs/*/nested/*', destination: '/docs/:splat' },
      ]),
    ).toThrow(/only one splat/);

    expect(() =>
      buildCloudflareRedirects([
        { source: '/docs/*', destination: 'https://example.com/:splat' },
      ]),
    ).toThrow(/stay on-site/);
  });

  it('excludes EdgeOne deployment metadata from Cloudflare asset upload', () => {
    expect(buildCloudflareAssetsIgnore()).toContain('\nedgeone.json\n');
  });
});
