# A synchronous delete-by-query proceeds past version conflicts and retries them against a refreshed index

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** Sonika Shah
- **Guard:** `ElasticSearchEntityManagerDeleteByScriptRetryTest`;
  `OpenSearchEntityManagerDeleteByScriptRetryTest` (shared `ScriptedDeleteRetryTestBase`);
  `TestCaseSnapshotStoreTest`; reviewer for delete helpers added later
- **Related:** #36292 (scripted delete retry);
  ADR:2026-10-09-synchronous-update-by-query-retries-version-conflicts

## Context

A delete-by-query reads its matches from the last refreshed view of the index, then deletes each
one by the version it saw. A document rewritten since that refresh, for example a column entry
updated by the previous table change, is a version conflict. With the default `abort` the request
fails with 409 and deletes nothing; the caller then skips the rest of its work (a table's column
entries are not rebuilt, a deleted parent's children stay searchable). #36292 fixed this for the
scripted delete only; deletes by fields, by FQN prefix and by range still aborted.

## Decision

- Every delete-by-query the server waits for, in `ElasticSearchEntityManager` and
  `OpenSearchEntityManager`, runs with `conflicts=proceed` through the manager's `deleteWithRetry`.
  A raw `_delete_by_query` sent through `rawSearchRequest` (`TestCaseSnapshotStore`) follows the
  same rule in its own loop.
- After an attempt with version conflicts and no failure or timeout, the target indices are
  refreshed and the delete runs again, **at most 3 attempts** in total, the budget update-by-query
  already uses. A delete is always safe to repeat: a document already deleted no longer matches.
- Failures and timeouts are never retried; they are logged as errors. Conflicts left after the last
  attempt are logged as a warning with the indices, the count and the attempts made.

## Consequences

- A new synchronous delete-by-query builds its request with `conflicts=proceed` and goes through
  `deleteWithRetry`. Calling `client.deleteByQuery` directly, or keeping the default `abort`,
  contradicts this record.
- A conflicted delete costs at most two more queries and two refreshes of the target indices.
- A delete no longer throws on a version conflict, so a caller that relied on the exception (for
  example to queue a retry) now sees success with any leftover conflicts in the warning log.
- Revisit if the leftover-conflict warning shows documents still held after 3 attempts often
  enough to matter.
