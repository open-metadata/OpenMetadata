# Browser tests run by impact on pull requests and in full in the merge queue

- **Status:** Proposed
- **Revisions:** v1 2026-11-23 (initial); v2 2026-11-25 (map from any passing full run; full run on main every 6 hours)
- **Deciders:** Chirag Madlani
- **Guard:** `scripts/select-browser-tests.test.mjs` (selection rules); `ui-browser-tests.yml` (a run on
  main every 6 hours, a manual run and the merge queue run every test file)
- **Related:** open-metadata/OpenMetadata#36198,
  ADR:2026-10-28-page-behaviour-is-tested-in-vitest-browser-mode-and-e2e-tests-leave-by-marking

## Context
The browser suite grows as Playwright checks move into it. Running every file on every UI pull request
does not scale, and the static import graph cannot narrow the run: lazy imports tie about 1,000 modules
into one cycle, so almost every file reaches almost every test.

## Decision
- A pull request runs only the test files that executed the code it changes. A full run records, per test
  file, the source files it executed (coverage counters, `src/test/browser/impact.ts`). A fully passing
  full run publishes that map as an artifact; it is never committed. Pull requests download the newest
  one from the scheduled or manual run on main, a merge-queue entry, or a pull request that ran everything, counting only runs
  from this repository's own branches: a fork's map comes from unreviewed code and could hide tests.
- Selection also follows the test helpers a test imports, the direct imports of executed files, changed
  screenshot baselines, and changed `en-us.json` keys. A deleted source file still selects the tests that
  loaded it.
- Everything runs when the map is missing, or a change touches test setup, the Vite/Vitest config,
  dependencies, global styles (`src/styles/`) or the selection script.
- Core components are treated like a library on pull requests: a change there runs core's own tests and
  build, not the browser tests.
- Main runs every test file every 6 hours, and on demand (`workflow_dispatch`), which keeps the map fresh
  and surfaces a selection miss, or a core change that breaks the app, within hours of the merge. A run per
  push was rejected as too costly for the UI merge rate. OpenMetadata
  merges without the merge queue (none since 2026-11-03); while the queue is on, its full run catches the
  same miss before main.
- If selection itself fails, the reporting check fails rather than being skipped, since a skipped required
  check would pass with no tests run.
- Shards: at most 5 runners, 26 test files per runner when only some run (the full suite of about 130
  files fits 5 runners in roughly 10 minutes).

## Consequences
UI pull requests run a fraction of the suite, and changes no browser test executes run none (the PR comment
lists that code). Without the merge queue, a miss, including a core change that breaks the app, lands on
main and fails the next scheduled full run (up to 6 hours later) rather than blocking the merge.
Revisit if full-run failures from selection misses become common, if the merge queue returns, or if the import cycle is broken
(then the static graph could select on its own).
