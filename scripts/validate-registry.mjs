// Validates the hub registry:
//
//   node scripts/validate-registry.mjs [hubs.json]
//
// Rules:
//   - the file must pass hubs.schema.json;
//   - hub ids and feed URLs must be unique;
//   - an active or demo hub with a relative profiles_url must point at a file
//     in this repository.
// Reachability of external feeds is checked daily by aggregate-hubs.mjs, not
// here, so a PR isn't blocked by someone else's hub being down.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const FILE = process.argv[2] || 'hubs.json';

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
// The schema is read from next to this script, so CI can run a trusted (base-branch) copy against PR data.
const validate = ajv.compile(JSON.parse(readFileSync(new URL('../hubs.schema.json', import.meta.url), 'utf8')));

const errors = [];
let registry;
try { registry = JSON.parse(readFileSync(FILE, 'utf8')); }
catch (e) { errors.push(`Not valid JSON: ${e.message}`); }

if (registry) {
  if (!validate(registry)) {
    for (const e of validate.errors) errors.push(`Schema: ${e.instancePath || '(root)'} ${e.message}${e.params?.additionalProperty ? ` (“${e.params.additionalProperty}”)` : ''}`);
  }
  const ids = new Set();
  const feeds = new Set();
  for (const h of registry.hubs || []) {
    if (!h?.id) continue;
    if (ids.has(h.id)) errors.push(`Duplicate hub id "${h.id}".`);
    ids.add(h.id);
    const feed = String(h.profiles_url || '');
    if (feeds.has(feed)) errors.push(`Hub "${h.id}" reuses the feed ${feed}.`);
    feeds.add(feed);
    const relative = feed && !/^[a-z]+:/i.test(feed);
    if (relative && ['active', 'demo'].includes(h.status) && !existsSync(resolve(dirname(FILE), feed))) {
      errors.push(`Hub "${h.id}" points at ${feed}, which doesn't exist in this repository.`);
    }
    if (!relative && !/^https:\/\//.test(feed)) errors.push(`Hub "${h.id}": profiles_url must be https:// or a relative path.`);
  }
}

for (const msg of errors) console.log(`::error file=${FILE}::${msg}`);
if (errors.length) {
  console.log(`\n${errors.length} problem(s) found.`);
  process.exit(1);
}
console.log(`${FILE}: ${registry.hubs.length} hub(s) passed.`);
