// Merges every <dir>/*.json file into one JSON array feed:
//   node scripts/build-feed.mjs profiles/community profiles/community.json
//   node scripts/build-feed.mjs circles/entries circles/index.json
import { readdir, readFile, writeFile } from 'node:fs/promises';

const [dir, out] = process.argv.slice(2);
if (!dir || !out) {
  console.error('Usage: node scripts/build-feed.mjs <dir> <out.json>');
  process.exit(2);
}

let files = [];
try { files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort(); } catch {}

const items = [];
for (const f of files) {
  try { items.push(JSON.parse(await readFile(`${dir}/${f}`, 'utf8'))); }
  catch (e) { console.warn(`Skipping ${f}: ${e.message}`); }
}

await writeFile(out, JSON.stringify(items, null, 2) + '\n');
console.log(`Wrote ${items.length} item(s) to ${out}`);
