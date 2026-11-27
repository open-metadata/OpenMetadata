# UI CI runs from the event entrypoints behind one required check

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial), v2 2026-11-27 (shared planning and manual UI selection),
  v3 2026-11-27 (one status gate for every component)
- **Deciders:** Chirag Madlani
- **Guard:** `.github/scripts/tests/test_ci_speed_status_gates.py`; actionlint
- **Related:** ADR:2026-11-11-python-ci-selects-workloads-by-event,
  ADR:2026-11-26-ui-jest-runs-sharded-without-coverage-before-main,
  ADR:2026-11-25-browser-tests-are-selected-before-main-and-run-in-full-on-main

## Context
UI pull requests ran three independent workflows (`UI Checkstyle`, `Jest Coverage`,
`UI Browser Tests`). Each had its own trigger, path filter, setup and status job, and the three
path filters disagreed. A checkstyle failure still ran ~40 runner-minutes of tests that the next
push would cancel. Python had already moved to event-owned entrypoints (`ci-pr.yml`,
`ci-merge-queue.yml`) with one required check per area. A pull request's CI must finish within
50 minutes.

## Decision
- `ci-pr.yml` and `ci-merge-queue.yml` own the UI trigger and the required check. Both call
  `reusable-ci-plan.yml` to select Python, Java and UI workloads from `.github/ci/paths.yml`.
  The planner reads its filters and script from the event commit, including the merge commit on
  pull requests. The `ui` job calls the reusable `ui-ci.yml` and passes the separate Jest decision.
- `ui-ci.yml` runs `lint` (`setup-ui` + the `ui-checkstyle` composite) first. Once it passes,
  `unit` (`setup-ui` + the `ui-unit` composite, the whole Jest suite in four shards) and
  `browser` (the reusable `ui-browser-tests.yml`, which selects by impact and shards) fan out in
  parallel. A lint failure skips the tests (fail fast), on pull requests and in the merge queue,
  and a failed Jest shard cancels the others. Any failed job fails the `ui` job.
- The tests are sharded rather than run as steps on one runner after checkstyle: on one runner a
  dependency change (full Jest plus every browser test) took about an hour, past the 50-minute
  limit. Sharded, the slowest run is checkstyle plus the slowest shard.
- One required check, `ui-tests-status`, verifies `plan` and `ui` through the generic
  `.github/actions/ci-status-gate` composite. A selected job must succeed and an unselected one
  must be skipped, and the expectations must name every dependency. It runs on every non-draft PR because a job skipped by `if` reports success.
  Draft PRs skip all UI jobs.
- Every UI job sets up through `setup-ui`, which restores the installed `node_modules` of the UI and
  core components (keyed on Node, OS/arch, and both `package.json` and `yarn.lock` files) and core
  components' built `dist` (keyed on core sources). A hit skips `yarn install` and the core build,
  about a minute per job; a miss installs as before. Only runs on main save these caches; pull
  requests and queue entries only restore, so they never add entries to the shared cache budget.
- `ui-browser-tests.yml` keeps its 6-hourly and manual full run on main. Merge-queue entries
  publish the impact map from `ci-merge-queue.yml` runs, so the map lookup queries both workflows.
- Until the `merge-rules` ruleset requires `ui-tests-status`, both entrypoints also report it as
  `ui-checkstyle` and `ui-coverage`. Switch the ruleset after this lands, then delete those jobs.

## Consequences
A UI pull request takes checkstyle time (5–13 minutes on recent runs) plus browser selection, its
slowest shard (up to about 12 minutes) and the report: about 30 minutes at worst, and a lint failure
costs one runner. A queue entry also waits for lint before its tests start, so its failures arrive
in two rounds at most. Every UI job pays its own setup, about 30 seconds when the dependency caches
hit. Browser tests and the core-components tests become merge-blocking for the first time; the
ruleset never required them. A queue entry's impact map counts only when the whole `ci-merge-queue`
run passed. Manual dispatch runs the UI when `workload` is `ui` on either entrypoint or `all`
on `ci-merge-queue`. Python's gates can move onto `ci-status-gate` the same way.

## Amendment: one status gate for every component (2026-11-27)

ADR:2026-11-27-ci-components-share-one-status-gate-that-always-runs makes `ci-status-gate` the
status gate of the Python and backend checks too. `ui-tests-status` keeps its shape. Its tests
moved to `test_ci_speed_status_gates.py`, which runs on pull requests.
