# Setting up a circle hub

A **circle hub** is a small GitHub repository where up to eight people keep their profiles. They vouch for each other, and recruiters find them through the main [The Rest of US](https://rest-of-us.github.io/job-circles) search. It costs nothing to run: GitHub Actions checks the pull requests, and GitHub Pages serves the feed.

You'll need a free GitHub account and about ten minutes. You don't need to install anything if you use the GitHub website.

1. [Create your hub repository](#1-create-your-hub-repository)
2. [Fill in hub.json](#2-fill-in-hubjson)
3. [Name your reviewers](#3-name-your-reviewers)
4. [Turn on GitHub Pages and protect main](#4-turn-on-github-pages-and-protect-main)
5. [Add the first profiles](#5-add-the-first-profiles)
6. [Register your circle with the main directory](#6-register-your-circle-with-the-main-directory)
7. [Keeping it healthy](#7-keeping-it-healthy)

---

## 1. Create your hub repository

The template lives in the [`hub-template/`](hub-template) folder of this repository. Copy it into a new repository of your own:

```bash
npx degit rest-of-us/job-circles/hub-template hub-my-circle
cd hub-my-circle
git init -b main && git add -A && git commit -m "Start circle hub"
gh repo create hub-my-circle --public --source . --push
```

No terminal? Download the [repository ZIP](https://github.com/rest-of-us/job-circles/archive/refs/heads/main.zip), create an empty public repository on GitHub, and upload the contents of the `hub-template` folder with **Add file → Upload files**. Upload the hidden `.github` folder too. If your file browser hides it, show hidden files (on a Mac, press `Cmd+Shift+.`).

Name the repository `hub-<something>`, for example `hub-lisbon-product-eng`. It must be **public**, so other sites can read the feed.

## 2. Fill in hub.json

`hub.json` describes your circle. Edit it on GitHub (the pencil icon) or locally:

```json
{
  "id": "lisbon-product-eng",
  "name": "Lisbon Product & Engineering",
  "region": "europe",
  "description": "Eight senior engineers, designers and product managers in and around Lisbon.",
  "repository": "https://github.com/your-name/hub-lisbon-product-eng",
  "profiles_url": "https://your-name.github.io/hub-lisbon-product-eng/profiles.json",
  "timezones": ["UTC", "UTC+1"],
  "status": "active",
  "maintainers": ["your-name", "a-co-maintainer"],
  "max_members": 8,
  "submit": { "repository": "your-name/hub-lisbon-product-eng", "branch": "main", "path": "profiles" }
}
```

| Field | What to put |
| --- | --- |
| `id` | Lowercase letters, numbers and dashes. It must be unique in the main directory. |
| `region` | One of `uk`, `europe`, `canada`, `us`, `latam`, `apac`, `africa`, `middle-east`, or `global`. If you pick a region, profiles in your hub must use the same `region`; `global` accepts any. |
| `profiles_url` | `https://<owner>.github.io/<repo>/profiles.json`. Replace both parts with your account and repository name. |
| `max_members` | The size cap that the checks enforce. 8 keeps a circle small enough that everyone knows everyone. |
| `maintainers` | GitHub usernames of the people who review profile PRs. |

The file follows the hub entry in [`hubs.schema.json`](hubs.schema.json), and pull requests that change it are checked against that schema.

## 3. Name your reviewers

Edit `.github/CODEOWNERS` and replace `@OWNER` with your maintainers' usernames, for example `@your-name @a-co-maintainer`. Two or more is best, so a review never waits on one person. Add them as collaborators with write access under *Settings → Collaborators*.

## 4. Turn on GitHub Pages and protect main

1. **Pages:** *Settings → Pages → Build and deployment → Source: **GitHub Actions***.
2. **Run the first build:** *Actions → Validate and build → Run workflow*. When it finishes, open `https://<owner>.github.io/<repo>/profiles.json`. You should see `[]`.
3. **Protect `main`:** *Settings → Branches → Add branch protection rule* for `main`:
   - **Require a pull request before merging**, with **Require review from Code Owners** turned on;
   - **Require status checks to pass**, and select **validate**.

The checks use the shared rules from `rest-of-us/job-circles` (the profile schema, owner-only edits, vouch rules and signature checks), fetched fresh on every run, so your hub follows the same rules as everyone else. To update on your own schedule instead, set `UPSTREAM_REF` in `.github/workflows/validate-and-build.yml` to a commit SHA.

## 5. Add the first profiles

Each member, from their own GitHub account:

1. fills in the [profile builder](https://rest-of-us.github.io/job-circles/join.html) and clicks **Download**;
2. opens your repository's `profiles/` folder, clicks **Add file → Create new file**, names it `<their-github-username>.json` and pastes the profile;
3. clicks **Propose changes → Create pull request**.

On every pull request, the **validate** check confirms that:
- the file matches the [profile schema](profiles/schema.json), which has no fields for graduation dates, employment dates or years of experience;
- the person opening the PR owns the profile;
- the profile's region matches the hub's;
- the circle still has a seat.

A maintainer then reviews the profile itself and merges it. The **build** job publishes the new `profiles.json` a minute or two later.

Vouches work the same way as in the main directory: the voucher edits the member's file from their own account. See [Peer vouches](README.md#peer-vouches).

## 6. Register your circle with the main directory

Once `profiles.json` loads in your browser, add your circle to the main search:

1. Go to [`hubs.json`](https://github.com/rest-of-us/job-circles/blob/main/hubs.json) in `rest-of-us/job-circles` and click the pencil icon. GitHub offers to fork the repository for you.
2. Paste the contents of your `hub.json` as a new entry at the end of the `"hubs"` list. Remember the comma after the entry before it.
3. Click **Propose changes → Create pull request**, and say a sentence about your circle.

The **Validate submissions** check confirms that the registry still matches [`hubs.schema.json`](hubs.schema.json), and that your `id` and feed URL aren't already taken. A project maintainer merges it. Your circle then appears under *Hubs & feeds* and in every search.

Not ready to register yet? Anyone can still search your circle: paste your `profiles_url` under **Hubs & feeds → Add a hub or registry** on the site. That's saved only in their own browser.

## 7. Keeping it healthy

The main repository runs a **daily health check** ([`aggregate-hubs.yml`](.github/workflows/aggregate-hubs.yml)) on every registered hub. It:

- fetches each feed and validates every profile against the schema;
- flags a hub as **error** if the feed returns an HTTP error, times out, or isn't a list of profiles;
- flags a hub as **stale** if it has profiles but nothing in it has changed for **90 days**. It uses the newest profile `updated` or vouch `date`, falling back to the feed's `Last-Modified` header. A hub with no profiles yet is never flagged stale, so a new circle has time to fill up;
- writes the results, with every valid profile, to [`aggregated-directory.json`](aggregated-directory.json). The site shows this snapshot on first load and keeps showing it for hubs that are down;
- keeps one open issue labelled **hub-health** that lists the hubs needing attention, and closes it when they're healthy again.

To stay healthy, keep the feed online and ask members to bump `updated` in their profile when they refresh it. Stale hubs are still searched; the flag just tells maintainers to check in.

**Closing a circle:** open a PR on `rest-of-us/job-circles` that sets your entry's `status` to `"disabled"` or removes it, then archive your repository. Members who want to stay listed can move their profile file to another hub, or to the [community hub](profiles/community).

**Growing past eight:** raise `max_members` in `hub.json`. Regional hubs use the same template with a larger limit. Small circles stay easier to review and vouch for, though, so many groups prefer to start a second circle.
