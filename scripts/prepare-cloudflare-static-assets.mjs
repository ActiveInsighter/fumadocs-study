import { copyFile, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CLOUDFLARE_DYNAMIC_REDIRECT_LIMIT = 100;

function countSplats(value) {
  return (value.match(/\*/g) ?? []).length;
}

export function buildCloudflareRedirects(rewrites) {
  if (!Array.isArray(rewrites) || rewrites.length === 0) {
    throw new Error('Expected at least one EdgeOne rewrite to translate for Cloudflare.');
  }
  if (rewrites.length > CLOUDFLARE_DYNAMIC_REDIRECT_LIMIT) {
    throw new Error(
      `Cloudflare Static Assets supports at most ${CLOUDFLARE_DYNAMIC_REDIRECT_LIMIT} dynamic _redirects rules; got ${rewrites.length}.`,
    );
  }

  const lines = [
    '# Generated from .static-docs/edgeone.json by scripts/prepare-cloudflare-static-assets.mjs.',
    '# Cloudflare Workers Static Assets does not support 200 rewrite rules in _redirects.',
    '# Use temporary redirects instead; browser/fetch clients follow them to the canonical RSC asset.',
  ];

  for (const rewrite of rewrites) {
    const source = rewrite?.source;
    const destination = rewrite?.destination;
    if (typeof source !== 'string' || typeof destination !== 'string') {
      throw new Error(`Invalid rewrite entry: ${JSON.stringify(rewrite)}`);
    }
    if (!source.startsWith('/') || !destination.startsWith('/')) {
      throw new Error(`Cloudflare redirects must stay on-site: ${source} -> ${destination}`);
    }
    if (countSplats(source) > 1) {
      throw new Error(`Cloudflare _redirects supports only one splat per source: ${source}`);
    }
    lines.push(`${source} ${destination} 200`);
  }

  return `${lines.join('\n')}\n`;
}

export function buildCloudflareAssetsIgnore() {
  return [
    '# EdgeOne deployment metadata is not a public Cloudflare asset.',
    'edgeone.json',
    '',
  ].join('\n');
}

async function ensureRootIndex(outputRoot) {
  const rootIndexPath = path.join(outputRoot, 'index.html');

  try {
    await stat(rootIndexPath);
    return false;
  } catch {
    const docsIndexPath = path.join(outputRoot, 'docs', 'index.html');
    await stat(docsIndexPath);
    await copyFile(docsIndexPath, rootIndexPath);
    return true;
  }
}

export async function prepareCloudflareStaticAssets(outputRoot = path.resolve('.static-docs')) {
  const edgeOneConfigPath = path.join(outputRoot, 'edgeone.json');
  const redirectsPath = path.join(outputRoot, '_redirects');
  const assetsIgnorePath = path.join(outputRoot, '.assetsignore');
  const notFoundPath = path.join(outputRoot, '404.html');

  const edgeOneConfig = JSON.parse(await readFile(edgeOneConfigPath, 'utf8'));
  const redirects = buildCloudflareRedirects(edgeOneConfig.rewrites);

  await stat(notFoundPath);
  const restoredRootIndex = await ensureRootIndex(outputRoot);
  await Promise.all([
    writeFile(redirectsPath, redirects, 'utf8'),
    writeFile(assetsIgnorePath, buildCloudflareAssetsIgnore(), 'utf8'),
  ]);

  console.log(`[cloudflare-assets] Wrote ${redirectsPath}.`);
  console.log('[cloudflare-assets] Translated EdgeOne RSC rewrites to Cloudflare 200 proxy rewrites.');
  console.log('[cloudflare-assets] Confirmed 404.html for not_found_handling=404-page.');
  if (restoredRootIndex) {
    console.log('[cloudflare-assets] Restored missing root index.html from docs/index.html.');
  } else {
    console.log('[cloudflare-assets] Confirmed root index.html exists.');
  }
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  await prepareCloudflareStaticAssets();
}
