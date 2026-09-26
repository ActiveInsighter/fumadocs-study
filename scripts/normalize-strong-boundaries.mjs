import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const contentRoots = [
  path.join(projectRoot, 'content', 'docs'),
  path.join(projectRoot, 'content', 'blog'),
];

const WORD_JOINER_ENTITY = '&#x2060;';
const wordCharacter = /[\p{L}\p{N}\p{M}]/u;
const punctuationOrSymbol = /[\p{P}\p{S}]/u;

function characters(value) {
  return Array.from(value);
}

function previousCharacter(value, index) {
  return characters(value.slice(0, index)).at(-1) ?? '';
}

function nextCharacter(value, index) {
  return characters(value.slice(index))[0] ?? '';
}

function findStrongMarkers(line) {
  const positions = [];
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== '*' || line[index + 1] !== '*') continue;
    if (line[index - 1] === '*' || line[index + 2] === '*') continue;
    positions.push(index);
    index += 1;
  }
  return positions;
}

export function normalizeStrongBoundariesInLine(line) {
  const markers = findStrongMarkers(line);
  if (markers.length < 2) return line;

  let output = '';
  let cursor = 0;

  for (let markerIndex = 0; markerIndex + 1 < markers.length; markerIndex += 2) {
    const open = markers[markerIndex];
    const close = markers[markerIndex + 1];
    const rawInner = line.slice(open + 2, close);
    const inner = rawInner.trim();

    if (!inner || inner.includes('**')) continue;

    const innerStart = rawInner.indexOf(inner);
    const leadingWhitespace = rawInner.slice(0, innerStart);
    const trailingWhitespace = rawInner.slice(innerStart + inner.length);

    const beforeCharacter = previousCharacter(line, open);
    const afterCharacter = nextCharacter(line, close + 2);
    const innerCharacters = characters(inner);
    const firstInner = innerCharacters[0] ?? '';
    const lastInner = innerCharacters.at(-1) ?? '';

    const needsOpeningBoundary =
      wordCharacter.test(beforeCharacter) && punctuationOrSymbol.test(firstInner);
    const needsClosingBoundary =
      punctuationOrSymbol.test(lastInner) && wordCharacter.test(afterCharacter);
    const needsWhitespaceRepair =
      leadingWhitespace.length > 0 || trailingWhitespace.length > 0;

    if (!needsOpeningBoundary && !needsClosingBoundary && !needsWhitespaceRepair) continue;

    output += line.slice(cursor, open);
    output += leadingWhitespace;
    if (needsOpeningBoundary) output += WORD_JOINER_ENTITY;
    output += '**' + inner + '**';
    if (needsClosingBoundary) output += WORD_JOINER_ENTITY;
    output += trailingWhitespace;
    cursor = close + 2;
  }

  if (cursor === 0) return line;
  output += line.slice(cursor);
  return output;
}

export function normalizeStrongBoundaries(source) {
  const lines = source.split(/\r?\n/);
  let fence = null;

  const normalized = lines.map((line) => {
    const fenceMatch = line.match(/^\s*((?:\x60){3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      return line;
    }

    if (fence !== null) return line;
    return normalizeStrongBoundariesInLine(line);
  });

  return normalized.join('\n');
}

async function walkMarkdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkMarkdownFiles(filePath)));
    else if (entry.isFile() && /\.(?:md|mdx)$/u.test(entry.name)) files.push(filePath);
  }
  return files;
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const changed = [];

  for (const root of contentRoots) {
    for (const filePath of await walkMarkdownFiles(root)) {
      const source = await readFile(filePath, 'utf8');
      const normalized = normalizeStrongBoundaries(source);
      if (normalized === source) continue;

      changed.push(path.relative(projectRoot, filePath).replaceAll('\\', '/'));
      if (!checkOnly) await writeFile(filePath, normalized);
    }
  }

  if (changed.length === 0) {
    console.log('[strong-boundary] all Markdown/MDX files are normalized');
    return;
  }

  console.log('[strong-boundary] ' + (checkOnly ? 'found' : 'normalized') + ' ' + changed.length + ' file(s):');
  for (const file of changed) console.log(' - ' + file);

  if (checkOnly) {
    console.error('[strong-boundary] run node scripts/normalize-strong-boundaries.mjs and commit the result');
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
