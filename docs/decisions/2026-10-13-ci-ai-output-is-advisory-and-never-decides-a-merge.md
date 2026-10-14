# CI AI output is advisory and never decides a merge

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial); v2 2026-10-14 (a triage call may grant a bounded re-run of a job that failed on a blip)
- **Deciders:** Mohit Yadav
- **Guard:** `test_only_the_triage_adapter_reaches_a_model` and `test_reading_a_job_as_a_blip_can_only_ever_add_a_rerun` in `.github/scripts/tests/test_merge_gate_policy.py`
- **Related:** ADR:2026-10-13-merge-queue-entries-are-decided-by-the-merge-gate-status, docs/ci.md

## Context
The CI uses Claude to explain ejections, propose fixes for flaky tests, fix PR failures on
`/ci-fix` and resolve merge conflicts. Its inputs (diffs, logs, test names) are partly
attacker-controlled, and its answers cannot be checked the way a test run can.

Network blips also fail jobs in ways no fixed signature anticipates. Re-running such a job
is the right call, and deciding that from the log is a judgement a model can make.

## Decision
- No model output forgives a failure, passes an entry, classifies a flake in the registry,
  or re-queues code a model edited. A passing run is always what lets code merge.
- One exception, bounded: for a failed job with no test evidence and no known signature
  in its annotations or log, a triage call (`ci_ai/triage.py`) may read the failure as a
  transient blip, quoting the log line that shows it. That only earns the job a re-run:
  on PR runs, and in the queue one attempt past the blind retry (`transient.maxAttempts`).
  The re-run's own result is what the gate then reads. Only `merge_gate_triage.py`
  reaches a model; the policy sees nothing but `FailedJob.log_signal`.
- Models only edit files (no shell), from main's agent configuration; their patches are
  verified in a job with no secrets and pushed by an App without the `workflows` permission.
- Spend is capped by a dedicated Console workspace's monthly limit and per-role daily caps;
  `CI_AI_MODE=off` turns the advisory roles off and `CI_AI_TRIAGE_MODE=off` the triage.

## Consequences
- A wrong explanation costs a confused reader, never a merged regression.
- A wrong "transient" costs one re-run within the re-run budgets, never a merged regression.
- A conflict resolution by a model always waits for a person to re-queue it.
