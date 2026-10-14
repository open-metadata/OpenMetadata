# Queue conflicts are re-queued or resolved by CI, and only unreviewed-safe ones re-queue themselves

- **Status:** Proposed (amends ADR:2026-10-13-merge-queue-conflicts-are-labelled-and-main-conflicts-evicted; needs its deciders' agreement)
- **Revisions:** v1 2026-10-13 (initial); v2 2026-10-14 (no job runs the PR's code: its own CI tests the merge commit, and taken generated files or lockfiles wait for a person)
- **Deciders:** Mohit Yadav
- **Guard:** `test_queue_conflicts_requeue_only_when_clean_and_under_the_daily_cap` in `.github/scripts/tests/test_queue_conflicts.py`, `test_a_merge_that_also_edits_a_cleanly_merged_file_is_refused` in `.github/scripts/tests/test_publish_conflict_resolution.py`, `test_taking_mains_generated_files_leaves_the_requeue_to_a_person` in `.github/scripts/tests/test_conflict_resolvers.py`, `test_workflows_in_mains_context_never_run_the_code_they_check_out` in `.github/scripts/tests/test_ci_workflow.py`
- **Related:** ADR:2026-10-13-merge-queue-conflicts-are-labelled-and-main-conflicts-evicted, ADR:2026-10-13-ci-ai-output-is-advisory-and-never-decides-a-merge, docs/ci.md

## Context
37 `merge_conflict` removals hit 32 PRs in two weeks (2026-09-29 → 10-13); each costs the
author a manual rebase and re-queue. The existing record labels them `queue conflict` or
`merge conflict` and re-queues nothing.

## Decision
- A `queue conflict` PR (clean against main) is re-queued with its head unchanged once the
  entry it clashed with has left, at most 3 times in 24 hours.
- A `merge conflict` PR gets main merged in: generated files, lockfiles and locale JSON are
  resolved mechanically; the rest by Claude editing only the conflicted files, never
  `.github/**` or `.claude/**`; the result must keep every line either side added or say
  which it dropped.
- No job in that workflow runs the PR's code: its events (schedule, dispatch) run in
  main's context, where anything executed could write main's caches. Generated files and
  lockfiles are taken from main without regenerating them, and the merge commit is
  re-checked with `git merge-tree` before the push: it may differ from a clean merge only
  in the files that merge leaves conflicted. The push starts the PR's own CI, which
  builds and tests it.
- Only a purely mechanical resolution that dropped nothing and needs no regeneration
  re-queues itself (auto-merge, which waits for the PR's checks); approvals survive
  pushes here, so anything a model edited waits for a person.

## Consequences
- Re-queue uses an App token: a re-queue made with the default token may start no
  merge-group runs.
- Two PRs that conflict with each other stop ping-ponging after three re-queues.
- A resolution that took main's generated files or lockfile needs regenerating first:
  `typescript-type-generation.yml` does it for the TypeScript types of same-repo PRs, and
  the PR comment gives the commands for the rest.
