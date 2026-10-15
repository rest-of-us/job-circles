// Checks every hub in the registry and builds one combined directory:
//
//   node scripts/aggregate-hubs.mjs [hubs.json] [aggregated-directory.json]
//
// For each active or demo hub it:
//   - reads the feed (a file in this checkout when profiles_url is relative,
//     otherwise an HTTPS fetch with a timeout);
//   - checks that it is a profile feed and validates each profile against
//     profiles/schema.json, keeping only the valid ones;
//   - works out when the hub last changed: the newest profile `updated` date,
//     falling back to the last commit (local feeds) or Last-Modified (remote);
//   - marks it "ok", "stale" (an active hub with profiles but no change in
//     STALE_DAYS, default 90) or "error" (HTTP error, timeout, bad JSON or
//     not a feed). Empty hubs are never stale: they're waiting for members,
//     not abandoned.
// Planned and disabled hubs are listed but not fetched.
//
// The output is only rewritten when something other than the timestamp
// changed, so the daily run doesn't commit noise. The site loads it for a fast
// first paint and as a fallback for hubs that are down; live hub fetches
// still take over as they arrive.
//
// Environment:
//   STALE_DAYS      days without changes before a hub is flagged (default 90)
//   TIMEOUT_MS      per-request timeout (default 15000)
//   HEALTH_REPORT   write a Markdown health report to this path
//   GITHUB_OUTPUT   set by Actions; receives unhealthy=<n> and changed=<bool>

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const REGISTRY = process.argv[2] || 'hubs.json';
const OUT = process.argv[3] || 'aggregated-directory.json';
const STALE_DAYS = Number(process.env.STALE_DAYS) || 90;
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS) || 15000;
const MAX_PROFILES_PER_HUB = 2000;
const URL_FETCH_CONCURRENCY = 8;
const DAY_MS = 86400000;

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateProfile = ajv.compile(JSON.parse(readFileSync(new URL('../profiles/schema.json', import.meta.url), 'utf8')));

const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
const baseDir = dirname(resolve(REGISTRY));
const now = new Date();

const isRelative = (u) => !/^[a-z]+:/i.test(u);
const isoDate = (d) => (d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null);

async function fetchJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json', 'User-Agent': 'rest-of-us-hub-health' } });
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { httpStatus: res.status });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw Object.assign(new Error('response is not valid JSON'), { httpStatus: res.status }); }
    const lm = res.headers.get('last-modified');
    return { data, httpStatus: res.status, lastModified: lm ? new Date(lm) : null };
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`timed out after ${TIMEOUT_MS / 1000}s`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function readLocal(path) {
  const file = resolve(baseDir, path);
  if (!existsSync(file)) throw new Error(`${path} doesn't exist in this repository`);
  let data;
  try { data = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { throw new Error(`${path} is not valid JSON: ${e.message}`); }
  let lastCommit = null;
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], { cwd: baseDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (out) lastCommit = new Date(out);
  } catch {}
  return { data, httpStatus: null, lastModified: lastCommit };
}

// Runs fn over items with at most `limit` in flight.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

// A feed is an array of profiles, {"profiles": [...]}, or an array of URLs of
// individual profile files (relative to the feed). Same rules as js/hubs.js.
async function resolveEntries(data, feedUrl, local) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.profiles) ? data.profiles : null;
  if (!list) throw new Error('feed is not a list of profiles');
  const capped = list.slice(0, MAX_PROFILES_PER_HUB);
  return mapLimit(capped, URL_FETCH_CONCURRENCY, async (item) => {
    if (typeof item !== 'string') return item;
    try {
      if (local) return readLocal(resolve(dirname(resolve(baseDir, feedUrl)), item)).data;
      const src = new URL(item, feedUrl);
      if (src.protocol !== 'https:') return null;
      return (await fetchJson(src.href)).data;
    } catch { return null; }
  });
}

