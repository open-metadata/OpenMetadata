# UI CI runs from the event entrypoints behind one required check

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `.github/scripts/tests/test_python_ci.py` (`test_ui_status_expects_a_result_for_every_dependency`
  and the `ci-status-gate` cases of the gate tests); actionlint
- **Related:** ADR:2026-11-11-python-ci-selects-workloads-by-event,
  ADR:2026-11-26-ui-jest-runs-sharded-without-coverage-before-main,
  ADR:2026-11-25-browser-tests-are-selected-before-main-and-run-in-full-on-main

## Context
UI pull requests ran three independent workflows (`UI Checkstyle`, `Jest Coverage`,
`UI Browser Tests`). Each had its own trigger, path filter, setup and status job, and the three
path filters disagreed. A checkstyle failure still ran ~40 runner-minutes of tests that the next
push would cancel. Python had already moved to event-owned entrypoints (`ci-pr.yml`,
`ci-merge-queue.yml`) with one required check per area.

## Decision
- `ci-pr.yml` and `ci-merge-queue.yml` own the UI trigger, path selection
  (`.github/ui-ci/paths.yml`, read by the shared `plan` job), job graph and required check.
  `ui-checkstyle.yml`, `ui-unit-tests.yml` and `ui-browser-tests.yml` are reusable workflows that
  do not inspect paths themselves. Browser tests still select by impact inside their own workflow.
- On pull requests, Jest and browser tests need checkstyle to pass first (fail fast). In the merge
  queue, all three run in parallel so an entry reports every failure.
- One required check, `ui-tests-status`, verifies each UI job through the shared
  `.github/actions/ci-status-gate` composite. A selected job must succeed, an unselected one must be
  skipped, and the expected list must name every dependency. It runs on every non-draft PR because
  a job skipped by `if` would report success. Draft PRs skip all UI jobs.
- `ui-browser-tests.yml` keeps its 6-hourly and manual full run on main. Merge-queue entries now
  publish the impact map from `ci-merge-queue.yml` runs, so the map lookup queries both workflows.
- Until the `merge-rules` ruleset requires `ui-tests-status`, both entrypoints also report it as
  `ui-checkstyle` and `ui-coverage`. Switch the ruleset after this lands, then delete those jobs.

## Consequences
A UI pull request takes checkstyle time plus test time instead of the slowest of three parallel
workflows. In exchange, a lint failure costs one runner. Gating on the whole checkstyle job, not
a lint-only subset, adds about 1.5 minutes of wall time (bundle build, knip) before tests start.
Splitting it would mean a second checkstyle job with its own setup. Browser tests and the core-components
tests become merge-blocking for the first time; the ruleset never required them. A queue entry's
impact map counts only when the whole `ci-merge-queue` run passed. Dispatching an entrypoint by
hand runs every UI job. Backend joins the same entrypoints
separately, coordinated with its owners and the ruleset change.
