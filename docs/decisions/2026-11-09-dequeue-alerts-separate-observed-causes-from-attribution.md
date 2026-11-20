# Dequeue alerts report observed causes, not attribution

- **Status:** Superseded by ADR:2026-11-12-dequeue-alerts-compare-main-before-attributing-failures
- **Revisions:** v1 2026-11-09 (initial) · v2 2026-11-09 (remove internal tooling tests)
- **Deciders:** Pere Miquel Brull
- **Guard:** reviewer
- **Related:** ADR:2026-11-06-dequeue-attribution-requires-comparable-test-evidence; ADR:openmetadata-collate/2026-11-09-dequeue-alerts-separate-observed-causes-from-attribution

## Context

The previous approach had build and test jobs publish evidence artifacts so the dequeue report could
compare failures with main. Job families without a collector reported only "Unknown", and every
producer carried reporting steps. Comparing a queue job with the same job on main does not settle
the cause either: main's runs can fail for reasons queue runs do not share. In Collate, push runs of
py-tests fail in Detect Changes, a step queue runs pass, so "main also failed" would clear any PR
that broke Python tests.

## Decision

Diagnosis lives only in the dequeue workflow and reads only what GitHub already keeps for the queue
commit. Each workflow run is reported by its first failed or timed-out job by completion time. Jobs
that gate or summarise other jobs need them, so they finish later and are listed after the cause,
never as it. Cancelled jobs are listed and never blamed. For the cause, report its failed steps and,
outside test steps, a dependency download (HTTP 429/5xx) or network error found in their logs.
Notifications never copy raw log text or URLs from logs.

The report makes no claim about whether the PR, main or a flake caused a failure. No other workflow
publishes reporting data, and no comparison runs are read or dispatched.

## Consequences

Build and test workflows carry no reporting steps. A second, independent failure in the same run is
listed after the first, not explained. An unrecognised infrastructure error shows only its failed
step. The diagnosis is tested on pull requests that change it, never inside the report:
`pull_request_target` runs `main`'s copy, and a failing test there would suppress the alert.

## Amendment — internal tooling tests

Per maintainer request, the dequeue helper carries no automated tests or dedicated test workflow.
This replaces the PR-test setup above. Changes use code review and relevant syntax, formatting and
reference checks; none of that validation executes inside the dequeue report.
