# Browser tests run by impact on pull requests and in full in the merge queue

- **Status:** Proposed
- **Revisions:** v1 2026-11-23 (initial); v2 2026-11-25 (the merge queue selects too; the only full run is on main every 6 hours or by hand, a selected merge-queue entry refreshes the map for the tests it ran; maps come only from code that reached main; a scheduled run with no UI change is skipped. The slug predates this)
- **Deciders:** Chirag Madlani
- **Guard:** `scripts/select-browser-tests.test.mjs` (selection rules); `ui-browser-tests.yml` (pull requests and
  merge-queue entries select; the run on main every 6 hours, or by hand, runs every test file)
- **Related:** open-metadata/OpenMetadata#36198,
  ADR:2026-10-28-page-behaviour-is-tested-in-vitest-browser-mode-and-e2e-tests-leave-by-marking

## Context
The browser suite grows as Playwright checks move into it. Running every file on every UI pull request
does not scale, and the static import graph cannot narrow the run: lazy imports tie about 1,000 modules
into one cycle, so almost every file reaches almost every test.

## Decision
- A pull request, and a merge-queue entry, runs only the test files that executed the code it changes. A
  full run records, per test file, the source files it executed (coverage counters, `src/test/browser/impact.ts`). Every passing run on
  main or in the merge queue publishes the map as an artifact; it is never committed. A full run writes it
  afresh, and a selected merge-queue entry replaces the entries of the tests it ran, so the map stays
  current between full runs. Pull requests and queue entries download the newest one from code that reached main: a
  scheduled or manual run on main, or a merge-queue entry. A pull request's map reflects code that may
  never merge, or a fork's unreviewed code, and could hide tests from later pull requests.
- Selection also follows the test helpers a test imports, the direct imports of executed files, changed
  screenshot baselines, and changed `en-us.json` keys. A deleted source file still selects the tests that
  loaded it.
- Everything runs when the map is missing, or a change touches test setup, the Vite/Vitest config,
  dependencies, global styles (`src/styles/`) or the selection script.
- Core components are treated like a library on pull requests: a change there runs core's own tests and
  build, not the browser tests.
- Only main runs every test file: every 6 hours, and on demand (`workflow_dispatch`). That run keeps the
  map fresh and surfaces a selection miss, or a core change that breaks the app, within hours of the merge.
  A scheduled run is skipped when no UI file changed since the last passing full run. The merge queue
  selects like a pull request rather than running everything, and a run per push to main was rejected as
  too costly for the UI merge rate.
- If selection itself fails, the reporting check fails rather than being skipped, since a skipped required
  check would pass with no tests run.
- Shards: at most 5 runners, 26 test files per runner when only some run (the full suite of about 130
  files fits 5 runners in roughly 10 minutes).

## Consequences
UI pull requests run a fraction of the suite, and changes no browser test executes run none (the PR comment
lists that code). A miss, including a core change that breaks the app, passes the pull request and the
merge queue, lands on main and fails the next full run (up to 6 hours later) rather than blocking the merge.
Revisit if full-run failures from selection misses become common, or if the import cycle is broken
(then the static graph could select on its own).
