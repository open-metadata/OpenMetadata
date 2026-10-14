# Queue conflicts are re-queued or resolved by CI, and only unreviewed-safe ones re-queue themselves

- **Status:** Proposed (amends ADR:2026-10-13-merge-queue-conflicts-are-labelled-and-main-conflicts-evicted; needs its deciders' agreement)
- **Revisions:** v1 2026-10-13 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `test_queue_conflicts_requeue_only_when_clean_and_under_the_daily_cap` in `.github/scripts/tests/test_queue_conflicts.py`, `test_verify_editing_source_files_is_refused` in `.github/scripts/tests/test_publish_conflict_resolution.py`
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
- Only a purely mechanical resolution that dropped nothing re-queues itself (auto-merge);
  approvals survive pushes here, so anything a model edited waits for a person.

## Consequences
- Re-queue uses an App token: a re-queue made with the default token may start no
  merge-group runs.
- Two PRs that conflict with each other stop ping-ponging after three re-queues.
