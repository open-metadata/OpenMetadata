# A synchronous update-by-query proceeds past version conflicts and retries them while a repeat is safe

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `UpdateByQueryReconcilerTest`; `ElasticSearchEntityManagerUpdateByQueryRetryTest`;
  `OpenSearchEntityManagerUpdateByQueryRetryTest`; reviewer for helpers added later
- **Related:** #35024; collate#5549 (update scripts generated from declared rules)

## Context

A parent's change reaches many search documents through one update-by-query: renames by name
prefix, domain and data product moves, relationship and lineage updates, the soft delete and
restore of children. If another write touches one of those documents while the query runs, the
engine reports a version conflict for it. With `conflicts=proceed` that document was skipped and kept
its old value until the next reindex; with the default `abort` the query stopped, and the documents
after it kept their old values too. Most helpers logged neither. The database was right; search was
not.

Column lineage already retried its conflicts (`ColumnLineageReconciler`); the other helpers did not.

## Decision

- Every update-by-query the server waits for, in `ElasticSearchEntityManager` and
  `OpenSearchEntityManager`, runs with `conflicts=proceed` through `UpdateByQueryReconciler`.
- After an attempt with version conflicts and no shard failure, the reconciler refreshes the target
  indices and runs the query again, **at most 3 attempts** in total: the budget column lineage
  already used, now shared. A conflict means a concurrent writer, which has usually landed by the
  next refresh.
- A query runs again only when its script gives the same result applied twice to a document, since a
  repeat also rewrites the documents the previous attempt already changed. A prefix rename whose new
  prefix nests under the old one (`a` to `a.b`) is not safe and runs once. A helper that runs a
  caller's script states this requirement on its interface method.
- Shard failures are never retried; they are logged as errors.
- Conflicts left after the last attempt are logged as a warning with the operation, the indices, the
  count and the attempts made. When the caller knows the document ids, those ids go to the search
  retry queue.
- Child updates sent to the cluster as background tasks (`wait_for_completion=false`) are out of
  scope: the server does not wait for them, so the request has nothing to retry.

## Consequences

- A new synchronous update-by-query goes through the reconciler with a replay-safety flag. Calling
  `client.updateByQuery` directly, or keeping the default `abort`, contradicts this record.
- A conflicted document costs at most two more queries and two refreshes of the target indices.
- When update scripts are generated from declared rules (collate#5549), each rule has to say
  whether it is safe to repeat.
- Revisit if the leftover-conflict warning shows documents still held after 3 attempts often
  enough to matter.
