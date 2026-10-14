# The Rest of US

**Connecting senior global tech talent directly with recruiters — bypassing ATS filters and regional bias.**

🌍 **Live site:** https://rest-of-us.github.io/job-circles

The Rest of US is an open-source, decentralized directory of senior tech talent in the United States and around the world. Experienced engineers, architects and technical leaders in the UK, Canada, the US, Latin America, Asia-Pacific and beyond are routinely screened out by keyword-matching ATS tools, location checks and age proxies such as graduation years, before a human reads their CV.

This project takes a different approach:

- **Impact, not chronology.** Profiles describe systems built and outcomes delivered. The [schema](profiles/schema.json) has no fields for birth dates, graduation years, employment dates or "years of experience", and rejects any field it doesn't define.
- **Peer vouches in public.** Colleagues vouch for each other through pull requests from their own GitHub accounts, so every endorsement has a traceable author.
- **No middleman.** Recruiters contact candidates directly. No accounts, no fees.
- **Federated.** Regional hubs are independent GitHub repositories run by their own maintainers. This site is just a search UI over their public JSON feeds.
- **Static.** Everything runs on GitHub Pages. No backend, no database.

---

## How it works

**In short:** it's a public list of experienced tech people, in the US and around the world. You add yourself, colleagues back you up, and recruiters get in touch with you directly. It's free, and nobody sits in the middle.

**If you're looking for work**

