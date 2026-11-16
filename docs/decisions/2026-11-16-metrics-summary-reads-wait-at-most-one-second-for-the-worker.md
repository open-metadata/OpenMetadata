# A metrics summary read waits at most one second for the worker's in-flight items

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
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
A read normally returns as soon as the worker finishes the one item it holds, which takes
microseconds. A read never blocks longer than one second, at the cost of possibly missing items still
being recorded when the worker is far behind. Revisit if summaries must be exact under sustained
load, which would call for counting items at enqueue time instead.
