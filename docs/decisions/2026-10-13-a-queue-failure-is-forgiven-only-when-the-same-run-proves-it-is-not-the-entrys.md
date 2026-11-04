# A queue failure is forgiven only when the same run proves it is not the entry's

- **Status:** Accepted (shadow until the cutover in docs/ci.md)
- **Revisions:** v1 2026-10-13 (initial); v2 2026-10-14 (strict entries still re-run blips; a job read as a blip gets one more run); v3 2026-10-14 (a parent control recorded for the same parent stands in for running it again); v4 2026-10-15 (only the entry's own failure on the parent is pre-existing; a failure is answered by its own job's verification, across re-run attempts; the ledger keeps nothing from strict or undecided entries; the impact-map link is applied)
- **Deciders:** Mohit Yadav
- **Guard:** `test_verify_table`, `test_one_introduced_failure_ejects_even_beside_forgiven_ones`, `test_each_failing_job_is_answered_by_its_own_verification` and `test_a_strict_entry_still_reruns_a_blip_but_forgives_no_test` in `.github/scripts/tests/test_merge_gate_policy.py`; `test_only_the_entrys_failure_on_the_parent_counts_as_pre_existing` in `.github/scripts/tests/test_verify_failures.py`; `test_a_flake_forgiven_before_a_rerun_stays_forgiven` and `test_an_ambiguous_failure_the_impact_map_links_to_the_entry_is_not_forgiven` in `.github/scripts/tests/test_merge_gate_controller.py`; `test_a_parent_control_is_reused_only_for_the_same_test_failure_and_parent`, `test_a_test_failing_on_two_engines_keeps_a_record_and_a_control_per_job` and `test_nothing_is_recorded_from_a_strict_or_undecided_entry` in `.github/scripts/tests/test_merge_gate_registry.py`
- **Related:** ADR:2026-10-13-merge-queue-entries-are-decided-by-the-merge-gate-status, docs/ci.md

## Context
History-based forgiveness ("this test failed elsewhere recently") forgives a regression
whenever a flaky test happens to share its name, and queue entries are cumulative, so a
failure in an entry that shares a PR with this one proves nothing about it. The requirement
was a stringent, same-run answer that redoes no work.

## Decision
- The failing tests, and only those, are re-run in the same run with the run's own builds:
  on the entry up to 3 times (stop at the first pass), then on the parent commit
  (`merge_group.base_sha`) up to 3 times (stop at the first failure).
- Forgiven: did not reproduce on the entry (flaky), or failed on the parent the way it
  failed on the entry (pre-existing: the same failure fingerprint). A parent that fails
  another way, a database that never started for one, is no control: the verify job fails
  and is re-run. Ejected: reproduced on the entry and never on the parent. One failure in
  three on the entry with a clean parent is forgiven only with independent history (main,
  or entries sharing no PR) and no impact-map link to the entry's diff: the static rules of
  `plan_local_java_tests.py` over `.github/java-tests/impact-map.json` (the test's own
  file, an area that owns a changed file and names the test, an entity name, and every
  test for shared infrastructure, a full-suite area or production code no rule places).
  The links the planner finds by reading code are not applied.
- A failure is answered only by the verification of the job it failed in, since a Java IT
  fails on each engine and lane for its own reasons, and only by one that ran no earlier
  than the attempt that saw it. A re-run copies the jobs it leaves alone into the new
  attempt; their evidence and verification are the ones their own execution wrote.
- A parent control already recorded for the same test, the same failure fingerprint, the
  same job and the same parent commit stands in for running it again: the parent is the
  same commit, so it is the same experiment, and every later entry on that parent skips a
  rebuild. One recorded failure is conclusive; clean records count once their runs reach a
  fresh control's (`verify.parentRuns`). The record comes from the merge gate's ledger,
  `ledger.jsonl` on the `ci/merge-gate` branch (one JSON object per line, written only by
  `merge_gate_registry.py`; 30 days, at most 5,000 records and 2 MB). A forged record
  could stand in for a control, so before enforce mode pushes to that branch are limited
  to the gate App, which the record job pushes with, and the ledger keeps nothing from an
  entry changing CI configuration (its verification ran code the entry changed) or from a
  run the gate did not decide.
- No verification above the suite cap (Java IT 20, Python 20, Playwright 10), for static
  checks, compile errors, or entries changing CI configuration (strict). Strict entries
  are still re-run on infrastructure failures: a re-run forgives nothing.
- Infrastructure failures re-run only the failed jobs, once; a failure that survives its
  re-run and passed on the parent commit's run is the entry's. A job with no test evidence
  that the triage call reads as a blip gets one more run, never a pass
  (ADR:2026-10-13-ci-ai-output-is-advisory-and-never-decides-a-merge).

## Consequences
- A forgiven failure always becomes a tracked flake and a fix proposal, never silence.
- A PR that introduces a low-rate flake can pass; the counts are in policy.json and the
  shadow period measures the misclassification rate before the cutover.
- In v1 Playwright and Python have no parent control, so a failure reproducing on the entry
  counts as the entry's for them.
