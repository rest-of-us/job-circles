// Merges every <dir>/*.json file into one JSON array feed:
//   node scripts/build-feed.mjs profiles/community profiles/community.json
//   node scripts/build-feed.mjs circles/entries circles/index.json
//
// With --schema <file>, items that don't pass that JSON Schema are left out
// with a warning (needs ajv and ajv-formats installed):
//   node scripts/build-feed.mjs profiles _site/profiles.json --schema profiles/schema.json
import { readdir, readFile, writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const schemaAt = args.indexOf('--schema');
const schemaPath = schemaAt >= 0 ? args.splice(schemaAt, 2)[1] : null;
const [dir, out] = args;
if (!dir || !out || (schemaAt >= 0 && !schemaPath)) {
  console.error('Usage: node scripts/build-feed.mjs <dir> <out.json> [--schema <schema.json>]');
  process.exit(2);
}

let validate = null;
if (schemaPath) {
  const { default: Ajv2020 } = await import('ajv/dist/2020.js');
  const { default: addFormats } = await import('ajv-formats');
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  validate = ajv.compile(JSON.parse(await readFile(schemaPath, 'utf8')));
}

let files = [];
try { files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort(); } catch {}

const items = [];
for (const f of files) {
  let item;
  try { item = JSON.parse(await readFile(`${dir}/${f}`, 'utf8')); }
  catch (e) { console.warn(`Skipping ${f}: ${e.message}`); continue; }
  if (validate && !validate(item)) {
    console.warn(`Skipping ${f}: ${validate.errors.map((e) => `${e.instancePath || '(root)'} ${e.message}`).join('; ')}`);
    continue;
  }
  items.push(item);
}

await writeFile(out, JSON.stringify(items, null, 2) + '\n');
console.log(`Wrote ${items.length} item(s) to ${out}`);
