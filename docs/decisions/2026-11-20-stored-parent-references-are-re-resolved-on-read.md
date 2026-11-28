# Stored parent references are re-resolved on read

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial)
- **Deciders:** a-kash-singh (proposed in #38283)
- **Guard:** `DirectWritesSearchIT.renamingTheDatabase_reachesItsTables`, `DirectWritesSearchIT.renamedParents_reachUntouchedChildrenInBulkReads`
- **Related:** #38253, #38283

## Context
A table's stored JSON keeps its `database` and `databaseSchema` references, and a schema's keeps
its `database` reference, as snapshots taken when the row was written, `displayName` included.
Renaming a parent rewrites none of them. Every later rebuild of a child's search document,
including a Recreate reindex, read the stale snapshot, so the Explore tree showed the renamed
database twice (#38253).

## Decision
- `TableRepository` re-resolves a table's `database` and `databaseSchema` references by id on
  every read (`setFields`, `setFieldsInBulk`).
- `DatabaseSchemaRepository` does the same for a schema's `database` reference.
- The lookup goes through the entity cache (`EntityRepository.currentReference`), once per
  distinct parent in a batch. A parent that cannot be found keeps the stored reference.
- Stored procedures read their `database` through their schema, so they follow without a change.
- Stored rows are healed on read and by the next reindex, not by a migration. The stored
  snapshot is still written; only reads stop trusting its names.

## Consequences
- A parent rename reaches API reads and rebuilt search documents without rewriting children.
- Each single-entity read costs a cache lookup per parent reference; a bulk read costs one per
  distinct parent.
- A new child type that stores a parent reference in its JSON needs the same swap, or it shows
  stale names. Stripping parent references from stored JSON instead would remove the snapshot,
  but the fast read paths depend on the stored ids.
