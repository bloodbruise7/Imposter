// Extracts the built-in word data from imposter.md (Appendix A) into
// src/data/categories.json. Writes the exact text between the fences,
// never a re-serialized copy, so the SHA-256 of the output is stable.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const specPath = resolve('imposter.md');
const outPath = resolve('src/data/categories.json');

const lines = readFileSync(specPath, 'utf8').replace(/\r\n/g, '\n').split('\n');

const beginIdx = lines.indexOf('<!-- BEGIN categories.json -->');
if (beginIdx === -1) fail('BEGIN marker not found');

const fenceIdx = lines.indexOf('```json', beginIdx + 1);
if (fenceIdx === -1) fail('opening ```json fence not found after BEGIN marker');

const endIdx = lines.indexOf('```', fenceIdx + 1);
if (endIdx === -1) fail('closing ``` fence not found');

const text = lines.slice(fenceIdx + 1, endIdx).join('\n') + '\n';

let data;
try {
  data = JSON.parse(text);
} catch (err) {
  fail(`extracted block is not valid JSON: ${err.message}`);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, text, 'utf8');

const categories = data.categories.length;
const words = data.categories.reduce((n, c) => n + c.words.length, 0);
console.log(`${categories} categories, ${words} words`);

function fail(msg) {
  console.error(`extract-categories: ${msg}`);
  process.exit(1);
}
