# CI components share one status gate that always runs

- **Status:** Accepted
- **Revisions:** v1 2026-11-27 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `.github/scripts/tests/test_ci_speed_status_gates.py`
- **Related:** PR #38801, ADR:2026-11-26-ui-ci-runs-from-the-event-entrypoints-behind-one-required-check,
  ADR:2026-11-11-python-ci-selects-workloads-by-event, ADR:2026-11-25-backend-checks-reports-native-stage-failures

## Context

`ci-pr.yml` and `ci-merge-queue.yml` report one required status per component: Python, UI and
backend. Each checked its results in its own way: Python with inline `jq` in both files, UI with
the `ci-status-gate` action, and backend with a bash `check()` copied into both files. The bash
version ignored a job that ran without being selected, and any dependency it had no line for. The
PR backend status also skipped itself when no backend work was selected, and a job skipped by `if`
reports success, even as a required check. The `backend-checks` job was copied word for word, and
tests ran once against each copy.

## Decision

- `.github/actions/ci-status-gate` is the only status gate. `py-tests-status`, `ui-tests-status`
  and `backend-checks-status`, in both entrypoints, call it with `toJSON(needs)` and an `expected`
  map that gives every dependency `success` or `skipped`, from the same planner output as that
  dependency's own `if`. The PR Python job runs its suites as steps, so it passes their outcomes
  in the same shape (`{"<id>": {"result": "<step outcome>"}}`).
- A status gate runs with `always()` and is filtered only by event, manual workload and draft
  state, never by planner output. On a non-draft PR all three report.
- No workflow writes its own result check.
- `.github/ci/required-checks.txt` lists the required names that both entrypoints report as
  top-level jobs. Renaming one changes that file, both workflows and the `merge-rules` ruleset
  together.
- A job that both entrypoints run is identical in both, apart from the keys each entrypoint owns,
  which the guard lists. Shared work lives in composite actions and is tested once.

## Consequences

One rule decides every component's status, and a failing gate names the job that broke it. A new
dependency of a gate fails until it has an expected result. The PR backend status costs one small
job on PRs with no backend change. `ui-checkstyle` and `ui-coverage` stay until the ruleset
requires `ui-tests-status`.
