// Validates circle changes in a pull request.
//
//   BASE_SHA=<sha> PR_AUTHOR=<login> node scripts/validate-circles.mjs [dir]
//
// Rules:
//   - every added or modified circle must pass circles/schema.json;
//   - the file name must be <id>.json, coordinates are rounded to 2 decimals
//     (city level), and members can't exceed capacity;
//   - a new circle must be opened by one of its organizers;
//   - an existing circle can only be changed or deleted by one of the
//     organizers listed before the change.
// Maintainers can still merge a PR that fails these checks (e.g. moderation).

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const DIR = (process.argv[2] || 'circles/entries').replace(/\/$/, '');
const { BASE_SHA, PR_AUTHOR } = process.env;
if (!BASE_SHA || !PR_AUTHOR) {
  console.error('BASE_SHA and PR_AUTHOR must be set');
  process.exit(2);
}
const author = PR_AUTHOR.toLowerCase();

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(JSON.parse(readFileSync('circles/schema.json', 'utf8')));

const errors = [];
const fail = (file, msg) => errors.push({ file, msg });

function readAtBase(file) {
  try {
    return JSON.parse(execFileSync('git', ['show', `${BASE_SHA}:${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch { return null; }
}

const organizers = (c) => (c?.organizers || []).map((o) => String(o.github).toLowerCase());
const isRounded = (x) => Number.isFinite(x) && Math.abs(Math.round(x * 100) / 100 - x) < 1e-9;

const changes = execFileSync('git', ['diff', '--name-status', '--no-renames', `${BASE_SHA}...HEAD`, '--', DIR], { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean)
  .map((line) => { const [status, file] = line.split('\t'); return { status: status[0], file }; })
  .filter(({ file }) => file.endsWith('.json'));

if (!changes.length) console.log(`No circle changes under ${DIR}/.`);

for (const { status, file } of changes) {
  const before = readAtBase(file);
  const owners = organizers(before);

  if (status === 'D') {
    if (!owners.includes(author)) fail(file, 'Only an organizer of this circle can delete it.');
    continue;
  }

  let after;
  try { after = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { fail(file, `Not valid JSON: ${e.message}`); continue; }

  if (!validateSchema(after)) {
    for (const e of validateSchema.errors) fail(file, `Schema: ${e.instancePath || '(root)'} ${e.message}${e.params?.additionalProperty ? ` (“${e.params.additionalProperty}”)` : ''}`);
  }
  if (basename(file) !== `${after.id}.json`) fail(file, `File name must be "${after.id}.json" to match the circle id.`);
  if (!isRounded(after.location?.lat) || !isRounded(after.location?.lon)) fail(file, 'Round coordinates to 2 decimal places (city level, not a meeting address).');
  if (after.members_count > after.capacity) fail(file, 'members_count cannot exceed capacity.');

  if (before) {
    if (!owners.includes(author)) fail(file, `Only an organizer (${owners.map((o) => '@' + o).join(', ')}) can change this circle.`);
    if (before.created && after.created !== before.created) fail(file, '"created" cannot be changed.');
  } else if (!organizers(after).includes(author)) {
    fail(file, `New circles must be submitted by one of their organizers. You're @${PR_AUTHOR}.`);
  }
}

for (const { file, msg } of errors) console.log(`::error file=${file}::${msg}`);
if (errors.length) {
  console.log(`\n${errors.length} problem(s) found.`);
  process.exit(1);
}
console.log(`${changes.length} circle change(s) passed.`);
