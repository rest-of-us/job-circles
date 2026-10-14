# Self-hosting The Rest of US

The Rest of US has no central server. A **node** is a static website that searches hubs. A **hub** is a set of profile files published as JSON. This repository is both: the search UI (`index.html`), plus a community hub (`profiles/community/`) and the peer-circle directory (`circles/`).

This guide covers:

1. [Launching your own node or hub](#1-launch-your-own-node-or-hub)
2. [Federating with other nodes](#2-federate-with-other-nodes)
3. [Running a hub safely](#3-run-a-hub-safely): reviewing pull requests, scrubbing retired profiles, verifying signed vouches
4. [Configuration reference](#4-configuration-reference)

Everything the site fetches uses relative paths (`./hubs.json`, `./profiles/…`, `./circles/…`), so a fork or a copy on any static host works without code changes.

---

## 1. Launch your own node or hub

### Option A: fork this repository (search UI + hub)

Use this to run a node for a region, community or company, with its own submission flow.

1. **Fork** `rest-of-us/job-circles`, or use *Use this template* if you don't want a fork relationship.
2. **Turn on GitHub Pages:** *Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save*. You need admin rights on the repository. Your site appears at `https://<owner>.github.io/<repo>/` within a minute or two.
3. **Turn on Actions:** forks have workflows switched off. Go to the *Actions* tab and enable them. Under *Settings → Actions → General → Workflow permissions*, allow **Read and write**, because the *Build feeds* workflow commits the rebuilt `profiles/community.json` and `circles/index.json`.
4. **Point submissions at your repository.** Edit `hubs.json`:
   - set `name` to your node's name;
   - in the `community` hub, set `submit.repository` to `<owner>/<repo>`;
   - set `circles.submit.repository` to `<owner>/<repo>`;
   - keep, remove or add entries in `hubs`. Upstream hubs can stay listed, so your visitors see everyone.
5. **Remove the samples** if you don't want them: delete the `demo` entry in `hubs.json` and the file `circles/demo.json`.
6. **Analytics:** `js/analytics.js` only runs on `rest-of-us.github.io`, so your copy loads none. To add your own, change `SITE_HOST` and `MEASUREMENT_ID` in that file.
7. **Update the links** that point at the upstream project: the README, the footer links in the HTML pages, `CODEOWNERS` and the `$id` URLs in the two schemas.
8. **Protect `main`.** See [Reviewing pull requests](#reviewing-pull-requests).

### Option B: a data-only hub

A hub is just a URL that returns profiles. The site accepts any of these at `profiles_url`:

```jsonc
[ { …profile… }, { …profile… } ]          // an array of profiles (recommended)
{ "profiles": [ { …profile… } ] }         // an object with a profiles array
[ "profiles/ada.json", "profiles/kim.json" ]  // URLs, relative to the feed
```

The easiest way to get validation and feed building is to copy these from this repository:

| Copy | Purpose |
| --- | --- |
| `profiles/schema.json` | The rules every profile must pass. |
| `scripts/validate-profiles.mjs`, `scripts/vouch-message.mjs` | PR checks: schema, authorship, vouch signatures. |
| `scripts/build-feed.mjs` | Merges `profiles/*.json` into one feed. |
| `.github/workflows/validate-submissions.yml`, `build-feeds.yml` | Run the above on PRs and on merge. Adjust the paths to match your layout. |

A dedicated `hub-template` repository is planned. Until it exists, copying these files is the supported route.

### Option C: any other static host

GitHub Pages is the default, but any host that serves files works: Netlify, Cloudflare Pages, S3 + CloudFront, nginx, Caddy, and so on. Two requirements:

- **HTTPS.** Browsers block plain-HTTP requests from an HTTPS page. The site accepts `http://` only for `localhost` testing.
- **CORS on JSON files.** Other nodes fetch your feed from their own domain, so serve it with `Access-Control-Allow-Origin: *`. GitHub Pages already does this.

```nginx
# nginx
location ~ \.json$ {
  add_header Access-Control-Allow-Origin "*" always;
  add_header Cache-Control "public, max-age=300";
  default_type application/json;
}
```

```text
# Netlify or Cloudflare Pages: a file named _headers at the site root
/*.json
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=300
```

```caddyfile
# Caddy
@json path *.json
header @json Access-Control-Allow-Origin "*"
```

To test locally, run `python3 -m http.server 8000` in the repository and open `http://localhost:8000`. Same-origin requests don't need CORS.

---

## 2. Federate with other nodes

There are three ways for hubs and nodes to find each other. You can use them together.

### Register with the main directory

Open a pull request against [`rest-of-us/job-circles`](https://github.com/rest-of-us/job-circles) adding your hub to `hubs.json`:

```json
{
  "id": "nordics",
  "name": "Nordics",
  "region": "europe",
  "description": "Senior tech talent in Denmark, Finland, Iceland, Norway and Sweden.",
  "repository": "https://github.com/example/hub-nordics",
  "profiles_url": "https://example.github.io/hub-nordics/profiles.json",
  "submit": { "repository": "example/hub-nordics", "branch": "main", "path": "profiles" },
  "status": "active"
}
```

Use `"status": "planned"` until the feed is live. Planned hubs are listed as *Coming soon*, aren't fetched, and their region's submissions go to the community hub.

### Peer registries

Your `hubs.json` can list other nodes' registries:

```json
"peers": [
  "https://example.github.io/hub-nordics/hubs.json",
  "https://talent.example.org/hubs.json"
]
```

When someone opens your site, it loads your `hubs.json`, then each peer's `hubs.json`, and searches every hub they list.

- **One level deep:** peers of peers are not followed, which prevents loops and runaway fan-out.
- **Limits:** at most 20 registries per page load.
- **Duplicates:** hubs are de-duplicated by feed URL.
- **Labelling:** hubs found this way are labelled *Peer node* in the UI.

To join a federation, add the other nodes to your `peers` and ask them to add yours.

### Visitor-added sources

Anyone can paste a hub feed or a `hubs.json` URL under **Hubs & feeds → Add a hub or registry**. It's saved in that visitor's browser (`localStorage`) and searched alongside the defaults. It's handy for recruiters following a private or niche hub.

### Trust and caching

- **Treat other hubs' data as untrusted input.** The UI escapes all text, keeps only web (`http`/`https`) and `mailto:` links (dropping `javascript:` and other schemes), and caps each hub at 2,000 profiles. Review a node before listing it in `peers`, because you're vouching for it to your visitors.
- **Caching:** visitors cache every response in IndexedDB for 1 hour by default, adjustable from *Don't cache* to 24 hours. If a hub goes offline, they see the last copy, marked as such. Changes you publish can take up to that long to reach returning visitors, plus about 10 minutes of GitHub Pages CDN caching. Visitors can force a reload with **Refresh all now**.

---

## 3. Run a hub safely

### Reviewing pull requests

Contributors submit profiles, vouches and circles as pull requests. The **Validate submissions** workflow checks the following.

**Profiles**
- They match the schema.
- The file name matches the `id`.
- Only the owner (the `github` account) can create, edit or delete a profile.
- Owners can't add vouches; vouchers can only add or change their own.
- New or changed signed vouches verify against the voucher's GitHub keys.

**Circles**
- They match the schema.
- Coordinates are city-level.
- Only organizers can create, edit or delete a circle.

To make this hard to bypass:

1. **The checks run trusted code.** The workflow extracts `scripts/` and both schemas from the **base branch** (`git archive $BASE_SHA`) and runs them against the PR's files. A PR that loosens the schema or edits a validator is still checked against the current rules.
2. **Protect the workflow itself.** On `pull_request` events, GitHub uses the workflow file from the PR, so a PR could edit `.github/workflows/` to skip the checks. Under *Settings → Branches → Branch protection* for `main`:
   - require the **Validate submissions** status check to pass;
   - require pull-request reviews, with **Require review from Code Owners** enabled. The included `.github/CODEOWNERS` covers `.github/`, `scripts/`, the schemas, `hubs.json` and `js/`;
   - keep *Require approval for first-time contributors* on (*Settings → Actions → General*). It's GitHub's default.
3. **Never switch to `pull_request_target`** for these checks. It runs with write access and secrets, which is unsafe for checking out untrusted PR code.
4. **Read the diff.** The checks enforce structure, not content. Look for impersonation, harassment, spam links and personal data that shouldn't be public (home addresses, phone numbers, ID numbers). Maintainers can still merge a failing PR, for example to remove something during moderation.

### Removing a profile

A normal removal is a PR that deletes `profiles/community/<id>.json`. On merge, the feed is rebuilt and the profile disappears from the site:
- right away for new visitors;
- for returning visitors, once their cache expires (1 hour by default);
- on GitHub Pages' CDN, within about 10 minutes.

The file still exists in the Git history. When someone asks for their data to be erased, or something was published by mistake, scrub it from history too:

1. **Install [git-filter-repo](https://github.com/newren/git-filter-repo)** and start from a fresh mirror clone:
   ```bash
   git clone --mirror https://github.com/<owner>/<repo>.git && cd <repo>.git
   ```
2. **Remove the file and redact the person's details everywhere else.** The generated feed `profiles/community.json` contains a copy in every past version, so deleting the file isn't enough. List what to redact, one per line: their GitHub handle, name or handle, the base64 strings from `contact_methods`, and any distinctive text:
   ```text
   # replacements.txt  (literal==>replacement)
   jane-doe==>[removed]
   Jane Doe==>[removed]
   amFuZUBleGFtcGxlLmNvbQ====>[removed]
   ```
   Then run:
   ```bash
   git filter-repo --invert-paths --path profiles/community/jane-doe.json --replace-text replacements.txt
   ```
3. **Force-push.** Temporarily allow force pushes in branch protection, run `git push --force --mirror`, then turn protection back on. Ask every maintainer to re-clone; an old clone would push the data back.
4. **Ask GitHub to purge cached data.** Pull-request refs (`refs/pull/*`) and cached views of old commits survive a force-push. Contact GitHub Support with the repository and the affected commit SHAs, as described in [Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).
5. **Tell peers.** Nodes that list your hub stop showing the profile once their visitors' caches expire. Anyone who forked or cloned the repository before the scrub still has a copy, and that can't be recalled. Say this plainly to the person who asked for removal.

### Verifying signed vouches

CI checks every new or changed signed vouch before merge. To check one by hand, first rebuild the exact text that was signed:

```bash
node scripts/vouch-message.mjs profiles/community/jane-doe.json bob > vouch.txt
jq -r '.vouches[] | select(.vouched_by_github | ascii_downcase == "bob") | .signature' \
  profiles/community/jane-doe.json > vouch.sig
```

Then verify it, depending on the `signature_format`.

**SSH:** check against bob's SSH keys on GitHub:

```bash
curl -s https://github.com/bob.keys | sed 's/^/bob namespaces="the-rest-of-us-vouch" /' > allowed_signers
ssh-keygen -Y verify -f allowed_signers -I bob -n the-rest-of-us-vouch -s vouch.sig < vouch.txt
# Good "the-rest-of-us-vouch" signature for bob with ED25519 key SHA256:…
```

**OpenPGP:** check against bob's GPG keys on GitHub:

```bash
curl -s https://github.com/bob.gpg | gpg --import
gpg --verify vouch.sig vouch.txt
```

Compare the reported key fingerprint with the vouch's `public_key_fingerprint`.

- **Key rotation:** if a voucher later removes the key from GitHub, the signature can no longer be checked against their current keys. The merge-time CI check is the record that it was valid when accepted.
- **What the signature covers:** the canonical text in `scripts/vouch-message.mjs`, which includes the candidate's profile `id`, the voucher, the relationship, the date and the statement. Editing any of these, or copying the vouch onto another profile, breaks the signature.

---

## 4. Configuration reference

`hubs.json` at the site root is the only configuration file.

```jsonc
{
  "registry_version": "1.1",
  "name": "The Rest of US",                      // shown when other nodes list you as a peer
  "profile_schema": "./profiles/schema.json",
  "circles": {
    "feed": "./circles/index.json",
    "schema": "./circles/schema.json",
    "submit": { "repository": "owner/repo", "branch": "main", "path": "circles/entries" }
  },
  "peers": [],                                   // other nodes' hubs.json URLs (followed one level deep)
  "hubs": [
    {
      "id": "community",                         // unique within this registry
      "name": "Community (all regions)",
      "region": "global",                        // uk | europe | canada | us | latam | apac | africa | middle-east | global
      "description": "…",
      "repository": "https://github.com/owner/repo",
      "profiles_url": "./profiles/community.json",   // relative to this hubs.json, or absolute
      "submit": { "repository": "owner/repo", "branch": "main", "path": "profiles/community" },
      "always_open": true,                       // receives submissions for regions without an open hub
      "status": "active"                         // active | planned | demo | disabled
    }
  ]
}
```

| Status | Behaviour |
| --- | --- |
| `active` | Fetched and searched. Accepts submissions if `submit` is set and the repository exists. |
| `planned` | Shown as *Coming soon*. Not fetched. Its region's submissions go to the `always_open` hub. |
| `demo` | Fetched, and its profiles are labelled *Sample*. Never receives submissions. |
| `disabled` | Ignored. |

Visitor settings live in their browser:

| Key | Contents |
| --- | --- |
| `localStorage` `trou-custom-hubs` | Hubs and registries they added. |
| `localStorage` `trou-cache-ttl-min` | Cache lifetime in minutes. |
| IndexedDB `trou-cache` | Cached responses. |

They can clear any of these from the *Hubs & feeds* section, or with their browser's site-data controls.
