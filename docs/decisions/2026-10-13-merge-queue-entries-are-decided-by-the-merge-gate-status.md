# Merge-queue entries are decided by the merge-gate status, written only by the merge-gate controller

- **Status:** Accepted (shadow until the cutover in docs/ci.md)
- **Revisions:** v1 2026-10-13 (initial); v2 2026-10-14 (PR heads: jobs that failed on infrastructure are re-run)
- **Deciders:** Mohit Yadav
- **Guard:** `test_shadow_mode_posts_the_shadow_context_and_reruns_only_the_infra_job`, `test_strict_mode_fails_any_failed_job_without_rerunning` and `test_a_pr_job_that_failed_installing_packages_is_rerun_not_failed` in `.github/scripts/tests/test_merge_gate_controller.py`
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
  timeout fails closed and the 10-minute sweep retries.

## Consequences
- Changing the CI's jobs no longer needs a ruleset change: only the gate's inputs change.
- A missing or broken controller stalls the queue for up to the check timeout; the sweep,
  the strict mode and the rollback in docs/ci.md bound that.
- Revisit if GitHub lets a ruleset distinguish PR checks from merge-group checks.
