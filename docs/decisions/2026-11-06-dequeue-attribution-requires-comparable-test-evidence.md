# Dequeue attribution compares executed tests against the exact main base

- **Status:** Superseded by ADR:2026-11-09-dequeue-alerts-separate-observed-causes-from-attribution
- **Revisions:** v1 2026-11-06 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `.github/scripts/test_merge_queue_evidence.py`, run by `merge-queue-evidence-tests.yml`
- **Related:** ADR:openmetadata-collate/2026-11-06-dequeue-attribution-requires-comparable-test-evidence

## Context

A failed queue check does not identify whether a PR introduced the failure. The queue can
include earlier PRs, main jobs can skip their tests, and integration tests execute in separate
Maven profiles and lanes.

## Decision

Java service and operator unit jobs and every Java integration lane publish their executed
test cases, failure fingerprints, queue base SHA, suite, and runner OS and architecture. The
integration suite includes both the Maven profile and lane. The dequeue report compares only
the same workflow and displayed job against an executed push or manual run at that exact main
base, with the same suite and runner. OSS builds from one checkout and needs no independently
resolved submodule revisions.

The same class, test name, error type, and diagnostic message, with whitespace normalized,
support **Also failing on main**. A recorded pass on the base supports **Possible PR/merge-group
regression**. A different failure, skipped or missing test, conflicting retries, unavailable
artifact, or incompatible baseline supports **Unknown**. Mixed failures retain their counts;
one existing failure cannot clear the other failures. These labels report evidence and do not
claim which PR caused a failure or change merge requirements.

Artifacts are retained for seven days, matching existing integration report retention. Both
the downloaded archive and its JSON entry are limited to 16 MiB so PR-produced evidence cannot
cause an unbounded read in the privileged dequeue reporter. The reporter checks out trusted
base code and reads only `evidence.json` without extracting or executing artifact content.
Read errors remain Unknown and leave the existing failure notification available.

## Consequences

The Slack alert and PR comment show the classification and link a comparable baseline when
one exists. Attribution job names use separate GitHub Markdown and Slack mrkdwn rendering.
Other check families and runs predating evidence collection remain Unknown. Coverage grows
as main and queue jobs publish evidence. No extra test runs are launched to fill a missing
baseline.
