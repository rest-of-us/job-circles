# United States profiles

Profiles for the United States hub. Each file is `<github-username>.json`, must pass [`../schema.json`](../schema.json) and must have `"region": "us"`.

The easiest way to add one is the form at https://rest-of-us.github.io/job-circles/join.html. Pick your country and it sends your profile here, fills in the file for you and opens a pull request.

When a pull request is merged, the **Build feeds** workflow merges every file here into `../us.json`, which the site reads.
