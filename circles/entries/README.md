# Circles

One file per peer circle: `<id>.json`, following [`../schema.json`](../schema.json).

The easiest way to add or update one is the form at https://rest-of-us.github.io/job-circles/start-circle.html. It fills in the file and opens a pull request for you.

Rules, checked automatically on every pull request:

- a new circle must be submitted by one of its `organizers`;
- only an existing organizer can edit or delete a circle (that's also how co-organizers get added);
- locations are city-level: coordinates rounded to 2 decimal places, never a meeting address;
- members aren't listed, only `members_count`.

When a PR is merged, the **Build feeds** workflow rebuilds `../index.json`, which the [circle finder](https://rest-of-us.github.io/job-circles/circles.html) reads.
