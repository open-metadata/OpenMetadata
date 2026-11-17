# Operation metrics are recorded and merged under one lock

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** Ingestion team
- **Guard:** reviewer; `test_operation_metrics.py` (`test_high_concurrency_accuracy`)
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
