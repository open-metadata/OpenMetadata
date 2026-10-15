# A memory's outcome counters are recounted telemetry that only the outcome write sets

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ContextMemoryOutcomeWriteSqlTest` (absolute, monotonic and preserved on both
  engines), `ContextMemoryWriteAccessIT` (admin or bot only, stale recount refused, a PATCH
  cannot change them in the database or the index, an uncounted memory indexed without them),
  `ContextMemoryRepositoryTest`, `ContextMemoryIndexTest`, `ContextMemoryIndexMappingTest`,
  `ContextCenterPureUtils.test.ts` (usage shown until a recount stamps `countedAt`)
- **Related:** open-metadata/ai-platform#1581;
  ADR:2026-10-10-memory-content-recency-and-usage-are-independent-of-review-writes;
  ADR:openmetadata-collate/2026-10-14-memory-usage-counts-persisted-answers

## Context

`usageCount` counts retrievals, so it cannot say whether a memory helped. Collate records what
happened to each saved answer a memory was applied to: the answer itself, its votes, and any
captured memory that corrects it. Those outcomes have to reach the memory so ranking, reconciliation
and Context Center can read them. Counting them with per-event increments loses counts when an
event is replayed, and a vote can be withdrawn or changed, which an increment cannot undo.

## Decision

- A memory carries `outcomes`: `appliedCount`, `positiveCount`, `negativeCount`,
  `correctedCount`, `lastAppliedAt`, `lastCorrectedAt` and `countedAt`. Votes count the latest
  vote of each voter on each answer.
- The service that records outcomes recounts them and writes absolute values through one write:
  `ContextMemoryDAO.recordOutcomes`, used by `MemoryOutcomeWriter` and by
  `PUT /v1/contextCenter/memories/{id}/outcomes` (admins and bots only). It replaces `outcomes`
  on a live memory, keeps the version and every timestamp, invalidates the cache and reindexes.
- The write is skipped when the stored `countedAt` is later than the recount's, so a retry or an
  overlapping recount never moves the counts backwards. The endpoint answers 409 then.
- Metadata writes keep the stored `outcomes`, exactly like usage. The updater also copies the
  stored telemetry onto the entity it returns and indexes, so a request cannot put values in search
  that the database refused.
- `outcomes` is not in the create request and never enters version history.
- The search index carries `outcomes` only once a memory is counted, never zero-filled, because
  lists read from search build their memories from it.

## Consequences

- Counts are idempotent: recounting the same events gives the same values, and a vote change is
  just a different recount.
- Context Center reads `outcomes.appliedCount` and `lastAppliedAt` as "Cited", and shows helpful,
  unhelpful and corrected counts. A memory with no `outcomes` yet, or outcomes no recount stamped
  with `countedAt`, still shows its legacy `usageCount`. "Most used" sorts by
  `outcomes.appliedCount`, and a memory never counted has no such value, so it sorts last.
- Nothing in OpenMetadata alone records outcomes. Without a recording service, `outcomes` stays
  empty and the UI keeps showing usage.
- Existing indexes need a reindex to type the new fields; until then dynamic mapping types the
  counts as numbers and the times as numbers too.
- Three generic writes still replace the whole document from a snapshot and do not preserve
  telemetry: the change-summary patch, bulk soft delete and bulk import. They predate this record
  and lose usage the same way.
