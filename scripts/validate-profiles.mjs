// Validates profile changes in a pull request.
//
//   BASE_SHA=<sha> PR_AUTHOR=<login> node scripts/validate-profiles.mjs [dir]
//
// Rules:
//   - every added or modified profile must pass profiles/schema.json;
//   - the file name must be <id>.json and the profile must name its owner in `github`;
//   - the profile owner may change anything except vouches from other people;
//   - anyone else may only add, edit or remove their own vouch;
//   - only the owner may delete a profile;
//   - a new or changed vouch that carries a signature must verify against the
//     voucher's public keys on GitHub (github.com/<user>.keys or .gpg), and the
//     key must match public_key_fingerprint.
// Maintainers can still merge a PR that fails these checks (e.g. moderation).

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { vouchMessage, SSH_NAMESPACE } from './vouch-message.mjs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const DIR = (process.argv[2] || 'profiles/community').replace(/\/$/, '');
const { BASE_SHA, PR_AUTHOR } = process.env;
if (!BASE_SHA || !PR_AUTHOR) {
  console.error('BASE_SHA and PR_AUTHOR must be set');
  process.exit(2);
}
const author = PR_AUTHOR.toLowerCase();

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
// The schema is read from next to this script, so CI can run a trusted (base-branch) copy against PR data.
const validateSchema = ajv.compile(JSON.parse(readFileSync(new URL('../profiles/schema.json', import.meta.url), 'utf8')));

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const errors = [];
const fail = (file, msg) => errors.push({ file, msg });

