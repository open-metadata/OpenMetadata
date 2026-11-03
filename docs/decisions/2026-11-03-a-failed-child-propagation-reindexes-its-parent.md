# A background child propagation that leaves children stale reindexes its parent

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `ChildPropagationWatcherTest`, `ElasticSearchChildPropagationOutcomeTest`, `OpenSearchChildPropagationOutcomeTest`, `SearchIndexRetryQueueTest`
- **Related:** `TableResourceIT.test_ownerPropagationToSearchIndex` merge-queue flake; the async child update introduced for socket timeouts on large child sets

## Context

Inherited fields (owners, domains, tags, ...) reach a parent's children in search through an
update-by-query submitted with `wait_for_completion=false`, so a large child set cannot trip the
client socket timeout. The cluster then runs the task after the request has returned, and nothing
read its result. Under load (`429`s, partial shard failures) or a concurrent write
(`conflicts=proceed` skips the child), children stayed stale until the next full reindex. The
fallback for a submit that failed outright queued the parent's id in the retry queue's FQN column,
which the retry worker resolves by name only, so that repair never ran either.

## Decision

- Each submitted child propagation is watched to completion by `ChildPropagationWatcher`, on two
  daemon threads with at most 1,000 tasks waiting; past that a task goes unwatched (logged), never
  blocking the request path.
- A watcher waits at most `SearchPropagationLimits.CHILD_PROPAGATION_WAIT` (15 minutes, enough for
  the million-document service the rate limit is sized for). A task still running then, or whose
  outcome cannot be read, is left alone.
- A finished task with failures, a timeout, or any version conflict queues its **parent** in the
  search retry queue. The worker reindexes the parent and, by cascade, its children from the
  database, which is correct whatever the propagation script was.
- A parent key is queued by id when it is a UUID and by FQN otherwise
  (`SearchIndexRetryQueue.enqueueParent`).

## Consequences

Search no longer silently keeps a stale inherited field after a failed propagation; it heals
within the retry worker's cycle. The cost is one blocked watcher thread per running propagation
and a cascade reindex (capped by the worker's cascade limit) per failed one. Only parent-to-child
propagation is watched: reference-copy updates match by referenced id, and a parent reindex would
not repair them. Revisit if the retry queue shows conflict-driven requeues dominating under heavy
ingest; then drop version conflicts from the trigger.
