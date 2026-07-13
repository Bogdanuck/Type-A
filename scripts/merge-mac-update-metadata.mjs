import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { parse, stringify } from 'yaml';

const [x64Path, arm64Path, outputPath] = process.argv.slice(2);
if (!x64Path || !arm64Path || !outputPath) {
  throw new Error('Usage: node merge-mac-update-metadata.mjs <x64.yml> <arm64.yml> <output.yml>');
}

const [x64, arm64] = await Promise.all([
  readFile(x64Path, 'utf8').then(parse),
  readFile(arm64Path, 'utf8').then(parse),
]);

if (!x64?.version || x64.version !== arm64?.version) {
  throw new Error('macOS metadata versions do not match');
}

const files = [...(x64.files ?? []), ...(arm64.files ?? [])];
const uniqueFiles = Array.from(new Map(files.map((file) => [file.url, file])).values());
if (uniqueFiles.length < 2) {
  throw new Error('Expected update files for both macOS architectures');
}

const merged = {
  ...x64,
  files: uniqueFiles,
  releaseDate: [x64.releaseDate, arm64.releaseDate].filter(Boolean).sort().at(-1),
};

await writeFile(outputPath, stringify(merged, { lineWidth: 0 }), 'utf8');
