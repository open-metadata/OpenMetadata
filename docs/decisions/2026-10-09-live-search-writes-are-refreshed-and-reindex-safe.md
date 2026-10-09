# A live search write is searchable when it returns and follows a reindex in progress

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `SearchRepositoryBehaviorTest` (the live write cases: staged routing, refresh scope,
  failures, empty input, one upsert for both paths); `EntityIndexWriteTest`;
  `AssetsTabSearchEntriesIT`
- **Related:** collate #1526; ADR:2026-10-09-bulk-edits-compose-single-entity-writes

## Context

An entity's search document was written two ways after a save. A single write sent a scripted
upsert with `refresh=true` to the index live writes go to, which is the staged copy while a reindex
builds one. A batched write (restore, CSV import, test suites, glossary renames, bulk edits) went
through the reindex pipeline's bulk sink instead: no refresh, the canonical index even during a
reindex, a whole-document replace, and no delete of a removed column's entry.

So after a batch the documents were not searchable yet, an update-by-query that followed (a data
product's domain move, child propagation) skipped them as version conflicts, and an edit made during
a reindex was lost when the staged copy was promoted.

## Decision

- **A live write is searchable when it returns**, single or batched: the batch sends its writes
  unrefreshed and then refreshes, once, every live index it wrote.
- **A live write follows a reindex in progress**: its index comes from `getWriteIndexName`, the
  staged copy while one is being built. A staged copy is not refreshed by live writes; the reindex
  refreshes it when it promotes it.
- **Live writes have one writer.** `SearchRepository.buildEntityIndexWrite` builds what is sent for
  an entity, and the single write and the batch both use it. The engine clients send it as the same
  scripted upsert (`retryOnConflict(3)`), alone with `refresh=true` or in bulk requests of
  **100** items or the bulk payload cap. A batched table rebuilds its column entries with
  `ColumnSearchIndex`, after deleting the old ones when its columns changed.
- A batch loads what its documents read from the database (lineage, service styles, test
  relationship revisions) once for the batch, as the reindex does, not once per document.
- A write that fails goes to the search retry queue, which rebuilds the document from the stored
  entity, and its entity is left out of child propagation.
- The reindex keeps its own pipeline, the bulk sink, and so does the retry worker.

## Consequences

- Anything that reads search after a batched save, a user or a following update-by-query, sees
  the save.
- A batch costs one refresh per index written, not one per document.
- A change to how an entity is indexed is made once, in the builder, and reaches both paths.
- 100 items per bulk request keeps a request small enough to send synchronously on the request
  thread; a larger batch is split.
