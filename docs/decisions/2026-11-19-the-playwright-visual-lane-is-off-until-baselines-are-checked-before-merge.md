# The Playwright visual lane is off on every event until its baselines are checked before merge

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** Harshit Shah
- **Guard:** `.github/scripts/tests/test_playwright_cache_assets.py` (`check-changes.outputs.visual` is the constant `'false'`)
- **Related:** #38194, #38195, open-metadata/openmetadata-collate#8709, open-metadata/openmetadata-collate#8710; revises the visual half of ADR:2026-10-23-playwright-visual-and-rdf-are-blocking-lanes-on-the-regular-bundle

## Context
The visual lane ran only after merge: in the merge queue, the scheduled run and release-nightly
dispatches, never on a PR check. OSS no longer uses a merge queue, so in practice the first run
was the nightly. Every change that altered rendering (an icon, a column, a 4px spacing change)
merged with stale baselines, and the nightlies failed until someone refreshed them on CI. The
2.1 release nightly of 2026-11-18 failed all 7 visual shards (36 tests) this way. Authors had no
local way to see which scenes a change affected or to refresh them before committing, because
the baselines are only valid when captured on the CI Linux renderer.

## Decision
- `check-changes.outputs.visual` in `playwright-e2e-reusable.yml` is the constant `'false'` on
  every event: pull request, merge queue, schedule, release nightly and manual dispatch.
- Collate turns off its own visual project in every CI run as well (`e2e-postgres.yml` and
  `playwright.config.ts`).
- The specs, baselines, fixtures, the `visual` paths filter, `build-visual-ui` and
  `yarn playwright:visual` stay, so the lane can return without rebuilding it.

## Consequences
No CI run catches a rendering regression; reviewers check UI changes by hand. The baselines will
drift and need a full refresh when the lane returns. Turn it back on (restore the previous
`visual:` expression and the Collate project) only once a change's affected scenes are checked
and their baselines refreshed before merge: on the PR itself, or locally on a renderer that
matches CI.
