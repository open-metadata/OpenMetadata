# Browser tests run by impact on pull requests and in full in the merge queue

- **Status:** Superseded by ADR:2026-11-25-browser-tests-are-selected-before-main-and-run-in-full-on-main
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `scripts/select-browser-tests.test.mjs` (selection rules); `ui-browser-tests.yml` (the merge
  queue runs every test file when a queued change touches the UI)
- **Related:** open-metadata/OpenMetadata#36198,
  ADR:2026-10-28-page-behaviour-is-tested-in-vitest-browser-mode-and-e2e-tests-leave-by-marking

## Context
The browser suite grows as Playwright checks move into it. Running every file on every UI pull request
does not scale, and the static import graph cannot narrow the run: lazy imports tie about 1,000 modules
into one cycle, so almost every file reaches almost every test.

## Decision
- A pull request runs only the test files that executed the code it changes. A full run records, per test
  file, the source files it executed (coverage counters, `src/test/browser/impact.ts`). Only a fully
  passing merge-queue run publishes that map, as an artifact pull requests download.
- Selection also follows the test helpers a test imports, the direct imports of executed files, changed
  screenshot baselines, and changed `en-us.json` keys. A deleted source file still selects the tests that
  loaded it.
- Everything runs when the map is missing, or a change touches test setup, the Vite/Vitest config,
  dependencies, global styles (`src/styles/`) or the selection script.
- Core components are treated like a library on pull requests: a change there runs core's own tests and
  build, not the browser tests.
- The merge queue runs every test file whenever the queued change touches the UI or core components, so a
  selection miss, or a core change that breaks the app, cannot reach main.
- If selection itself fails, the reporting check fails rather than being skipped, since a skipped required
  check would pass with no tests run.
- Shards: at most 5 runners, 26 test files per runner when only some run (the full suite of about 130
  files fits 5 runners in roughly 10 minutes).

## Consequences
UI pull requests run a fraction of the suite, and changes no browser test executes run none (the PR comment
lists that code). A miss, including a core change that breaks the app, is caught in the merge queue rather
than on the pull request.
Revisit if merge-queue failures from selection misses become common, or if the import cycle is broken
(then the static graph could select on its own).
