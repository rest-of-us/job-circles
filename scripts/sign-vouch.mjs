// Signs your vouch on a profile with your SSH key and writes the signature,
// format and key fingerprint into the file.
//
//   node scripts/sign-vouch.mjs <profile.json> <your-github> [~/.ssh/id_ed25519]
//
// The key must be one of the SSH keys on your GitHub account
// (https://github.com/<you>.keys) or CI will reject the signature.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { vouchMessage, findVouch, SSH_NAMESPACE } from './vouch-message.mjs';

const [file, voucher, keyArg] = process.argv.slice(2);
if (!file || !voucher) {
  console.error('Usage: node scripts/sign-vouch.mjs <profile.json> <your-github> [private-key]');
  process.exit(2);
}
const key = (keyArg || join(homedir(), '.ssh', 'id_ed25519')).replace(/^~(?=\/)/, homedir());
if (!existsSync(key)) { console.error(`Key not found: ${key}`); process.exit(1); }
const pub = existsSync(`${key}.pub`) ? `${key}.pub` : key;

const profile = JSON.parse(readFileSync(file, 'utf8'));
const vouch = findVouch(profile, voucher);
if (!vouch) { console.error(`No vouch from @${voucher} in ${file}. Add your vouch entry first.`); process.exit(1); }

const dir = mkdtempSync(join(tmpdir(), 'vouch-'));
try {
  const msg = join(dir, 'vouch.txt');
  writeFileSync(msg, vouchMessage(profile.id, vouch));
  execFileSync('ssh-keygen', ['-Y', 'sign', '-f', key, '-n', SSH_NAMESPACE, msg], { stdio: ['inherit', 'ignore', 'inherit'] });
  const fingerprint = execFileSync('ssh-keygen', ['-l', '-E', 'sha256', '-f', pub], { encoding: 'utf8' }).split(/\s+/)[1];

  vouch.signature_format = 'ssh';
  vouch.public_key_fingerprint = fingerprint;
  vouch.signature = readFileSync(`${msg}.sig`, 'utf8').trim();
  writeFileSync(file, JSON.stringify(profile, null, 2) + '\n');
  console.log(`Signed @${voucher}'s vouch on ${profile.id} with ${fingerprint}.`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
