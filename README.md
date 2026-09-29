# ci/playwright-timing

Data-only branch. Never merged anywhere, and it doesn't need to follow `main`.

- `timing-baseline.json`: per-test Playwright durations used for duration-aware
  shard planning. It's written by the `Refresh timing baseline` job in
  `.github/workflows/playwright-postgresql-e2e.yml` after each successful full
  run on `main` (daily schedule or `workflow_dispatch`), and read by
  `plan-playwright` in `playwright-e2e-reusable.yml`.
- `main`'s `.github/playwright/timing-baseline.json` stays the fallback, and is
  where a PR seeds timings for a new spec.

This lives outside `main` because `main` only accepts changes through the merge
queue, and a push to `main` would reset every in-flight queue entry.