function readAtBase(file) {
  try {
    return JSON.parse(execFileSync('git', ['show', `${BASE_SHA}:${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch { return null; }
}

// Stable stringify so key order doesn't count as a change.
function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

// Public keys come from GitHub; VOUCH_KEYS_DIR=<dir> reads <dir>/<login>.keys|.gpg instead (for tests).
async function publicKeys(login, ext) {
  if (process.env.VOUCH_KEYS_DIR) {
    try { return readFileSync(join(process.env.VOUCH_KEYS_DIR, `${login}.${ext}`), 'utf8'); } catch { return ''; }
  }
  const res = await fetch(`https://github.com/${encodeURIComponent(login)}.${ext}`);
  return res.ok ? res.text() : '';
}

// Returns null when the signature is valid, otherwise a reason.
async function verifyVouch(profileId, v) {
  const login = String(v.vouched_by_github).toLowerCase();
  const dir = mkdtempSync(join(tmpdir(), 'vouch-'));
  const msg = vouchMessage(profileId, v);
  try {
    const sigFile = join(dir, 'vouch.sig');
    writeFileSync(sigFile, v.signature.trim() + '\n');

    if (v.signature_format === 'ssh') {
      const keys = (await publicKeys(login, 'keys')).split('\n').map((k) => k.trim()).filter(Boolean);
      if (!keys.length) return `@${login} has no SSH keys on GitHub to check the signature against.`;
      const allowed = join(dir, 'allowed_signers');
      writeFileSync(allowed, keys.map((k) => `${login} namespaces="${SSH_NAMESPACE}" ${k}`).join('\n') + '\n');
      let out;
      try {
        out = execFileSync('ssh-keygen', ['-Y', 'verify', '-f', allowed, '-I', login, '-n', SSH_NAMESPACE, '-s', sigFile],
          { input: msg, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      } catch { return `SSH signature doesn't verify against @${login}'s GitHub keys for this exact vouch text.`; }
      const fp = /key (SHA256:\S+)/.exec(out)?.[1];
      if (fp !== v.public_key_fingerprint) return `Signed with ${fp || 'an unknown key'}, but public_key_fingerprint says ${v.public_key_fingerprint}.`;
      return null;
    }

    if (v.signature_format === 'openpgp') {
      const armored = await publicKeys(login, 'gpg');
      if (!armored.includes('BEGIN PGP PUBLIC KEY BLOCK')) return `@${login} has no OpenPGP keys on GitHub to check the signature against.`;
      const home = join(dir, 'gnupg');
      execFileSync('mkdir', ['-m', '700', home]);
      execFileSync('gpg', ['--homedir', home, '--batch', '--quiet', '--import'], { input: armored, stdio: ['pipe', 'ignore', 'ignore'] });
      const msgFile = join(dir, 'vouch.txt');
      writeFileSync(msgFile, msg);
      let status = '';
      try {
        status = execFileSync('gpg', ['--homedir', home, '--batch', '--status-fd', '1', '--verify', sigFile, msgFile],
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      } catch (e) { status = String(e.stdout || ''); }
      const valid = /^\[GNUPG:\] VALIDSIG (\S+)(?: \S+){8} (\S+)/m.exec(status);
      if (!/^\[GNUPG:\] GOODSIG /m.test(status) || !valid) return `OpenPGP signature doesn't verify against @${login}'s GitHub keys for this exact vouch text.`;
      const fpr = String(v.public_key_fingerprint).toUpperCase();
      if (fpr !== valid[1] && fpr !== valid[2]) return `Signed with key ${valid[1]}, but public_key_fingerprint says ${v.public_key_fingerprint}.`;
      return null;
    }
    return `Unknown signature_format "${v.signature_format}".`;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const vouchMap = (p) => new Map((p?.vouches || []).map((v) => [String(v.vouched_by_github).toLowerCase(), canonical(v)]));
const withoutVouches = (p) => { const { vouches, updated, ...rest } = p || {}; return canonical(rest); };

const changes = git('diff', '--name-status', '--no-renames', `${BASE_SHA}...HEAD`, '--', DIR)
  .trim().split('\n').filter(Boolean)
  .map((line) => { const [status, file] = line.split('\t'); return { status: status[0], file }; })
  .filter(({ file }) => file.endsWith('.json'));

if (!changes.length) console.log(`No profile changes under ${DIR}/.`);

for (const { status, file } of changes) {
  const before = readAtBase(file);
  const owner = String(before?.github || '').toLowerCase();

  if (status === 'D') {
    if (owner !== author) fail(file, `Only @${before?.github || 'the profile owner'} can delete this profile.`);
    continue;
  }

  let after;
  try { after = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { fail(file, `Not valid JSON: ${e.message}`); continue; }

  if (!validateSchema(after)) {
    for (const e of validateSchema.errors) fail(file, `Schema: ${e.instancePath || '(root)'} ${e.message}${e.params?.additionalProperty ? ` (“${e.params.additionalProperty}”)` : ''}`);
  }
  if (basename(file) !== `${after.id}.json`) fail(file, `File name must be "${after.id}.json" to match the profile id.`);
  if (!after.github) { fail(file, 'Profiles must include the owner\'s "github" username.'); continue; }
  if (after.id !== String(after.github).toLowerCase()) fail(file, `"id" must be the lowercase GitHub username ("${String(after.github).toLowerCase()}").`);

  const newOwner = String(after.github).toLowerCase();
  if (before && owner && newOwner !== owner) fail(file, 'The "github" owner of an existing profile cannot be changed.');

  const oldV = vouchMap(before), newV = vouchMap(after);
  const touched = [...new Set([...oldV.keys(), ...newV.keys()])].filter((k) => oldV.get(k) !== newV.get(k));

  for (const k of newV.keys()) if (k === newOwner) fail(file, 'You cannot vouch for yourself.');

  if (author === newOwner) {
    // Owners may remove vouches, but not add or edit them.
    const forged = touched.filter((k) => newV.has(k));
    if (forged.length) fail(file, `Vouches must be added by the person vouching. Ask ${forged.map((k) => '@' + k).join(', ')} to open their own pull request.`);
  } else {
    if (!before) { fail(file, `New profiles must be submitted by their owner, @${after.github}.`); continue; }
    if (withoutVouches(before) !== withoutVouches(after)) fail(file, `Only @${after.github} can edit this profile. Vouchers may only change their own vouch.`);
    const others = touched.filter((k) => k !== author);
    if (others.length) fail(file, `You can only add or change your own vouch (vouched_by_github: "${PR_AUTHOR}").`);
  }

  // Check signatures on vouches that are new or changed in this PR.
  for (const v of after.vouches || []) {
    const k = String(v.vouched_by_github).toLowerCase();
    if (!v.signature || !touched.includes(k)) continue;
    const problem = await verifyVouch(after.id, v);
    if (problem) fail(file, `Vouch from @${k}: ${problem}`);
    else console.log(`Verified ${v.signature_format} signature on @${k}'s vouch (${v.public_key_fingerprint}).`);
  }
}

for (const { file, msg } of errors) console.log(`::error file=${file}::${msg}`);
if (errors.length) {
  console.log(`\n${errors.length} problem(s) found.`);
  process.exit(1);
}
console.log(`${changes.length} profile change(s) passed.`);
