# Merge-queue conflicts are labelled by cause, and entries conflicting with main are evicted on merge

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial)
- **Deciders:** Harshit Shah
- **Guard:** `test_dequeue_report_labels_conflicts_and_evicts_main_conflicts` in `.github/scripts/tests/test_playwright_merge_group_validation.py`
- **Related:** open-metadata/openmetadata-collate#7328, PR #35298, ADR:2026-10-13-stale-merge-queue-runs-are-cancelled-by-a-central-sweep

## Context
GitHub builds each merge-queue entry on main plus every entry ahead of it. If that build cannot be
created, GitHub removes the entry with `MERGE_CONFLICT`. It does this even when the PR applies
cleanly to main and the entry it clashed with is about to fail. On 2026-10-13 07:02:49, PR 35280 was
removed for `MERGE_CONFLICT` while `CLEAN` against main, and was re-queued 46s later with no new
commit. None of the ruleset's merge-queue parameters change this. Building one entry at a time
(`max_entries_to_build: 1`) would avoid it, but it serialises the queue.

GitHub also checks only the entries it is building (5). An entry further back that starts
conflicting with main waits its turn, then runs a full CI build that cannot merge.

## Decision
`.github/workflows/merge-queue-dequeue-report.yml` does three things:
- **Labels by cause:** on a `MERGE_CONFLICT` dequeue, it reads the PR's `mergeable` state against
  the latest main. It adds `merge conflict` if the PR is `CONFLICTING`, or `queue conflict` if it is
  `MERGEABLE`, and says which in the dequeue comment. It adds no label while the state is still
  `UNKNOWN`.
- **Evicts main conflicts on every merge:** on each push to main, it removes every `QUEUED`
  (not yet built) entry whose PR is `CONFLICTING` against main, then labels it `merge conflict` and
  comments. Entries GitHub is building are left to GitHub, which reports them `UNKNOWN` while
  building and removes them itself on a conflict.
- **Clears the labels:** both labels are removed when the PR is pushed to or re-queued.

Nothing is re-queued automatically.

## Consequences
- **Queue position:** a PR labelled `queue conflict` keeps GitHub's dequeue and loses its place.
  Its author re-queues it.
- **Bounded side effects:** an entry evicted for a main conflict never starts its CI.
- **Token:** eviction uses the default workflow token, so it triggers no other workflow. That is
  why the eviction job labels and comments itself.
- **Dry run:** `MQ_REPORT_DRY_RUN` puts labelling and eviction into dry-run, the same as the
  dequeue report.
- **When to revisit:** if GitHub adds a merge-queue setting that keeps an entry queued until the
  entry it conflicts with resolves.
