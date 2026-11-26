# UI CI runs from the event entrypoints behind one required check

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `.github/scripts/tests/test_python_ci.py` (`test_ui_status_expects_a_result_for_every_dependency`,
  `test_pr_ui_gate_covers_every_stage` and the `ci-status-gate` cases of the gate tests); actionlint
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
  (`.github/ui-ci/paths.yml`, read by the shared `plan` job) and the required check. The work lives
  in composite actions that every caller shares: `setup-ui`, `ui-checkstyle`, `ui-unit`,
  `ui-browser-select`, `ui-core-components`, `ui-browser-run` and `ui-browser-report`.
- On a pull request, one `ui` job runs the stages in order, like the `python` job: setup,
  checkstyle, Jest on the tests related to the change (`--changedSince` the base; the whole suite
  when Jest's setup, configuration, dependencies or core components change), then the browser tests
  the change selects, unsharded. A failed stage skips the rest. Each stage is also published as a
  check run (`ui-lint`, `ui-unit`, `ui-browser`) for same-repository PRs.
- In the merge queue, checkstyle, the whole Jest suite in four shards and the browser tests
  (`ui-browser-tests.yml`, sharded) are separate jobs that run in parallel, so an entry reports
  every failure.
- One required check, `ui-tests-status`, verifies the selected work through the generic
  `.github/actions/ci-status-gate` composite. A selected stage or job must succeed and an
  unselected one must be skipped, and the expectations must name every dependency. It runs on
  every non-draft PR because a job skipped by `if` reports success. Draft PRs skip all UI work.
- `ui-browser-tests.yml` keeps its 6-hourly and manual full run on main and is called by the
  merge queue. Merge-queue entries publish the impact map from `ci-merge-queue.yml` runs, so the
  map lookup queries both workflows.
- Until the `merge-rules` ruleset requires `ui-tests-status`, both entrypoints also report it as
  `ui-checkstyle` and `ui-coverage`. Switch the ruleset after this lands, then delete those jobs.

## Consequences
A UI pull request uses one runner and pays setup once, and a lint failure stops it. Jest's import
graph is dense: a two-file change selected 1,030 of 2,218 test files, so related-only roughly halves
Jest on the PR rather than shrinking it to a handful. A PR that changes test setup or dependencies,
or one whose browser selection is "all", runs the whole suite on one runner and takes longest.
Browser tests and the core-components tests become merge-blocking for the first time; the ruleset
never required them. A queue entry's impact map counts only when the whole `ci-merge-queue` run
passed. Dispatching an entrypoint by hand runs every UI stage. Backend joins the same entrypoints
separately, coordinated with its owners and the ruleset change. Python's gates can move onto
`ci-status-gate` the same way.
