# A topology source keeps its run state on the instance, never on the class

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Himanshu Khairajani
- **Guard:** `ingestion/tests/unit/topology/test_per_source_state.py`
- **Related:** #36641, #35001

## Context
The service source bases declared their mutable run state as class attributes: the topology
`context`, the runner's `queue`, and the `*_source_state` sets of FQNs a run has seen. A class
attribute is one object for every source of that type in the process. Two sources overwrote each
other's context, and a second source or run inherited the FQNs the first one saw, so mark-deleted,
which deletes what is in scope but not in the set, could never find those entities stale.

## Decision
- Mutable state a run builds up lives on the source instance. A class attribute holds only
  immutable values (the `topology`) or a descriptor that creates the per-instance value.
- The queue and every `*_source_state` set are declared with `PerSourceState(factory)`
  (`metadata.ingestion.api.topology_runner`). It creates the value on first access with
  `vars(instance).setdefault`, so threads racing on first access get the same object.
- Do not use `functools.cached_property` for state a worker thread can touch first: it takes no
  lock on Python 3.12+, so two threads can each build a value and one thread's writes are lost.
  For a `*_source_state` set, a lost write means a live entity marked deleted.
- `context` stays a `cached_property` on `TopologyRunnerMixin`: `TopologyContextManager` records
  the thread that builds it as the main thread, and the runner reads `context.threads` on that
  thread before any worker starts.

## Consequences
A new service base declares its seen-entity sets with `PerSourceState(set)` and joins the guard's
`SERVICE_SOURCES`, which fails on a plain `set()` on the class. Tests no longer reset class state
between runs. Assigning the attribute (`self.database_source_state = set()`) replaces the value for
that instance only.
