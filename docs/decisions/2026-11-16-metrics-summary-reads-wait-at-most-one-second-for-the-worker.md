# A metrics summary read waits at most one second for the worker's in-flight items

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial) · v2 2026-11-17 (the one-second bound covers only the wait)
- **Deciders:** Ingestion team
- **Guard:** `test_operation_metrics.py` (`test_summary_waits_for_the_item_the_worker_is_recording`)
- **Related:** open-metadata/OpenMetadata#37889, open-metadata/OpenMetadata#37890

## Context
`OperationMetricsState` records operations on a background worker. A summary read drained the
queue and treated an empty queue as flushed, but the worker may already hold an item it has taken
and not yet recorded, so that operation was missing from the summary (`999 == 1000` in
`test_high_concurrency_accuracy`). `Queue.join` would wait for it, but has no timeout, and status
reads run while ingestion threads keep recording, so an unbounded wait could stall a run.

## Decision
`get_summary`, `get_flat_summary`, `get_workflow_timing` and `reset` record everything still queued
themselves, then wait at most `FLUSH_TIMEOUT_SECONDS` (1 second) for the queue's unfinished-task
count to reach zero. After the timeout they report what has been recorded so far. The worker and the
drain call `task_done` for every item they take, whatever happens to it, so the wait always ends.

## Consequences
Summaries are read once the steps have finished (`BaseWorkflow.execute`'s `finally`, and
`_print_summary`), when nothing else is recording, so a read returns as soon as the worker finishes
the item it holds. The wait counts every unfinished item, including ones enqueued after the drain,
so a read made while other threads keep recording can take the full second. That wait never lasts
longer than one second, at the cost of possibly missing items still being recorded. The bound is on
the wait alone: the drain before it and the merge under `_lock` after it are not time-limited. Revisit if summaries
are read mid-run and must be both prompt and exact, which would call for waiting only on the items
taken before the read started.

## Amendment
v2 2026-11-17: v1 said a read never blocks longer than one second. Only the wait for unfinished
items is bounded; the drain of a large backlog before it and the merge after it are not, so a whole
read can take longer than that.
