# One CI workflow builds once per event, and static checks gate every suite

- **Status:** Accepted (shadow until the cutover in docs/ci.md)
- **Revisions:** v1 2026-10-13 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `test_every_suite_needs_the_static_checks` in `.github/scripts/tests/test_ci_workflow.py`
- **Related:** ADR:2026-10-13-stale-merge-queue-runs-are-cancelled-by-a-central-sweep, docs/ci.md

## Context
29 workflows ran on PR and queue events: 15 Maven builds of openmetadata-service per PR
push and 11 per queue entry, 22 server-image builds per entry, and suites that ran on pushes
whose formatting had already failed (272 Java and 304 UI checkstyle failures in a week).

## Decision
- `ci.yml` is the one workflow for `pull_request` and `merge_group`; shared builds run once
  and are passed on as artifacts.
- Where a suite or check already has a workflow, `ci.yml` calls it (`workflow_call`) rather
  than restating it: UI checkstyle, the service unit tests, Playwright and the Python
  suites. The gate and the check it replaces cannot drift apart.
- Every suite job `needs:` every static-check job, so a static failure starts no suite;
  builds run beside the static checks. PR runs cancel themselves on a static failure; queue
  runs never self-cancel.
- Code-executing PR checks run on `pull_request`, not `pull_request_target`.

## Consequences
- One run to read, re-run and measure per PR head and per entry.
- In the first version only the Java reactor is built once, for the ten IT lanes and their
  verification; the called workflows still build what they need until they accept build
  artifacts as inputs.
- During the shadow period the old workflows still run; consolidation finishes at cutover,
  as edits to main's workflow files (release branches keep their own copies).