async function checkHub(hub) {
  const feed = String(hub.profiles_url || '');
  const local = isRelative(feed);
  const record = {
    id: hub.id,
    name: hub.name,
    status: hub.status,
    profiles_url: feed,
    health: 'skipped',
    http_status: null,
    error: null,
    profile_count: 0,
    invalid_count: 0,
    last_active: null,
    profiles: []
  };
  if (!['active', 'demo'].includes(hub.status)) {
    record.health = hub.status === 'planned' ? 'planned' : 'skipped';
    return record;
  }
  try {
    if (!local && !/^https:\/\//.test(feed)) throw new Error('profiles_url must be https:// or a relative path');
    const res = local ? readLocal(feed) : await fetchJson(feed);
    record.http_status = res.httpStatus;
    const entries = await resolveEntries(res.data, feed, local);
    const seen = new Set();
    let newest = null;
    for (const p of entries) {
      if (!p || !validateProfile(p) || seen.has(p.id)) { record.invalid_count++; continue; }
      seen.add(p.id);
      record.profiles.push(p);
      for (const d of [p.updated, ...(p.vouches || []).map((v) => v.date)]) {
        const t = d ? new Date(d) : null;
        if (t && !Number.isNaN(t.getTime()) && (!newest || t > newest)) newest = t;
      }
    }
    record.profile_count = record.profiles.length;
    const lastActive = newest || res.lastModified;
    record.last_active = isoDate(lastActive);
    // Sample data never changes, and an empty hub is waiting for its first
    // members rather than abandoned, so only live hubs with profiles go stale.
    const stale = hub.status === 'active' && record.profiles.length > 0 && lastActive && now - lastActive > STALE_DAYS * DAY_MS;
    record.health = stale ? 'stale' : 'ok';
    if (stale) record.error = `no updates since ${record.last_active}`;
  } catch (err) {
    record.health = 'error';
    record.http_status = err.httpStatus ?? null;
    record.error = err.message || 'unknown error';
  }
  return record;
}

const hubs = (registry.hubs || []).filter((h) => h && h.id && h.profiles_url);
const settled = await Promise.allSettled(hubs.map(checkHub));
const records = settled.map((s, i) => (s.status === 'fulfilled' ? s.value : {
  id: hubs[i].id, name: hubs[i].name, status: hubs[i].status, profiles_url: hubs[i].profiles_url,
  health: 'error', http_status: null, error: String(s.reason?.message || s.reason), profile_count: 0, invalid_count: 0, last_active: null, profiles: []
}));

const payload = {
  directory_version: '1.0',
  registry: registry.name || '',
  stale_after_days: STALE_DAYS,
  hubs: records
};

// Only rewrite when the content changed, ignoring the timestamp.
let previous = null;
try { previous = JSON.parse(readFileSync(OUT, 'utf8')); } catch {}
const { generated: _ignored, ...previousPayload } = previous || {};
const changed = JSON.stringify(previousPayload) !== JSON.stringify(payload);
if (changed) {
  writeFileSync(OUT, JSON.stringify({ directory_version: payload.directory_version, generated: now.toISOString(), ...payload }, null, 2) + '\n');
}

const unhealthy = records.filter((r) => r.health === 'error' || r.health === 'stale');
const icon = { ok: '✅', stale: '🕸️', error: '❌', planned: '🗓️', skipped: '⏭️' };
const lines = [
  `| Hub | Status | Health | Profiles | Invalid | Last active | Detail |`,
  `| --- | --- | --- | ---: | ---: | --- | --- |`,
  ...records.map((r) => `| ${r.name} (\`${r.id}\`) | ${r.status} | ${icon[r.health] || ''} ${r.health} | ${r.profile_count} | ${r.invalid_count} | ${r.last_active || '—'} | ${(r.error || '').replace(/\|/g, '\\|')} |`)
];

console.log(lines.join('\n'));
for (const r of unhealthy) console.log(`::warning title=Hub ${r.id} is ${r.health}::${r.name}: ${r.error}`);
console.log(changed ? `\nWrote ${OUT}.` : `\n${OUT} unchanged.`);

if (process.env.HEALTH_REPORT) {
  writeFileSync(process.env.HEALTH_REPORT, [
    `Hub health check on ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC. ` +
      `Hubs are flagged when their feed can't be read or nothing has changed in ${STALE_DAYS} days.`,
    '',
    ...lines,
    '',
    'Stale hubs are still searched. A hub that keeps erroring should be set to `"status": "planned"` or `"disabled"` in `hubs.json` until its feed is back.'
  ].join('\n') + '\n');
}
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Hub health\n\n${lines.join('\n')}\n`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `unhealthy=${unhealthy.length}\nchanged=${changed}\n`);
