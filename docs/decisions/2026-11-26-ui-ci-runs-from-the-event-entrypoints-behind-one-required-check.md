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
`ci-merge-queue.yml`) with one required check per area. A pull request's CI must finish within
50 minutes.

## Decision
- `ci-pr.yml` and `ci-merge-queue.yml` own the UI trigger, path selection
  (`.github/ui-ci/paths.yml`, read by the shared `plan` job) and the required check. Each runs
  the UI as one `ui` job, like the `python` job, calling the reusable `ui-ci.yml`.
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
- `ui-browser-tests.yml` keeps its 6-hourly and manual full run on main. Merge-queue entries
  publish the impact map from `ci-merge-queue.yml` runs, so the map lookup queries both workflows.
- Until the `merge-rules` ruleset requires `ui-tests-status`, both entrypoints also report it as
  `ui-checkstyle` and `ui-coverage`. Switch the ruleset after this lands, then delete those jobs.

## Consequences
A UI pull request takes checkstyle time (5–13 minutes on recent runs) plus browser selection, its
slowest shard (up to about 12 minutes) and the report: about 30 minutes at worst, and a lint
failure costs one runner. A queue entry also waits for lint before its tests start, so its failures arrive in two rounds at most. Every UI job pays
its own setup through `setup-ui`. Browser tests and the core-components tests become merge-blocking for the first time;
the ruleset never required them. A queue entry's impact map counts only when the whole
`ci-merge-queue` run passed. Dispatching an entrypoint by hand runs every UI job. Backend joins
the same entrypoints separately, coordinated with its owners and the ruleset change. Python's
gates can move onto `ci-status-gate` the same way.
