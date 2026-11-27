# Operation metrics are recorded and merged under one lock

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial) · v2 2026-11-17 (a reset drops items queued before it)
- **Deciders:** Ingestion team
- **Guard:** reviewer; `test_operation_metrics.py` (`test_high_concurrency_accuracy`, `test_new_run_drops_the_item_the_worker_is_recording`)
- **Related:** open-metadata/OpenMetadata#37889, open-metadata/OpenMetadata#37890

## Context
`OperationMetricsState` recorded into per-thread storage without a lock, so recording never
contended. A summary read merges every thread's storage into global state by popping the thread's
entry. A pop that ran while that thread was writing could take the entry away mid-write, and the
operation landed in a fresh entry that the merge had already passed, or was lost when the run reset.

## Decision
Every write to `OperationMetricsState._thread_metrics`, every read of its keys, and every pop of a
thread's entry holds `OperationMetricsState._lock`. Recording stays O(1); the lock is held only for
one `RunningStatistics.add`.

## Consequences
Recording threads now contend on one lock, which is cheap next to the source query or API call
being timed, and most recording already happens on the single metrics worker. Dropping the lock
from `_record_sync` to make recording "lock-free" again reintroduces lost operations.

## Amendment
v2 2026-11-17: a queued item carries `OperationMetricsState._generation` from when it was recorded.
A metrics reset (`set_run_context` with a new run id, or `reset`) increments the generation under
`_lock`, and `_record_sync` drops, under the same lock, an item whose generation is stale. An item
the worker held across a run change was otherwise written into the new run. Waiting for the worker
before the reset was not enough: the wait is bounded (ADR:2026-11-16-metrics-summary-reads-wait-at-most-one-second-for-the-worker),
and an item recorded after it expired still leaked. A new run therefore does not wait at all.
