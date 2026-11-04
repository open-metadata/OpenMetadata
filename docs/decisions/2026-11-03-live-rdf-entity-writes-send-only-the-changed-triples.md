# Live RDF entity writes send only the changed triples

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** OpenMetadata RDF maintainers
- **Guard:** `RdfEntityWritePlannerTest`, `RdfOwnedResourcesTest`, `RdfEntityDiffWriteIT`,
  `RdfLiveWriteRecoveryIT`, `RdfLiveWriterTest`, `InferenceInvalidatingRdfStorageTest`,
  `AssertedGraphTrackingRdfStorageTest`
- **Related:** #36671, #36437,
  ADR:2026-10-28-rdf-storage-maintenance-pauses-serving-writes-and-compacts-on-a-schedule

## Context

Every live entity write deleted the entity's whole projection and inserted the new one, even when
nothing had changed. TDB2 copies every index page a write touches, so each write of a wide table
cost about 750 KB of disk until the next compaction, and a nightly ingestion of 60,000 to 75,000
writes grew the volume by 45 to 55 GB. RDF lists were blank nodes that no write could name, so every
rewrite also left the previous list's cells behind.

## Decision

- `RdfStorageInterface.storeEntity` reads the triples a full replacement would delete (the scope in
  `RdfEntityScope`, unchanged), compares them with the new projection, and sends one
  `DELETE DATA` / `INSERT DATA` request with only the difference, or nothing. A projection's triples
  outside that scope, such as tag labels and referenced entities' types, are only inserted when
  missing. Literals of the same datatype and value count as equal, because TDB2 stores numbers and
  dates by value and can return them in a different lexical form than was written.
- The result says whether the graph may have changed. A write that changed nothing does not mark
  inference results stale or relist the asserted graphs.
- The write replaces the projection whole (`RdfEntityWriteStrategy.REPLACE`) instead when the store
  or the projection holds a blank node, or when the difference is larger than the projection.
- List cells are named `<entity>/list/<URL-encoded predicate>/<index>` and are owned by the entity,
  so a write deletes the cells of a list it replaces or removes. A list stored with blank cells is
  replaced once, cells included.
- A queued write whose earlier attempt failed or was held up after reaching Fuseki is redelivered as
  a replacement. Fuseki can still be applying that attempt after OpenMetadata stopped waiting: its
  HTTP client has no request timeout and `arq:updateTimeout` does not count the wait for TDB2's
  writer. A read taken meanwhile does not see the attempt, so a difference or a skip computed from it
  could leave the attempt's triples, or miss ones it deleted. A replacement evaluates its delete when
  Fuseki applies it. The queue row carries the signal: every failed attempt records `lastError`,
  and a write held up by a compaction records it too, without using an attempt. The row is read by
  whichever server drains next, so it holds across restarts and servers and nothing is evicted.
- Bulk reindex writes, relationship writes and the rebuild journal are unchanged; the journal keeps
  the full projection, because the rebuild dataset is projected on its own.

## Consequences

- An unchanged update costs one read and no write transaction; a small change costs one small write.
  On `scripts/rdf-live-update-benchmark.sh` (200 tables of 300 columns, 1,000 writes per scenario,
  one Fuseki container), dataset growth per write fell from about 20 MB to 0 for unchanged
  updates, 173 KB for a moved column tag and 205 KB for a new description; the payload fell from
  344 MB to under 0.5 MB per scenario.
- Every queue entry that failed before is redelivered as a full replacement. Such writes are rare,
  and a replacement is what every write cost before this decision.
- Limits of the redelivery rule. Fuseki decides the order in which an abandoned request and its
  retry apply; if the abandoned request applies last, the graph is wrong until the entity's next
  write, as it was before this decision. Writes outside the queue are not retried and already mark
  the projection degraded on failure. A dead-lettered write leaves the projection degraded, and a
  reindex repairs it.
- Resources a projection emits but its entity does not own keep their stale triples, as before:
  lifecycle and access details, table constraints, profile measurements, pipeline runs and
  `datasetByFqn` nodes. Cleaning them up, and list cells or blank nodes earlier writes left attached
  to nothing, is a follow-up; a successful `recreateIndex: true` reindex removes all of them today.
- During a rolling upgrade an older server can still fully rewrite an entity. Its delete does not
  know the named list cells, so the cells of the list it replaces stay until a reindex.
- Revisit if relationship writes, which still delete and reinsert their edge, show up in disk growth,
  or if Fuseki gains a way to make an update conditional on what it read.
