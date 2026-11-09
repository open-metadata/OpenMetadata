# Dequeue reports use existing GitHub data in a single workflow

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `.github/scripts/test_merge_queue_dequeue.py`, run inside the dequeue workflow
- **Related:** ADR:2026-11-06-dequeue-attribution-requires-comparable-test-evidence; ADR:openmetadata-collate/2026-11-09-dequeue-alerts-separate-observed-causes-from-attribution

## Context

The previous approach required build/test jobs to publish a new artifact protocol. It missed
other check families and coupled the reporter to each producer. Dequeue reporting must instead
happen entirely within its own workflow, using data GitHub already retains.

## Decision

Remove evidence collectors, their action, schema, parsers and separate test workflow. The dequeue
workflow reads current-attempt jobs, failed steps and completed-job logs. Summary checks point
to other failed jobs. Download HTTP 429/5xx and network symptoms are reported without claiming
that the PR is innocent; application test-step HTTP errors are not classified as download errors.
No raw log messages or download URLs are included in notifications.

For main context, use the Git merge base of the queue commit and target branch, then look for
completed executions of the same workflow and displayed job at that commit. Push/manual runs
must target the branch; queue runs must target its queue. Inspect the first API page (up to 100
runs) at that exact commit. A passing job supports a possible PR/merge-group regression or flake.
A failed job means main also failed that job; it does not establish an identical cause. Floating
dependencies, different test selections and flaky tests prevent stronger claims. Missing baseline
jobs remain inconclusive. No extra workflows or baseline test runs are dispatched.

Logs use the completed-job endpoint so live siblings do not delay reporting. Inspect the final
2 MiB, restricted to failed-step timestamps, with a 60-second CLI timeout; output stays in a
temporary file. Step metadata rounds to seconds, so include the completed second in full.
Unavailable logs or baseline reads preserve the failed step and the rest of the notification.

## Consequences

One dequeue call performs the diagnosis and sends the report. Existing build/test workflows
need no reporting instrumentation. Main context is deliberately job-level, not a claim about
which PR or individual test introduced a failure. Manual removals remain silent.
