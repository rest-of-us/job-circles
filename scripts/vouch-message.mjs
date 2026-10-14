// The canonical text a voucher signs. CI rebuilds it from the profile and
// checks the signature against it, so any edit to a signed vouch (or moving it
// to another profile) breaks the signature.
//
//   node scripts/vouch-message.mjs <profile.json> <voucher-github>   # print it
//
// Sign it with SSH (namespace "the-rest-of-us-vouch"):
//   ssh-keygen -Y sign -f ~/.ssh/id_ed25519 -n the-rest-of-us-vouch vouch.txt
// or with OpenPGP:
//   gpg --armor --detach-sign vouch.txt
// or let scripts/sign-vouch.mjs do the SSH steps for you.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SSH_NAMESPACE = 'the-rest-of-us-vouch';

export function vouchMessage(profileId, vouch) {
  const line = (k, v) => `${k}: ${String(v ?? '').replace(/\r?\n/g, ' ').trim()}`;
  return [
    'the-rest-of-us vouch v1',
    line('candidate', profileId),
    line('voucher', String(vouch.vouched_by_github || '').toLowerCase()),
    line('voucher_name', vouch.vouched_by),
    line('relationship', vouch.relationship),
    line('date', vouch.date),
    line('statement', vouch.statement)
  ].join('\n') + '\n';
}

export function findVouch(profile, voucher) {
  const login = String(voucher).toLowerCase();
  return (profile.vouches || []).find((v) => String(v.vouched_by_github).toLowerCase() === login);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [file, voucher] = process.argv.slice(2);
  if (!file || !voucher) {
    console.error('Usage: node scripts/vouch-message.mjs <profile.json> <voucher-github>');
    process.exit(2);
  }
  const profile = JSON.parse(readFileSync(file, 'utf8'));
  const vouch = findVouch(profile, voucher);
  if (!vouch) {
    console.error(`No vouch from @${voucher} in ${file}. Add your vouch entry first.`);
    process.exit(1);
  }
  process.stdout.write(vouchMessage(profile.id, vouch));
}
