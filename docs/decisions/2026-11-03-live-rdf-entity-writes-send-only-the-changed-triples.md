# Live RDF entity writes send only the changed triples

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** OpenMetadata RDF maintainers
- **Guard:** `RdfEntityWritePlannerTest`, `RdfOwnedResourcesTest`, `RdfEntityDiffWriteIT`,
  `EntityWriteCircuitBreakerTest`, `RdfMutationReplayTest`
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
- The result says whether the graph may have changed.
- The write replaces the projection whole (`RdfEntityWriteStrategy.REPLACE`) instead when the store
  or the projection holds a blank node, or when the difference is larger than the projection.
- List cells are named `<entity>/list/<URL-encoded predicate>/<index>` and are owned by the entity,
  so a write deletes the cells of a list it replaces or removes. A list stored with blank cells is
  replaced once, cells included.
- After sending a difference, the write reads the projection back and replaces it whole when it
  differs (outcome `corrected`). A difference is computed from a read, and a write already queued
  for TDB2's writer when that read ran commits between the read and the update: a request
  OpenMetadata stopped waiting for (its HTTP client has no request timeout and `arq:updateTimeout`
  does not count the wait for the writer), a reindex chunk that timed out, or the request of a
  server that died sending it. TDB2 admits writers in arrival order (a fair semaphore in Jena
  6.2.0), so once the update has returned every write queued before it has committed, and the
  read-back sees them. A replacement evaluates its delete when Fuseki applies it, so it leaves the
  projection regardless. Nothing outside the write marks it uncertain, so no queue state, restart or
  server boundary is involved.
- Bulk reindex writes, relationship writes and the rebuild journal are unchanged: journal replay
  replaces, because a read and a read-back per replayed write would spend the promotion's replay
  budget. The journal keeps the full projection, because the rebuild dataset is projected on its own.

## Consequences

- On 2.0 this is a backport of #37069. 2.0 has no live inference invalidation and does not project
  a table's columns, so the column part of the entity scope matches nothing there. The benchmark on
  2.0 uses tables wide in custom properties instead (200 tables of 300, 1,000 writes per scenario):
  growth per write fell from about 10.9 MB to 0 for unchanged updates, 235 KB for one changed
  property and 188 KB for a new description, and the payload from 227 MB to under 0.5 MB per
  scenario. Both strategies left the same 243,207 triples.
- An unchanged update sends no write: it reads the entity's scope, plus one existence read per
  1,000 triples it emits outside that scope (tag labels, referenced entities). A changed update
  sends one small write and reads the projection back the same way; reads do not grow TDB2's files.
  On `scripts/rdf-live-update-benchmark.sh` (200 tables of 300 columns, 1,000 writes per scenario,
  one Fuseki container), dataset growth per write fell from about 20 MB to 0 for unchanged
  updates, 173 KB for a moved column tag and 184 KB for a new description, read-back included;
  the payload fell from 344 MB to under 0.5 MB per scenario.
- Limits. A write is repaired only from writes queued ahead of it. A write *sent* after it with an
  older projection, such as a reindex chunk read before the entity changed, leaves its stale
  triples until the entity's next write, as it did before this decision. An unchanged update sends
  nothing, so a stale write still queued in Fuseki that commits after it is not repaired either;
  before this decision a replacement queued behind it would have been. Right after a compaction
  ends, the writers it held race for TDB2's writer in no set order, so a stale one can commit after
  the read-back. A dead-lettered write leaves the projection degraded, and a reindex repairs it.
- Resources a projection emits but its entity does not own keep their stale triples, as before:
  lifecycle and access details, table constraints, profile measurements, pipeline runs and
  `datasetByFqn` nodes. Cleaning them up, and list cells or blank nodes earlier writes left attached
  to nothing, is a follow-up; a successful `recreateIndex: true` reindex removes all of them today.
- During a rolling upgrade an older server can still fully rewrite an entity. Its delete does not
  know the named list cells, so the cells of the list it replaces stay until a reindex.
- Exports in Turtle and RDF/XML (`GET /v1/rdf/entity/{type}/{id}`) show a list as named
  `rdf:first`/`rdf:rest` resources instead of a `( … )` collection, which only blank cells can be
  written as. The graph means the same and SPARQL `rdf:rest*/rdf:first` paths still match; JSON-LD
  export does not use the cells.
- Revisit if relationship writes, which still delete and reinsert their edge, show up in disk growth,
  if `corrected` writes become common (Fuseki timing out routinely), or if a Jena upgrade stops
  admitting writers in arrival order.
