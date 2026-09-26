import { readdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outputRoot = path.resolve('.static-docs');

export function decodeUnicodeAssetName(name) {
  if (!/%[0-9A-Fa-f]{2}/.test(name)) return name;

  try {
    const decoded = decodeURIComponent(name);
    if (decoded !== name && /[^\x00-\x7F]/u.test(decoded)) {
      return decoded;
    }
  } catch {
    // Keep malformed or intentionally literal percent sequences unchanged.
  }

  return name;
}

async function collectEncodedEntries(directory, depth = 0, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const sourcePath = path.join(directory, entry.name);
    const decodedName = decodeUnicodeAssetName(entry.name);

    if (entry.isDirectory()) {
      await collectEncodedEntries(sourcePath, depth + 1, output);
    }

    if (decodedName !== entry.name) {
      output.push({
        sourcePath,
        destinationPath: path.join(directory, decodedName),
        depth,
        isDirectory: entry.isDirectory(),
      });
    }
  }

  return output;
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function normalizeStaticUnicodePaths(root = outputRoot) {
  const entries = await collectEncodedEntries(root);
  entries.sort((left, right) => right.depth - left.depth);

  let renamed = 0;
  for (const entry of entries) {
    if (await exists(entry.destinationPath)) {
      throw new Error(
        `Unicode static asset normalization collision: ${entry.sourcePath} -> ${entry.destinationPath}`,
      );
    }

    await rename(entry.sourcePath, entry.destinationPath);
    renamed += 1;
  }

  console.log(
    `[static-unicode] Normalized ${renamed} percent-encoded Unicode asset path entries.`,
  );
  return renamed;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  await normalizeStaticUnicodePaths();
}
