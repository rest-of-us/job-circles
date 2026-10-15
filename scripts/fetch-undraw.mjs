// Fetches an unDraw illustration, recolours it to the site's brand and saves a
// cleaned copy to illustrations/<name>.svg:
//
//   node scripts/fetch-undraw.mjs "<query>" [--name <name>] [--pick <n>] [--accent #hex] [--list] [--force]
//
//   --list         print the matches and exit
//   --pick <n>     use the nth match (1-based) instead of the best one
//   --name <name>  file name (default: the illustration's slug)
//   --accent #hex  accent colour (default: brand-600 from index.html's Tailwind config)
//   --force        overwrite an existing file
//
// The saved SVG has unDraw's accent (#6c63ff) replaced, colours lowercased (so
// the dark-mode rules in js/illustration.js match them), its fixed width and
// height removed so it scales, and anything active stripped (scripts, event
// handlers, foreignObject, external references), because js/illustration.js
// inlines it into the page.
//
// unDraw illustrations are free to use without attribution; don't bulk-copy
// the catalogue (https://undraw.co/license).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'illustrations');
const UNDRAW_ACCENT = '#6c63ff';
const TIMEOUT_MS = 20000;

function usage(msg) {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error('Usage: node scripts/fetch-undraw.mjs "<query>" [--name name] [--pick n] [--accent #hex] [--list] [--force]');
  process.exit(msg ? 2 : 0);
}

const args = { list: false, force: false, name: null, pick: 1, accent: null, query: '' };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '-h' || a === '--help') usage();
  else if (a === '--list' || a === '--force') args[a.slice(2)] = true;
  else if (['--name', '--pick', '--accent'].includes(a)) {
    if (argv[i + 1] === undefined) usage(`${a} needs a value`);
    args[a.slice(2)] = argv[++i];
  } else if (a.startsWith('--')) usage(`unknown option ${a}`);
  else if (!args.query) args.query = a.trim();
  else usage(`unexpected argument "${a}"`);
}
if (!args.query) usage('a search query is required');
args.pick = Number(args.pick);
if (!Number.isInteger(args.pick) || args.pick < 1) usage('--pick must be a positive whole number');
if (args.name && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.name)) usage('--name must be lowercase letters, numbers and dashes');

function hex(value) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value || '').trim());
  if (!m) return null;
  return '#' + (m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]).toLowerCase();
}

// brand-600 from the Tailwind config in index.html.
function brandAccent() {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const m = /brand:\s*\{[^}]*?\b600:\s*'(#[0-9a-fA-F]{6})'/.exec(html);
  if (!m) throw new Error('Couldn’t find brand-600 in index.html. Pass --accent.');
  return hex(m[1]);
}

async function get(url, as) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'rest-of-us-illustrations' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return as === 'json' ? res.json() : res.text();
  } catch (err) {
    throw err.name === 'AbortError' ? new Error(`timed out fetching ${url}`) : err;
  } finally {
    clearTimeout(timer);
  }
}

const isResult = (r) => r && typeof r.title === 'string' && typeof r.media === 'string';

// The search API, falling back to the results embedded in the search page.
async function search(query) {
  try {
    const data = await get(`https://undraw.co/api/search?q=${encodeURIComponent(query)}`, 'json');
    if (Array.isArray(data.results)) return data.results.filter(isResult);
  } catch (err) {
    console.warn(`Search API failed (${err.message}); trying the search page.`);
  }
  const html = await get(`https://undraw.co/search/${encodeURIComponent(query)}`, 'text');
  const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('unDraw’s search page had no results data; the site may have changed.');
  const props = JSON.parse(m[1])?.props?.pageProps || {};
  return (props.initialResults || props.results || []).filter(isResult);
}

function rank(results, query) {
  const q = query.toLowerCase();
  const score = (t) => (t === q ? 0 : t.startsWith(q) ? 1 : t.includes(q) ? 2 : 3);
  return results.map((r, i) => ({ r, i })).sort((a, b) => score(a.r.title.toLowerCase()) - score(b.r.title.toLowerCase()) || a.i - b.i).map(({ r }) => r);
}

const slug = (r) => String(r.newSlug || r.title).replace(/_[a-z0-9]{4}$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function clean(svg, accent, title) {
  let out = svg
    .replace(/<\?xml[^>]*>\s*/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\s+(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '')
    .replace(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b(?![0-9a-f])/gi, (c) => hex(c));
  out = out.replaceAll(UNDRAW_ACCENT, accent);
  // Root element: keep the viewBox, drop fixed size, ids and unDraw's metadata.
  out = out.replace(/<svg\b[^>]*>/i, (tag) => {
    const viewBox = /viewBox="([^"]+)"/i.exec(tag)?.[1];
    if (!viewBox) throw new Error('SVG has no viewBox, so it can’t scale.');
    const extra = /xmlns:xlink=/.test(tag) ? ' xmlns:xlink="http://www.w3.org/1999/xlink"' : '';
    return `<svg xmlns="http://www.w3.org/2000/svg"${extra} viewBox="${viewBox}">`;
  });
  return `<!-- unDraw: ${title.replace(/--/g, '-')} (https://undraw.co), recoloured to ${accent} -->\n${out.trim()}\n`;
}

const accent = args.accent ? hex(args.accent) : brandAccent();
if (!accent) usage(`"${args.accent}" isn’t a hex colour like #4f46e5`);

const results = rank(await search(args.query), args.query);
if (!results.length) {
  console.error(`No unDraw illustrations match "${args.query}".`);
  process.exit(1);
}
if (args.list) {
  results.forEach((r, i) => console.log(`${String(i + 1).padStart(2)}. ${r.title}  (${slug(r)})  ${r.media}`));
  process.exit(0);
}
if (args.pick > results.length) usage(`--pick ${args.pick}, but only ${results.length} result(s) matched`);

const chosen = results[args.pick - 1];
const media = new URL(chosen.media);
if (media.protocol !== 'https:' || !/(^|\.)undraw\.co$/.test(media.hostname)) throw new Error(`Refusing to download from ${media.href}`);
const raw = await get(media.href, 'text');
if (!/<svg[\s>]/i.test(raw)) throw new Error(`${media.href} didn’t return an SVG.`);

const name = args.name || slug(chosen);
const file = join(OUT_DIR, `${name}.svg`);
if (existsSync(file) && !args.force) {
  console.error(`illustrations/${name}.svg already exists. Use --force to replace it.`);
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });
const svg = clean(raw, accent, chosen.title);
writeFileSync(file, svg);

const viewBox = /viewBox="([^"]+)"/.exec(svg)[1].split(/[\s,]+/).map(Number);
const replaced = (raw.match(new RegExp(UNDRAW_ACCENT, 'gi')) || []).length;
console.log(`Saved illustrations/${name}.svg: ${chosen.title}, ${(svg.length / 1024).toFixed(1)} KB, accent ${accent} (${replaced} fill${replaced === 1 ? '' : 's'})`);
console.log(`Use: <undraw-illustration name="${name}" style="aspect-ratio: ${Math.round(viewBox[2])} / ${Math.round(viewBox[3])}" class="mx-auto w-48"></undraw-illustration>`);
