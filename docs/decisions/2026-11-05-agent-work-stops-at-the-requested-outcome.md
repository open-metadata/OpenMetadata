# Agent work stops at the requested outcome and shares verification evidence

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial)
- **Deciders:** Teddy Crepineau
- **Guard:** `.github/scripts/test_plan_local_java_tests.py`; reviewer for completion boundaries
- **Related:** https://github.com/open-metadata/OpenMetadata/pull/36690/changes/56c02323489b509bff47761f799932e54ab206a3

## Context

The user-provided analysis of session `01a1acb4-a4dd-7c31-85bd-393b2231ea11` attributes
49.8 of 77.5 minutes and 11.65M of 18.70M input tokens to work after the requested push.
The broad test plan, infrastructure retries and repeated monitoring extended the task.
These are measurements of one session, not a general performance guarantee or billing estimate.

## Decision

- Implementation, push and PR-creation tasks use focused verification. Merge-readiness tasks
  include full impacted coverage. Monitoring and additional workflow dispatch require that scope.
  Skills share applicable evidence; invoking another skill does not require another test run.
- Focused Java scope selects changed tests, convention-named unit tests and explicit author
  additions with reasons. No runnable focused selection when broader coverage exists is an error.
  Deferred commands are reported in the plan and results. Focused success never means merge ready.
- CLI defaults remain full scope for compatibility. Existing merge-queue and CI gates stay intact.
- Publishing saved results is separate from execution, validates source/build/config and report
  fingerprints, preserves failures, and uses one overwritten evidence record. It is not a cache
  of external service state. Environment changes or relevant new failures require affected checks.
- Stop after confirming the requested push or saved PR body and reporting outstanding checks.
  Use deterministic runners and compact summaries, rather than repeated model calls for unchanged
  logs. Retry infrastructure failures only after addressing the cause.

## Consequences

Users receive the requested deliverable without implicit ongoing monitoring. Broader verification
remains visible and required for merge readiness. This policy revises earlier blanket before-PR
full-run instructions; it does not remove the independent self-review required by
ADR:2026-10-16-prs-self-review-against-shared-review-bar.
Measure completion time, model calls, cached/uncached input and output per comparable completed
request, redundant checks and later verification failures. No fixed verification-time percentage
is prescribed: expensive verification can be justified by the change.
