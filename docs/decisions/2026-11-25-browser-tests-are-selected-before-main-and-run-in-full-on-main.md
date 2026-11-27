# Browser tests are selected before main and run in full on main

- **Status:** Proposed
- **Revisions:** v1 2026-11-25 (initial); v2 2026-11-26 (pull requests and queue entries call this workflow through `ui-ci.yml`; queue maps come from `ci-merge-queue.yml` runs)
- **Deciders:** Chirag Madlani
- **Guard:** `scripts/select-browser-tests.test.mjs` (selection rules); `ui-browser-tests.yml` (pull requests
  and merge-queue entries select; the scheduled run on main runs every test file and reports a failure to
  #pw-health)
- **Related:** open-metadata/OpenMetadata#38673, #38679,
  ADR:2026-10-28-page-behaviour-is-tested-in-vitest-browser-mode-and-e2e-tests-leave-by-marking;
  supersedes ADR:2026-11-23-browser-tests-run-by-impact-on-pull-requests-and-in-full-in-the-merge-queue

## Context
The browser suite grows as Playwright checks move into it, so a pull request runs only the test files
that executed the code it changes. The static import graph cannot narrow the run on its own: lazy imports
tie about 1,000 modules into one cycle. Selection therefore reads an impact map, which records the source
files each test file executed at runtime.

The previous record took that map only from merge-queue runs and ran the whole suite in the queue.
OpenMetadata has merged without the merge queue since 2026-11-03, so no map was ever published and every
UI pull request ran everything. Running the whole suite on every merge, in the queue or on push to main,
costs a full run per merge.

## Decision
- A pull request, and a merge-queue entry, runs only the test files that executed the code it changes. A
  queue entry diffs from its group's base, so a batched group covers every pull request in it.
- A run records, per test file, the source files it executed (coverage counters,
  `src/test/browser/impact.ts`). The map is an artifact and is never committed. Only a passing run on code
  that reached main publishes one: a scheduled or manual run on main writes it afresh, and a selected
  merge-queue entry replaces the entries of the tests it ran. Pull requests do not record or publish
  impact, since their code may never merge.
- Pull requests and queue entries download the newest map from a scheduled or manual run on main, or a
  merge-queue entry, each queried by event so pull-request runs cannot push a good map out of the list.
- Selection also follows the test helpers a test imports, the direct imports of executed files, changed
  screenshot baselines and changed `en-us.json` keys. A deleted source file still selects the tests that
  loaded it. A test file missing from the map always runs.
- Everything runs when the map is missing, or a change touches test setup, the Vite/Vitest config,
  dependencies, global styles (`src/styles/`) or the selection script.
- Core components are treated like a library: a change there runs core's own tests and build, not the
  browser tests.
- Only main runs every test file: every 6 hours, skipped when no UI file changed since the last passing
  full run, and on demand (`workflow_dispatch`). A failed scheduled run posts to #pw-health, since GitHub emails
  only the last person to edit the schedule.
- If selection itself fails, the reporting check fails rather than being skipped, since a skipped required
  check would pass with no tests run.

## Consequences
UI pull requests run a fraction of the suite. What ran, why, the result and the changed code no test executes
are in the run's job summary; PR jobs post no comments (ADR:2026-11-10-pr-jobs-never-receive-credentials). A selection miss, including a core change that breaks the
app, passes the pull request and the merge queue, lands on main, and fails the next scheduled full run (up
to 6 hours later), which posts to #pw-health.

Two known gaps in map freshness, each fixed by the next full run, and neither able to hide a test (a test
missing from the map always runs):
- Two queue entries that start from the same map each publish "that map plus my tests", and the newer one
  wins, losing the other's update. An entry that starts while a full run is still going can likewise
  replace the fresh full map with an older one plus its own tests.
- A queue entry can pass and still leave the queue (a pull request ahead of it fails), yet its map is
  published, from code that did not merge.

Revisit if full-run failures from selection misses become common, or if the import cycle is broken (then
the static graph could select on its own).

## Amendment v2 (2026-11-26)
Pull requests and merge-queue entries no longer trigger `ui-browser-tests.yml` directly. They call it
through `ui-ci.yml`, the `ui` job of `ci-pr.yml` and `ci-merge-queue.yml`
(ADR:2026-11-26-ui-ci-runs-from-the-event-entrypoints-behind-one-required-check), and it starts only
after UI checkstyle passes. A queue entry's map is therefore an artifact of a `ci-merge-queue.yml`
run, and the map lookup queries those runs alongside this workflow's scheduled and manual runs. A
queue run counts only when the whole run passed, Python and the other UI jobs included. The
scheduled and manual full runs on main are unchanged.
