# Circle hub

A hub for a small, peer-vouched circle (up to 8 members by default) in [The Rest of US](https://rest-of-us.github.io/job-circles) directory. Members add their own profile here. GitHub Actions checks every pull request and publishes the merged profiles as a JSON feed on GitHub Pages. The main site searches that feed alongside every other hub.

No server, no database, no cost: just this repository and GitHub Pages.

> **Setting this up?** Follow [SETUP.md](https://github.com/rest-of-us/job-circles/blob/main/SETUP.md) in the main repository. It takes about ten minutes.

## Files

| File | Purpose |
| --- | --- |
| `hub.json` | This hub's settings: name, region, member limit (`max_members`) and reviewers. It's also the entry you paste into the main `hubs.json` to register. |
| `profiles/<github-username>.json` | One file per member. |
| `.github/workflows/validate-and-build.yml` | Checks PRs, then builds `profiles.json` and deploys it to Pages on merge. |
| `.github/CODEOWNERS` | Who must approve changes. |
| `index.html` | A small landing page at the Pages URL. |

## Adding your profile

1. Fill in the [profile builder](https://rest-of-us.github.io/job-circles/join.html) and click **Download** (or **Copy JSON**) instead of submitting.
2. In this repository, open `profiles/`, click **Add file → Create new file**, and name it `<your-github-username>.json` (lowercase). Paste your profile.
3. Click **Commit changes → Propose changes → Create pull request**.

The checks confirm the profile matches the [shared schema](https://rest-of-us.github.io/job-circles/profiles/schema.json), that you opened the PR for your own profile, and that the circle has a free seat. A maintainer then merges it, and the feed updates within a couple of minutes.

To vouch for a member, edit their file and add your entry to `vouches`, from your own account. See [Peer vouches](https://github.com/rest-of-us/job-circles#peer-vouches).

## Feed

Published at `https://<owner>.github.io/<repo>/profiles.json`: an array of profiles, each one valid against the shared schema. Profiles that fail it are left out of the build.
