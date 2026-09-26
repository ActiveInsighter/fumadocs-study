import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('content/docs/algorithm');

const languageAliases = new Map([
  ['c++', 'C++'],
  ['cpp', 'C++'],
  ['java', 'Java'],
  ['python', 'Python'],
  ['py', 'Python'],
  ['go', 'Go'],
  ['golang', 'Go'],
  ['javascript', 'JavaScript'],
  ['js', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['ts', 'TypeScript'],
  ['rust', 'Rust'],
  ['kotlin', 'Kotlin'],
  ['c#', 'C#'],
  ['csharp', 'C#'],
  ['c', 'C'],
]);

const languageHeadingPattern =
  /^\s*#{3,4}\s*(C\+\+|JavaScript|TypeScript|Python|Java|Go|Rust|Kotlin|C#|C)(?:\s*(?:版本|实现|代码))?\s*$/i;
const languageLabelPattern = /\blabel=(["'])(C\+\+|JavaScript|TypeScript|Python|Java|Go|Rust|Kotlin|C#|C)\1/i;
const languageTabPattern = /\btab=(["'])(C\+\+|JavaScript|TypeScript|Python|Java|Go|Rust|Kotlin|C#|C)\1/i;
const multilingualHeadingPattern = /^##\s+.*(?:多语言|其他语言).*$/gm;

function canonicalLanguage(value) {
  return languageAliases.get(value.trim().toLowerCase()) ?? value.trim();
}

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(full)));
    else if (entry.isFile() && /\.mdx?$/.test(entry.name)) output.push(full);
  }
  return output;
}

function findLastMultilingualSection(content) {
  const matches = [...content.matchAll(multilingualHeadingPattern)];
  if (matches.length === 0) return null;

  const marker = matches.at(-1);
  const start = marker.index;
  const bodyStart = start + marker[0].length;
  const next = content.slice(bodyStart).match(/\n##\s+/);
  const end = next ? bodyStart + next.index : content.length;

  return { start, end };
}

function addTabToFence(line, language) {
  if (!/^\s*```/.test(line)) return line;
  if (languageTabPattern.test(line)) return line;

  if (languageLabelPattern.test(line)) {
    return line.replace(languageLabelPattern, `tab="${language}"`);
  }

  return line.replace(/(\s*)$/, ` tab="${language}"$1`);
}

function transformSection(section) {
  const lines = section.split('\n');
  let pendingLanguage = null;
  let languageIndicators = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const heading = lines[i].match(languageHeadingPattern);
    if (heading) {
      pendingLanguage = canonicalLanguage(heading[1]);
      languageIndicators += 1;
      lines[i] = '';
      continue;
    }

    if (pendingLanguage) {
      if (/^\s*$/.test(lines[i])) continue;
      if (/^\s*```/.test(lines[i])) {
        lines[i] = addTabToFence(lines[i], pendingLanguage);
      }
      pendingLanguage = null;
    }

    const label = lines[i].match(languageLabelPattern);
    if (label && /^\s*```/.test(lines[i])) {
      const language = canonicalLanguage(label[2]);
      languageIndicators += 1;
      lines[i] = addTabToFence(lines[i], language);
    }
  }

  const transformed = lines.join('\n');
  const tabs = [...transformed.matchAll(new RegExp(languageTabPattern.source, 'gi'))];

  return {
    transformed,
    languageIndicators,
    tabCount: tabs.length,
  };
}

const files = await walk(root);
let modified = 0;
let candidates = 0;
const skipped = [];
const changed = [];

for (const file of files) {
  const content = await readFile(file, 'utf8');
  const range = findLastMultilingualSection(content);
  if (!range) continue;

  const section = content.slice(range.start, range.end);
  const headingIndicators = [...section.matchAll(new RegExp(languageHeadingPattern.source, 'gmi'))].length;
  const labelIndicators = [...section.matchAll(new RegExp(languageLabelPattern.source, 'gi'))].length;
  const tabIndicators = [...section.matchAll(new RegExp(languageTabPattern.source, 'gi'))].length;
  const totalIndicators = headingIndicators + labelIndicators + tabIndicators;

  if (totalIndicators < 2) continue;
  candidates += 1;

  const result = transformSection(section);
  if (result.tabCount < 2) {
    skipped.push(path.relative(root, file));
    continue;
  }

  const nextContent =
    content.slice(0, range.start) + result.transformed + content.slice(range.end);

  if (nextContent !== content) {
    await writeFile(file, nextContent, 'utf8');
    modified += 1;
    changed.push(path.relative(root, file));
  }
}

if (skipped.length > 0) {
  console.error('[algorithm-code-tabs] Could not safely convert:', skipped.join(', '));
  process.exitCode = 1;
} else {
  console.log(
    `[algorithm-code-tabs] scanned=${files.length} candidates=${candidates} modified=${modified}`,
  );
  console.log('[algorithm-code-tabs] changed files:');
  for (const file of changed) console.log(`- ${file}`);
}