1. **Fill in a short form** in the [profile builder](https://rest-of-us.github.io/job-circles/join.html) about what you've built and the difference it made. There are no questions about dates or age.
2. **Click Submit.** Your profile opens on GitHub, ready to send. You click two buttons to send it.
3. **A volunteer checks it** and approves it. Your profile then shows up in the search on the [website](https://rest-of-us.github.io/job-circles).
4. **Recruiters contact you directly** using the contact details you chose to share.

**If you're vouching for a colleague**

1. **They send you their profile link** and ask for a vouch: a short, public recommendation.
2. **You write a sentence or two** about how you worked together, and send it from your own GitHub account ([step-by-step guide](#peer-vouches)).
3. **It appears on their profile with your name on it.** Because it came from your account, anyone can see it's really from you.

**If you're hiring**

1. **Search** by skill, role or place on the [website](https://rest-of-us.github.io/job-circles). You don't need an account.
2. **Narrow it down** by time zone, seniority, the kind of work people want, or whether a colleague has vouched for them.
3. **Click Reveal contact** and get in touch with the person directly. There are no fees.

### Common questions

- **What is GitHub, and why do I need it?** GitHub is a free website for storing and sharing files, used by most software teams. Profiles live there instead of in our own database, so no single company owns or controls them. You'll need a free GitHub account to add a profile or a vouch. Searching doesn't need one.
- **Why no dates or years of experience?** Dates are how automated hiring filters guess someone's age and screen them out. Here you're judged on what you built and what changed because of it.
- **Who can see my profile?** Everyone. Your profile is public, so only include what you're happy to share. You can use a nickname instead of your real name. Your contact details are scrambled so automated bots can't easily collect them, but anyone who clicks **Reveal contact** can read them.
- **Who runs it?** Volunteers. Profiles are grouped into regional hubs (UK, Canada, the US and so on), each looked after by its own maintainers. The website searches all of them at once. You can change or remove your profile at any time.

---

## Under the hood

```
                       ┌────────────────────────────────────────────┐
                       │  rest-of-us/job-circles  (this repo)       │
                       │  index.html ── reads ──▶ hubs.json         │
                       │      │                                     │
                       │      └─ fetches every hub's profiles.json, │
                       │         indexes them in the browser        │
                       │         (Fuse.js) and renders cards        │
                       └───────────────┬────────────────────────────┘
          ┌─────────────────┬──────────┴──────┬──────────────────┐
          ▼                 ▼                 ▼                  ▼
     hub-uk            hub-canada         hub-latam           hub-apac
  profiles/*.json   profiles/*.json   profiles/*.json   profiles/*.json
  → profiles.json   → profiles.json   → profiles.json   → profiles.json
```

| File | Purpose |
| --- | --- |
| [`index.html`](index.html) | The single-page search UI: Tailwind CSS, Fuse.js and vanilla JavaScript, all loaded from CDNs. |
| [`hubs.json`](hubs.json) | Registry of regional hubs and their feed URLs. |
| [`profiles/schema.json`](profiles/schema.json) | JSON Schema (draft 2020-12) that every candidate profile must pass. |
| [`join.html`](join.html) | Profile builder: a form that checks entries as you type and opens a pre-filled GitHub pull request. |
| [`profiles/demo.json`](profiles/demo.json) | Fictional sample profiles so the UI works before any hub goes live. They are labelled "Sample" in the UI. |
| [`profiles/community/`](profiles/community) | Community hub for regions without a hub yet. |
| [`circles.html`](circles.html) · [`start-circle.html`](start-circle.html) | Peer circle finder (map, in-person-first matching) and the form to start a circle. |
| [`circles/`](circles) | Circle schema, sample circles, and one file per circle in `circles/entries/`, merged into `circles/index.json`. |
| [`js/`](js) | Shared scripts: `hubs.js` (hub discovery, federation and IndexedDB caching), `geo.js` (city search, distances, timezones) and `jobflo.js` (JobFlo cross-promotion copy). |
| [`SELF_HOSTING.md`](SELF_HOSTING.md) | Running your own node or hub, federating with others, and handling profile PRs and removals safely. |
| [`.github/workflows/`](.github/workflows) | `validate-submissions.yml` checks profile and circle PRs; `build-feeds.yml` rebuilds the feeds on merge. |

---

## For candidates

**The easy way: use the [profile builder](https://rest-of-us.github.io/job-circles/join.html).** Fill in the form, which checks your entries as you type, and click **Submit on GitHub**. GitHub opens with your file already filled in, and you click **Propose changes** and then **Create pull request**. You only need a free GitHub account. If your region's hub isn't open yet, your profile goes to the community hub in this repository and moves to the regional hub once it launches.

**The manual way:**

1. **Find your hub** in [`hubs.json`](hubs.json) or under [Hubs & feeds](https://rest-of-us.github.io/job-circles/#hubs) on the site. If your region has no hub yet, use [`profiles/community/`](profiles/community) in this repository.
2. **Fork the hub repository** and create `profiles/<your-github-handle>.json`. Start from one of the entries in [`profiles/demo.json`](profiles/demo.json).
3. **Write about impact.** Fill in `major_impact` with the systems you designed and what changed because of them: scale, latency, cost, reliability, team growth. Leave out dates; the schema rejects them.
4. **Validate locally** (optional; CI does this too):
   ```bash
   npx -p ajv-cli -p ajv-formats ajv validate --spec=draft2020 -c ajv-formats \
     -s https://rest-of-us.github.io/job-circles/profiles/schema.json \
     -d profiles/<your-github-handle>.json
   ```
5. **Open a pull request** from your own GitHub account. Automated checks confirm that the PR author matches the `github` field in your profile, then a maintainer merges it. Your profile shows up on the site within a few minutes.

To **update** your profile, use **Import your JSON file** in the profile builder, edit, and submit again, or open a PR by hand. To **remove** it, open a PR that deletes the file, or ask a hub maintainer in an issue.

> **Privacy:** everything in your profile is public and can be copied by anyone.
>
> - **Handle instead of a name.** You can use a handle instead of your legal name. Your identity is anchored by the GitHub account that submits the profile and by peer vouches.
> - **Encoded contact details.** Email, Proton alias, Matrix and Signal contacts go in `contact_methods` and are base64-encoded, so they never appear as plain text for crawlers to harvest. The site decodes them only when a visitor clicks **Reveal contact**. This is obfuscation, not encryption: a determined person can still decode them. Plain email addresses aren't accepted in schema 1.1.

### Peer vouches

A vouch is a short, signed statement from someone who worked with you.

1. The **voucher**, not the candidate, forks the hub and adds an entry to your profile's `vouches` array:
   ```json
   {
     "vouched_by": "Priya Shah",
     "vouched_by_github": "priyashah",
     "relationship": "peer",
     "statement": "Led the ledger migration I worked on; the most careful engineer I've shipped with.",
     "date": "2026-10-14"
   }
   ```
2. They open the PR **from their own GitHub account**. Maintainers merge only if the PR author matches `vouched_by_github`.
3. After merge, a maintainer (or the hub's CI) sets `verification_url` to the merged PR, which shows up as a **Verify →** link on the profile.

Valid relationships are `manager`, `direct_report`, `peer`, `tech_lead`, `client`, `open_source_collaborator` and `mentor`.

#### Signed vouches (optional)

A signed vouch proves it was written by the holder of a key on the voucher's GitHub account, and that it hasn't been edited or moved to another profile since. After adding your vouch entry:

```bash
# SSH: uses a key that's on github.com/<you>.keys
node scripts/sign-vouch.mjs profiles/community/<candidate>.json <your-github> ~/.ssh/id_ed25519
```

The script signs the canonical vouch text (see [`scripts/vouch-message.mjs`](scripts/vouch-message.mjs)) and fills in `signature_format`, `public_key_fingerprint` and `signature`.

For OpenPGP, the key must be on `github.com/<you>.gpg`:

```bash
node scripts/vouch-message.mjs profiles/community/<candidate>.json <your-github> > vouch.txt
gpg --armor --detach-sign vouch.txt          # paste vouch.txt.asc into "signature"
```

Then set `"signature_format": "openpgp"` and your 40-character key fingerprint.

The pull-request check verifies every new or changed signature against your public keys on GitHub and rejects any mismatch. Signed vouches show a **Signed** badge on the site.

---

## Peer circles

A peer circle is a small group (4–8) of senior people between roles who meet weekly or fortnightly to share leads, practise interviews and keep each other accountable, in the spirit of [Never Search Alone](https://www.neversearchalone.org/)'s Job Search Councils.

What's different here is that **matching is geographic first**. Most job-search advice and groups default to the US market. A circle in your own city shares your recruiters, salary bands, employment law and timezone, and can meet in person.

**Finding a circle** ([circles.html](https://rest-of-us.github.io/job-circles/circles.html)): type your city or use your location. Results come in three tiers:

1. **Meet in person:** in-person and hybrid circles within your chosen radius (10–200 km), ordered by open seats, then distance.
2. **Online in your region:** online and hybrid circles in your country, or within about 3,000 km and two hours of your timezone.
3. **Further away:** everything else, collapsed.

If there's nothing nearby, the page offers to **start a circle in your city**, so the next person who searches there finds it.

**Privacy model:** circles are public; seekers are not.

- Your location is only used in your browser. "Use my location" never leaves the page, and city search sends only the typed name to [Open-Meteo's geocoding API](https://open-meteo.com/en/docs/geocoding-api).
- Circles store the city centre (coordinates rounded to ~1 km), never a meeting address.
- Only organizers are named. Circles publish a member count, never a member list.
- People ask to join privately, by email or a form link. There's no public issue thread.

**Starting a circle** ([start-circle.html](https://rest-of-us.github.io/job-circles/start-circle.html)): fill in the form and click **Submit on GitHub**. A pull request adds `circles/entries/<id>.json`. The automated checks confirm that the circle passes [`circles/schema.json`](circles/schema.json), that the PR author is an organizer, and that coordinates are city-level. On merge, `circles/index.json` is rebuilt and the circle appears on the map. Organizers keep seats and status up to date with the "Organizer? Update seats" link on their circle.

## Launching a regional hub

Anyone can start a hub for a region that doesn't have one, or a region-specific community (a country, or a city).

1. **Create the repo.** _A `hub-template` repository is planned but doesn't exist yet. Until then, open an issue on this repo to coordinate._ Once it exists: go to `rest-of-us/hub-template` and click **Use this template**. Name it `hub-<region>` (for example `hub-nordics`). Hubs can live under the `rest-of-us` account (ask in an issue) or in your own account or organization.
2. **Enable GitHub Pages:** go to *Settings → Pages → Build and deployment → Source: GitHub Actions*.
3. **Check the workflows.** The template ships two:
   - `validate.yml` runs on every PR. It validates each `profiles/*.json` against the central schema, checks that the file name matches `id`, and checks that the PR author matches the profile's `github` handle (or the `vouched_by_github` of any added vouch).
   - `publish.yml` runs on every push to `main`. It merges all profiles into a single `profiles.json` and deploys it to Pages.
4. **Add maintainers.** Put at least two people in `CODEOWNERS` so reviews aren't blocked on one person.
5. **Register the hub.** Open a PR against this repository adding an entry to [`hubs.json`](hubs.json):
   ```json
   {
     "id": "nordics",
     "name": "Nordics",
     "region": "europe",
     "description": "Senior tech talent in Denmark, Finland, Iceland, Norway and Sweden.",
     "repository": "https://github.com/rest-of-us/hub-nordics",
     "profiles_url": "https://rest-of-us.github.io/hub-nordics/profiles.json",
     "timezones": ["UTC+1", "UTC+2"],
     "status": "active"
   }
   ```

### Feed format

The UI accepts any of these at `profiles_url`:

- an array of profile objects (recommended, and what the template generates);
- an object with a `profiles` array: `{ "profiles": [ … ] }`;
- an array of relative URLs to individual profile files: `["profiles/ada.json", …]`.

Feeds must be served with CORS enabled. GitHub Pages and `raw.githubusercontent.com` both do this by default. If a hub is unreachable, the UI shows it as *offline* and keeps showing results from the other hubs.

Hub `status` is one of `active`, `planned` (listed as "Coming soon" and not fetched; submissions for that region go to the community hub), `demo` (results labelled as samples) or `disabled` (skipped). When a planned hub's repository and feed are live, change its status to `active`.

---

## For recruiters

### Use the website

Go to **https://rest-of-us.github.io/job-circles** and:

- search across skills, systems, roles and locations (fuzzy matching, so `kafka` finds `event streaming with Kafka`);
- filter by **skill tags**, **timezone range** (with Americas / EMEA / APAC overlap presets), **work preference** (B2B contract, full-time via EOR, …), **seniority** and **peer-vouched** status;
- click **Reveal contact** to decode a candidate's private contact methods (email, Proton alias, Matrix, Signal) in your browser, or use their public booking link or LinkedIn;
- click **JSON** on a card to download that profile. To save your filtered shortlist, use **Export CSV** (includes decoded contacts, for your own tracker), **JSON** (profiles as published), or **Atom feed** (`feed.xml`, for feed readers and ATS importers; no contact details, entries link back to each profile);
- add **other hubs or registries** under *Hubs & feeds*. They're saved in your browser and searched alongside the defaults. Responses are cached in IndexedDB (1 hour by default, adjustable);
- share a specific profile with **Copy link** (`#profile=<hub>:<id>`);
- click **Copy search link** to share a search. All filters are stored in the URL.

### Query the raw feeds

Every hub is plain JSON over HTTPS. No API key, no rate-limited API.

```bash
# List all hub feeds
curl -s https://rest-of-us.github.io/job-circles/hubs.json | jq -r '.hubs[].profiles_url'

# Staff+ engineers open to B2B contracts who know Kubernetes, with contacts decoded
curl -s https://rest-of-us.github.io/job-circles/profiles/community.json | jq '
  .[] | select(
    (.seniority | IN("staff","principal","distinguished")) and
    (.work_preferences | index("contract_b2b")) and
    (.core_competencies | index("kubernetes"))
  ) | {who: (.name // .handle), headline, timezone,
       contact: [.contact_methods[]? | {type, value: (.value | @base64d)}]}'
```

```js
// Pull every profile from every hub (Node 18+ or a browser)
const base = 'https://rest-of-us.github.io/job-circles/';
const { hubs } = await (await fetch(base + 'hubs.json')).json();
const results = await Promise.allSettled(
  hubs.filter(h => h.status === 'active')
      .map(h => fetch(new URL(h.profiles_url, base)).then(r => r.json()))
);
const profiles = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
```

Please be a good citizen: contact people about roles that match their stated preferences, and don't resell or bulk-republish the data.

---

## Running locally

The site uses `fetch()`, so open it through a local web server instead of `file://`. Every path is relative, so a fork or a copy on any static host works unchanged. See [SELF_HOSTING.md](SELF_HOSTING.md) for running your own node or hub.

```bash
git clone https://github.com/rest-of-us/job-circles.git
cd job-circles
python3 -m http.server 8000
# open http://localhost:8000
```

### Analytics

The official site (`rest-of-us.github.io`) uses Google Analytics to count visits ([`js/analytics.js`](js/analytics.js)). The script checks the hostname first, so local development, forks and self-hosted copies load no analytics. Analytics never receives profile contact details: they're only decoded in the page when a visitor clicks **Reveal contact**, and that isn't sent anywhere.

### Deploying

The site deploys from the `main` branch root. Go to *Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)`*. The empty `.nojekyll` file tells GitHub Pages to serve the files as they are.

---

## Contributing

Issues and PRs are welcome, especially:

- new regional hubs;
- accessibility and internationalisation improvements to the UI;
- proposals for schema changes. Open an issue first, because every hub depends on the schema. Changes that would bring back age proxies (dates, tenure, graduation years) will not be accepted.

## License

[MIT](LICENSE). Profiles in each hub belong to the people who published them.
