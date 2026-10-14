# Merge-queue entries are decided by the merge-gate status, written only by the merge-gate controller

- **Status:** Accepted (shadow until the cutover in docs/ci.md)
- **Revisions:** v1 2026-10-13 (initial); v2 2026-10-14 (PR heads: jobs that failed on infrastructure are re-run); v3 2026-10-14 (only finished runs are decided; the sweep's window, order and limit, and a pending status counts as undecided)
- **Deciders:** Mohit Yadav
- **Guard:** `test_shadow_mode_posts_the_shadow_context_and_reruns_only_the_infra_job`, `test_strict_mode_fails_any_failed_job_without_rerunning`, `test_a_pr_job_that_failed_installing_packages_is_rerun_not_failed`, `test_a_run_still_in_progress_gets_no_verdict`, `test_the_sweep_decides_heads_whose_latest_gate_status_is_missing_or_pending`, `test_the_sweep_decides_queue_runs_first_and_the_oldest_first` and `test_runs_that_get_no_verdict_do_not_use_up_the_sweep_limit` in `.github/scripts/tests/test_merge_gate_controller.py`
- **Related:** ADR:2026-10-13-a-queue-failure-is-forgiven-only-when-the-same-run-proves-it-is-not-the-entrys, ADR:2026-10-13-stale-merge-queue-runs-are-cancelled-by-a-central-sweep, docs/ci.md

## Context
GitHub ejects a queue entry as soon as one required check fails, so a flaky test, a dead
runner or a test broken on main ejected PRs that did not cause them: 32.4% of 1,405 entries
(2026-09-29 → 10-13) had a failed required check, and merged PRs needed 2.86 entries on
average. Eight required checks from nine workflows leave nothing that can look at a failure
and decide.

## Decision
- One required check, `merge-gate`, a commit status. On a PR head it follows the CI run,
  re-running the jobs that failed on infrastructure; on a queue entry
  `.github/scripts/merge_gate.py` decides from the run's own evidence with
  `.github/merge-gate/policy.json`, re-running only the jobs it names.
- Only `merge-gate.yml` writes it, running the default branch's code. In enforce mode it
  writes with a dedicated GitHub App and the ruleset pins the check to that App; no job is
  named `merge-gate`.
- `MERGE_GATE_MODE`: `shadow` writes `merge-gate (shadow)` (required by nothing), `enforce`
  writes `merge-gate`, `strict` is the kill switch (no forgiveness, no re-runs).
- The controller never cancels a run; any error leaves no status, which the queue's check
  timeout fails closed and the 10-minute sweep retries. It decides only finished runs: a
  run still going has jobs without a conclusion, which would read as passed.
- The sweep decides a finished CI run that a `workflow_run` delivery missed: created
  within 6 hours (3 for PR runs), finished 15 to 60 minutes ago (the 15-minute grace is
  the decide job's timeout, so a delivered decision is never raced), and whose head's
  latest gate status is missing or pending. Queue runs come first, from their own listing
  so PR traffic cannot crowd them out, oldest first since the oldest entry is the nearest
  its check timeout. At most 50 verdicts per sweep; a run that gets none (outside the
  sample, superseded, out of the queue) does not count.
- A pending status means undecided: a re-run leaves the head pending until its new attempt
  is decided, so a missed delivery for that attempt is caught. An entry the gate holds is
  pending too, so it is decided again on each sweep in that window; the Slack alert comes
  only from the decide job, once.

## Consequences
- Changing the CI's jobs no longer needs a ruleset change: only the gate's inputs change.
- A missing or broken controller stalls the queue for up to the check timeout; the sweep,
  the strict mode and the rollback in docs/ci.md bound that.
- Revisit if GitHub lets a ruleset distinguish PR checks from merge-group checks.
