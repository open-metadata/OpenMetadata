# A single-document version conflict is retried, then queued and logged as a warning

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial); v2 2026-11-19 (vector and time-series conflicts stay
  errors: the retry queue does not rebuild them)
- **Deciders:** Sonika Shah
- **Guard:** `ElasticSearchEntityManagerDeleteByScriptRetryTest`;
  `OpenSearchEntityManagerDeleteByScriptRetryTest` (shared `ScriptedDeleteRetryTestBase`);
  `SearchRepositoryBehaviorTest`; `OpenSearchVectorServiceRequestTest`;
  `ElasticSearchVectorServiceTest`; reviewer for single-document writes added later
- **Related:** ADR:2026-11-19-a-synchronous-delete-by-query-retries-version-conflicts;
  ADR:2026-10-09-synchronous-update-by-query-retries-version-conflicts

## Context

A single-document update or upsert (`updateEntity`, `createEntity`, `createTimeSeriesEntity`,
`softDeleteOrRestoreEntity`, the bulk updates of `reindexEntities`, the vector embedding update and
clear) is sent with `retry_on_conflict=3`. When other writers keep changing the same document, for
example several test results arriving for one test case, all three attempts can lose and the
engine answers 409 `version_conflict_engine_exception`. That failure was logged as an error, so
every busy document paged as a server fault even though the write is queued and repaired.

## Decision

- A version conflict is recognised by HTTP 409 **and** the error type
  `version_conflict_engine_exception` (`SearchUtils.isVersionConflict`), whichever client raised it.
  No other status or error type is treated as one.
- A conflicted update changed nothing, so resending it is safe: `SearchRetryUtil` resends single
  document updates and upserts on a conflict, as it does on a 429, at most 4 attempts with backoff.
  The vector embedding update and clear resend through their generic-request retry, at most 3
  attempts.
- A conflict left after that is a **warning** only where `SearchIndexRetryQueue` rebuilds the
  document from its entity: `updateEntity`, entity create, soft delete, and the items of
  `reindexEntities` (which now queues them). Every other failure stays an error.
- The queue's rebuild is a document merge without embedding fields, and it cannot load a
  time-series record (it removes that id instead). So a conflict that outlasts the retries on a
  vector embedding write or a time-series create stays an **error**, as do writers that queue
  nothing (pipeline status and execution documents, the admin reindex endpoint).
- The engine-neutral decisions and their logging live in `SearchUtils` (`isFinalDeleteAttempt`,
  `queueFailedUpdate`, `reportReindexFailures`); each manager keeps only its client calls.

## Consequences

- A new single-document write sends through `SearchRetryUtil.executeWithRetry`, and logs a conflict
  as a warning only if it queues the document for retry.
- A busy document can delay its writer by up to about 0.7 s of backoff before the write is queued.
- Revisit if the conflict warning shows the same documents queued often enough to matter.
