# The RDF graph carries the latest quality evidence of each table, column and test case

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** OpenMetadata RDF maintainers
- **Guard:** `RdfQualityProjectionTest`, `RdfQualityEvidenceTest`, `QualityWritesRefreshRdfTest`,
  `RdfEntityWritePlannerTest#aNewerTestResultReplacesTheOlderOneAndDeletingTheTestCaseRemovesIt`,
  `RdfReindexerTest#everyPageIsWrittenWithTheQualityEvidenceLoadedOntoItsEntities`,
  `RdfLiveWriterTest`, `RdfLiveWriteRecoveryIT#aRefreshQueuedAgainLaterIsRetiredWithoutBeingApplied`,
  `RdfLiveWriteRecoveryIT#anOldRefreshIsAppliedEvenWhenAnotherCopyIsPending`,
  `RdfLiveWriteRecoveryIT#aCopyOutsideTheNextHundredRowsDoesNotRetireTheHead`,
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
  that changes the set of columns or any column's tags requeues the table's test cases before
  storing the projection. The comparison includes untagged and nested columns. If a column is
  dropped or renamed and the old path no longer resolves, the replayed test case loses its
  `om:testsColumn` link and evidence. A failed requeue leaves the prior projection for retry.
- **Repeated refreshes collapse.** A queued entity refresh younger than 60 seconds is retired
  when the next 100 rows contain the same refresh. The later copy reads current state when applied.
  The age cap gives brief bursts time to coalesce and ensures an old refresh is applied when it
  reaches the head, even if new copies keep arriving. The row limit bounds the work per lookup.
  Retirement goes through `retire`, which preserves the watermarks.
- **PII, fail closed.** The graph gets what an API caller without PII access gets (`PIIMasker`),
  using tags the evidence reads itself. A `PII.Sensitive` column and the fields beneath it have
  no profile. A test on a sensitive column or an unresolved column or table has no result or
  incident in the graph. The graph and entity RDF endpoint use the same test case masking helper
  as the test-case API. It clears the result, incident status, parameter values, description and
  both change descriptions. RDF keeps the stored test case name for graph labels. A reindex
  removes masked fields from existing projections.

## Consequences

- **Access.** Granting `ExecuteSparqlQuery` on the RDF resource grants read access to projected
  profile values and test results through the `sparql_query` MCP tool and
  `/v1/rdf/sparql/agent`. These reads do not require the REST API's per-table `ViewDataProfile`
  and `ViewTests` permissions. Operators should grant `ExecuteSparqlQuery` accordingly.
  The project owner deferred per-asset filtering to a follow-up.
- The write scope still deletes DQV measurement nodes and their links, so stores written by an
  earlier build of this branch clean up on the next write.
- The legacy `om:incidentStatus` JSON literal on test cases is no longer written.
- A live table refresh reads the projected column IRIs and their tags from the graph. Table
  evidence uses two profile batch reads (table and column profiles, chunked as needed) and one
  `populateEntityFieldTags` call per table. Test case evidence uses two batch reads (results and
  incidents) and one `getEntityByName` call per distinct tested table in the batch.
- A result written while RDF was off appears after a reindex or the next write of its test case.
  Existing stores hold no evidence until a reindex.
- Revisit if the per-column measure set must grow, or if profile history becomes a graph need.
