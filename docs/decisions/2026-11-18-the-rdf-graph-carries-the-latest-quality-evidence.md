# The RDF graph carries the latest quality evidence of each table, column and test case

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** OpenMetadata RDF maintainers
- **Guard:** `RdfQualityProjectionTest`, `RdfQualityEvidenceTest`, `QualityWritesRefreshRdfTest`,
  `RdfEntityWritePlannerTest#aNewerTestResultReplacesTheOlderOneAndDeletingTheTestCaseRemovesIt`,
  `RdfReindexerTest#everyPageIsWrittenWithTheQualityEvidenceLoadedOntoItsEntities`,
  `RdfLiveWriterTest`, `RdfLiveWriteRecoveryIT#aRefreshQueuedAgainLaterIsRetiredWithoutBeingApplied`,
  `RdfQualityEvidenceIT`, `RdfOntologyContractTest`
- **Related:** ADR:2026-11-03-live-rdf-entity-writes-send-only-the-changed-triples,
  ADR:2026-10-26-the-rdf-graph-projects-the-live-catalog-only,
  ADR:2026-10-11-rdf-freshness-watermarks-have-one-writer-per-table

## Context

A model writing SQL, or judging whether a number can be trusted, needs to see how the data looks
and whether it is healthy. Profiles, test results and incidents live in time-series tables, not in
the entity rows, so the projection never saw them. A model reads the graph through node cards: a
card shows a node's literal values as facts, and anything behind an edge costs another call.

## Decision

- **Latest only, loaded on projection.** `RdfQualityEvidence` reads the newest profile, result and
  incident rows in batches and attaches them before translation, for the live replay
  (`RdfProjectionLoaders`) and the reindex pages (`RdfReindexer.repositoryPages`) alike.
- **Profiles are facts on the profiled node**: `om:profileRowCount`, `om:profileColumnCount`,
  `om:profileSizeInBytes` on a table; values, nulls (count and proportion), distinct and unique
  counts, mean, numeric min and max, min and max length on a column; `om:profiledAt` on each. They
  are the node's own triples, so the entity write replaces them exactly. A fully profiled table
  with N columns adds at most 4 + 11·N triples. They are not DQV measurement nodes: at 2.4 million
  columns those would have been about 140 million triples and a second call per column. The DQV
  terms stay declared, not stored, so a DQV view can be derived from the facts later.
- **Test cases.** `om:testsEntity` (the table, inverse of `om:testedBy`) and, while the column
  resolves, `om:testsColumn`. The latest status and time are facts on the test case
  (`om:latestResultStatus`, `om:latestResultAt`); the details are on `<test case>/result/latest`
  (message, rows, bounds, observed values). An unresolved incident is `<test case>/incident/open`
  with state, severity and assignee, and leaves when it is resolved. Sample rows are never emitted.
- **Live triggers.** A profile write or delete queues its table; a result updates its test case,
  whose entity hook queues it; an incident status change queues its test case. A table refresh
  that changes a column's tags requeues the table's test cases, because masking depends on them.
- **Repeated refreshes collapse.** A queued entity refresh is retired without being applied when
  the same refresh is queued again within the next 100 rows: it reads the entity when applied, so
  the later copy projects the same state or a newer one. Retirement goes through `retire`, so the
  watermarks stay exact.
- **PII, fail closed.** The graph gets what an API caller without PII access gets (`PIIMasker`),
  judged on tags the evidence reads itself, never on whatever tags the caller loaded: no profile
  for a `PII.Sensitive` column or the fields beneath one, no result or incident for a test on such
  a column or on a table that does not resolve.

## Consequences

- **Access.** Through the API a profile needs the view-profile permission on its table and a
  result or incident the tests permission. In the graph they are readable by anyone allowed to
  query it. Filtering the graph per asset is deferred by decision of the project owner.
- The write scope still deletes DQV measurement nodes and their links, so stores written by an
  earlier build of this branch clean up on the next write.
- The legacy `om:incidentStatus` JSON literal on test cases is no longer written.
- A live table refresh reads the table's column tags from the store before writing, and its
  evidence costs two batch reads; a test case refresh costs a result, an incident and a table read.
- A result written while RDF was off appears after a reindex or the next write of its test case.
  Existing stores hold no evidence until a reindex.
- Revisit if the per-column measure set must grow, or if profile history becomes a graph need.
