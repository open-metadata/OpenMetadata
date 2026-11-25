# Stale merge-queue runs are cancelled by a central sweep, not per-workflow concurrency

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial)
- **Deciders:** Harshit Shah
- **Guard:** `test_prune_workflow_only_cancels_runs_on_dead_queue_refs` in `.github/scripts/tests/test_playwright_cache_assets.py`
- **Related:** open-metadata/openmetadata-collate#7328, PR #35298

## Context
When the merge queue rebuilds or drops an entry, GitHub deletes the entry's
`gh-readonly-queue/main/pr-<n>-<baseSha>` ref but does not cancel the runs already started on it. Our
merge-group workflows key `concurrency` on `run_id` (so sibling PRs in the queue never cancel each
other) or on the ref (which is new on every rebuild), so `cancel-in-progress` never matches them. On
2026-10-13 05:49Z, 16 orphan runs held 30 running jobs on 5 deleted refs. Keying `concurrency` on the
PR number would need an extra job in about 15 workflows, because expressions cannot extract
`pr-<n>` from `merge_group.head_ref`, and every new workflow would have to remember to add it.

## Decision
- **Concurrency stays as it is:** merge-group workflows keep `concurrency` keyed on `run_id` or the
  ref, and do no cancellation of their own.
- **One sweep does the cancelling:** runs on dead queue refs are cancelled only by the
  `cancel-stale-runs` job in `.github/workflows/prune-ephemeral-caches.yml`.
- **What it cancels:** a `merge_group` run only when its ref no longer resolves and its PR did not
  merge. It never cancels its own run.
- **Listing order:** it lists runs before refs. If it listed refs first, an entry created between
  the two calls would look dead and its runs would be cancelled.
- **When it runs:** on `merge_group`, on `pull_request_target: dequeued` and on the workflow's
  schedule.

## Consequences
- **New workflows:** a new merge-group workflow needs no cancellation logic.
- **Live entries are safe:** a run whose ref is live is never touched, so the sweep cannot dequeue
  an entry.
- **Merged PRs:** a merged group's still-running non-required checks are kept, because they are the
  only post-merge signal for workflows with no `push` trigger. The cost is that runs from a merged
  PR's earlier, superseded groups also run to completion.
- **Fallback timing:** a ref deleted later than the dequeue wait is caught by the next sweep, so up
  to the schedule interval later.
- **When to revisit:** if GitHub starts cancelling runs on deleted queue refs itself, or exposes the
  PR number in a form `concurrency` can key on.
