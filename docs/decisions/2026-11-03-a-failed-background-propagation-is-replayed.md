# A background inherited-field propagation the engine failed is replayed through the search retry queue

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `InheritedFieldPropagationCheckTest`, `ElasticSearchChildUpdateStatusTest`, `OpenSearchChildUpdateStatusTest`, `InheritedFieldPropagationRecoveryIT`
- **Related:** #31112 (inherited-field propagation runs as a background update-by-query)

## Context

Since #31112 inherited fields (owners, domains, tags, ...) reach a parent's children through an
update-by-query submitted with `wait_for_completion=false`, so a large child set cannot hold a
connection past `socketTimeoutSecs`. The engine accepts the task and returns its id; the request
returns. If the engine then fails the task — for example `too_many_scroll_contexts_exception` when
concurrent update- and delete-by-query load exhausts the node's open scroll contexts (default 500)
— nothing reads the result: the submission did not throw, so the search retry queue never hears of
it, and the children keep the old value until the next reindex.

## Decision

- Keep the propagation asynchronous. Keep its task id, and read the task's status with short
  `GET _tasks/{id}` calls that do not wait: first after 1 s, then doubling to every 10 s, for at most
  15 minutes. No connection is held between reads; a read that fails is tried again on the next.
- A finished task with an `error`, per-document `failures` or `timed_out` queues the parent with
  `SearchIndexRetryQueue.enqueueWithPropagation(parent, changeDescription, reason)`, the exact change
  that was propagated. The existing retry worker replays it. Version conflicts are not a failure.
- Replays are themselves checked. Because a queue entry restarts the worker's attempt count, the
  repairs of one parent are capped at 3 per hour.
- At most 1,000 propagation tasks are checked at once. Past that a new task goes unchecked, so an
  engine failure of that task stays as stale as before this change; this is logged as a warning
  (first occurrence, then every 1,000th) so a cluster that keeps hitting the cap is visible. The cap
  bounds the checker's memory and status reads on a cluster with a burst of propagations.
- Only `SearchRepository.propagateToEntityChildren` is checked; deletes, renames and reference
  rewrites keep their current behaviour.

## Consequences

A failed background propagation now heals within seconds once the engine recovers, instead of
staying stale until a reindex. The cost is one status read per propagation (usually a single read)
and, on failure, one queued replay. A task still running after 15 minutes is logged and left alone.
The staged-index gap during a recreate reindex (propagation reaches the live alias, not the staged
index) is a separate problem this does not address.
