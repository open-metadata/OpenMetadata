# A repository write commits as one transaction, retried whole, and publishes its effects after the commit

- **Status:** Accepted
- **Revisions:** v1 2026-10-07 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `RepositoryTransactionRunnerTest`, `RepositorySideEffectScopeTest`,
  `TransactionRollbackTrackerTest`, `EntityTransactionBoundaryIT`, `EntityHardDeletionAtomicityIT`
  and `EntitySubtreeAtomicityIT`
- **Related:** `docs/plans/2026-10-06-database-search-indexing-design.md` (the capture boundary),
  `docs/plans/2026-10-06-database-projection-implementation.md` (stage 1)

## Context

An entity flush opened its transaction on `Entity.getJdbi()`, which does not bind the on-demand DAO
graph, so a nested repository write could commit on its own connection. A deadlock rolls back the
whole transaction, so a retry nested inside another boundary replayed only its own part and
committed a fragment. The search, lineage, RDF-tag, cache and post-commit effects collected during
an attempt have to be dropped when it rolls back and published once when it commits, and none of
them may run while a pooled connection is held.

## Decision

- `RepositoryTransactionRunner` runs every entity flush and every multi-repository unit: one
  transaction on the thread's DAO handle (`CollectionDAO.withHandle`, then `inTransaction`).
- Only the outermost boundary retries a deadlock, by replaying everything. A nested call joins the
  open transaction; a transaction a caller opened itself (a raw `inTransaction` or a `@Transaction`
  SQL object method) propagates the deadlock to that caller, and the unit's effects wait for that
  transaction: its commit publishes them, a rollback drops them.
- `RepositorySideEffectScope` collects the effects of each attempt, clears them on rollback or
  replay, and runs them once after the final commit, each step guarded so one failure does not
  skip the rest. Nothing it runs holds an open transaction.

## Consequences

A unit of work is atomic, which the projection capture journal depends on: its facts commit with
the rows they describe or not at all. A new write path joins this boundary rather than opening a
transaction of its own; one that must open its own transaction owns its deadlock retry. Effects
that need to see committed rows belong in the scope, never inside the transaction body.
