# Fuseki holds only the active ontology release

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial) · v2 2026-10-17 (rebuild excludes live drain) · v3 2026-11-06 (whole-graph journal cap bound to the Fuseki upload limit) · v4 2026-11-07 (the serving graph leaves out statement sources) · v5 2026-11-07 (staged chunked replacement, journal by release)
- **Deciders:** Harsha
- **Guard:** `IndependentOntologyActivationIT`, `OntologyReleaseProjectionTest`, `ChunkedGraphReplaceTest`, `RdfMutationReplayTest`, `RdfOntologyChunkedActivationIT`, `OntologyReleaseActivationTest`, `OntologyActiveGraphStorageTest#rebuildCannotOverwriteAnActivationDeliveredWhileItsModelWasBeingBuilt`, `RdfOntologyActivationIT`, `RdfBlueGreenRebuildIT`, `RdfLiveWriteRecoveryIT`, reviewer
- **Related:** [Organizational ontology design](../plans/2026-10-14-organizational-ontology-design.md), ADR:2026-10-14-ontology-releases-seal-canonical-sql-members

## Context

Working definitions, review candidates and older releases have different governance states.
Projecting all of them into the serving RDF dataset would mix meanings that an organization has
not selected. SQL already retains immutable release members and the active release pointer.

## Decision

Keep one asserted graph per ontology at `https://open-metadata.org/graph/ontology/{id}`. It contains
only that ontology's active release. Working edits and approval alone do not change it. Historical
releases remain readable and exportable from SQL, without separate serving graphs.

Activation requires edit permission on the ontology, a sealed release owned by it, completed
independent workflow approval, and successful structural and supported OWL 2 DL validation of its
pinned closure. Logical consistency is explicitly `NOT_RUN` until the remote Jena `CHECK` path is
available. The in-server gate does not run an OWL reasoner; OWLAPI remains a test dependency.

Compare the caller's expected activation revision under the ontology state lock. A mismatch is
409. Commit the pointer, incremented revision, append-only activation event, and durable RDF command
in one SQL transaction. Enqueue the RDF command last to retain queue commit order. Rollback uses
the same operation with an older approved release and produces another activation event.

The command carries the ontology ID and reads the current active pointer when applied. Replace the
whole graph atomically with Graph Store PUT, including an empty graph for an archived/deleted owner.
Restoration reprojects the retained active release. Graph replacement participates in the existing
rebuild journal so an activation during a rebuild survives promotion. Rebuilds reconstruct active
graphs from SQL and remove orphan ontology graphs.

RDF-disabled installations can activate releases. Enabling RDF and rebuilding projects their active
content. An unavailable Fuseki does not roll back a committed activation: the durable queue retries
and existing projection health describes lag or failure.

## Consequences

SQL is the publication authority. Fuseki is a rebuildable serving projection, with eventual delivery
and atomic per-graph replacement. The union default graph still combines IRIs shared by different
active ontologies; callers needing module isolation use a named `GRAPH`.

Older servers cannot decode the new live-write command during a mixed-version deployment; complete
the upgrade and rebuild any dead-lettered projection. Raising release/projection size limits needs
measured capture, journal and Fuseki capacity evidence. Activation checks the existing 16 MiB
encoded RDF journal limit before committing, including when RDF is disabled, so every activated
release remains replayable during a later rebuild.

## Amendment v2 — 2026-10-17: rebuild excludes live drain

`OntologyActiveGraph.rebuild` refreshes each ontology graph while holding the
`rdf_live_write_guard` 'drain' row lock through `RdfLiveWriteStore.withWriterLock`. It acquires the
lock with blocking `FOR UPDATE` before reading the active release and holds it through graph
replacement. Rebuilds must wait for this lock rather than skip a refresh.

The live drain acquires the same row with `FOR UPDATE SKIP LOCKED` and defers delivery while a
rebuild holds it. Activation can still commit and enqueue a write during that refresh; delivery
then follows the rebuild's replacement, so an older release cannot overwrite the newer activation.

## Amendment v3 — 2026-11-06: whole-graph journal cap bound to the Fuseki upload limit

A journaled graph replacement (`RdfMutation.GraphReplace`) is bounded by
`GraphReplace.MAX_GRAPH_BYTES`, 64 MiB of RDF-Thrift, instead of the 16 MiB per-entity cap that
`EntityWrite` keeps. Activation checks the same bound before it commits, with or without RDF.

The number is the Fuseki extension's default upload limit (`OPENMETADATA_MAX_UPLOAD_BYTES`, 64
MiB decompressed per request, see `docs/rdf-production-setup.md`). `replaceGraph` sends the whole
graph as one RDF-Thrift Graph Store PUT, so the journal bytes are the upload bytes, and an
activation the journal accepts is one the default Fuseki also accepts. A larger cap would let an
activation commit in SQL and then dead-letter at delivery.

Measured on MySQL by `NativeOntologyCapacityPerfIT` with the FHIR-shaped synthetic fixture: 10,000
members project to 149,742 triples and 16,637,179 bytes of RDF-Thrift, 140,037 bytes under the old
16 MiB cap, and 35,000 members to 524,434 triples and 58,393,583 bytes. A 50,000-member
release of that shape would not fit 64 MiB; the member cap is a count bound and this byte bound
decides for dense ontologies. The rebuild journal budget stays 256 MiB and 100,000 records, so one
rebuild absorbs at most four activations of the largest graph; should that bind, journal the
activation by release id and reproject from SQL on replay instead of raising the budget. The Fuseki
PUT time for a graph near the cap was not measured here: the capacity IT runs in the lane without
Fuseki, and the extension's 50 s write deadline applies to it.

## Amendment v4 — 2026-11-07: the serving graph leaves out statement sources

The active graph states each asserted statement once. `OntologyActiveGraph` projects a release
with `OntologyReleaseProjection.StatementSources.OMITTED`, so Fuseki no longer receives the
`owl:Axiom` node the projection adds per statement (`owl:annotatedSource`,
`owl:annotatedProperty`, `owl:annotatedTarget` and a `dct:source` naming the release member).
Activation measures the same projection it delivers. Exports, release and draft SPARQL queries
and validation keep the sources (`ANNOTATED`, the default), because the importer reads them back
(`NativeOntologyRdfReader.recordAxiomSource`) to recognise a native export and re-import it
without changes.

Nothing reads the sources from Fuseki. The service's SPARQL, the MCP tools, search, insights,
inference and the Studio APIs (which read SQL) never name `owl:Axiom` or `owl:annotated*`, and
neither do `openmetadata.ttl`, `RdfOntologyContractTest` (the entity projection) or
`RdfRoundTripFidelityIT` (glossary exports). The only reader is the importer, and it reads export
files.

The sources were most of the graph. Measured on the upstream FIBO production quickstart (9,941
members) and FHIR R5 (16,568 members) imported and sealed in memory: FIBO projects to 30,133
triples and 5,032,083 bytes of RDF-Thrift instead of 157,928 triples and 21,670,556 bytes, and
FHIR to 58,567 triples and 6,154,701 bytes instead of 247,162 and 27,899,511. Building and
encoding the projection took 117 ms instead of 249 ms for FIBO and 178 ms instead of 366 ms for
FHIR (best of three). English ESCO with its occupation-skill links goes from 389.9 MB to 66.7 MB.
The v3 numbers were measured with the sources included.

A SPARQL user who read statement provenance from the active graph gets no rows; the member that
states a triple is in the release export and in SQL. The active release stays visible as the
ontology's `owl:versionIRI`.

## Amendment v5 — 2026-11-07: staged chunked replacement, journal by release

This amendment replaces the single Graph Store PUT of the decision and the journal cap of v3.

`replaceGraph` cuts the graph into chunks of at most `rdfConfiguration.graphReplaceChunkBytes`
(`RDF_GRAPH_REPLACE_CHUNK_BYTES`, default 16 MiB, at most 64 MiB, the extension's upload limit).
The size of a chunk is an estimate that overstates its RDF-Thrift encoding. Each connected
blank-node structure travels whole in one chunk; a structure larger than a chunk travels alone, and
one larger than 64 MiB is refused before anything is sent. RDF-Thrift keeps blank node labels
across requests, so this is not needed for identity, but it keeps every chunk a well-formed graph
on its own. A graph that fits one chunk is still one PUT of the live graph. A larger graph:

1. drops every staging graph an earlier attempt left for this live graph;
2. PUTs each chunk into `https://open-metadata.org/graph/staging/<first 16 bytes of the
   SHA-256 of the live graph IRI, hex>/<attempt id>/<index>`, where the attempt id is a random
   UUID;
3. sends one SPARQL update: `ADD GRAPH <chunk> TO GRAPH <chunk>` for each chunk, `DROP SILENT`
   of the live graph, one `INSERT { GRAPH <live> { ?s ?p ?o } } WHERE { VALUES ?staged { <chunk>
   ... } GRAPH ?staged { ?s ?p ?o } }`, and `DROP SILENT` of each chunk.

One update is one TDB2 transaction, so a reader of the live graph sees the old release or the new
one, never a mix. Adding a graph to itself changes nothing, but it fails when the graph is
missing, and the failure aborts the whole request. A swap whose chunks are gone therefore changes
nothing: a newer attempt dropped them, or the same swap already committed. A failure before the
update leaves the live graph as it was, and the next attempt drops the stale staging graphs
first. The ontology graph refresh is a replayable live write, so the live-write queue retries the
whole replacement.

The copy is not `MOVE` and `ADD`. Jena 6.2.0 runs both as `GraphOps.addAll(dest, src.find())`, which
iterates the source while inserting into the same TDB2 quad indexes inside one write transaction,
and that iteration skips triples. Which triples it skips depends on what the dataset held before.
FIBO with sources (157,928 triples), replaced in 1 MiB chunks in a dataset where
`RdfOntologyChunkedActivationIT` had run, served 157,898 every time: six `owl:Axiom` structures of
the last chunk were skipped by its `ADD`, and the `DROP` that followed deleted their only copy. An
embedded TDB2 replay of the same swap lost triples in 20 of 21 trials, and in 17 of 21 with every
`DROP` moved to the end. `INSERT WHERE` collects its solutions before it writes and lost none in 32
trials. Fuseki accepts only one operation with a `WHERE` clause per request when `arq:updateTimeout`
is set, so the copy is one operation over a `VALUES` list of the chunks.

Collecting the solutions costs Fuseki heap. On the pinned image with a 512 MiB heap, a copy of
762,718 triples took 8.1 s and one of 1.78 million failed with `Java heap space` and rolled back.
With a 1,500 MiB heap, 1.78 million took 15.0 s and 2.5 million took 23.9 s. A graph at the
256 MiB bound below holds about 1.5 to 2 million triples (ESCO spends 174 bytes of RDF-Thrift a
triple, FIBO with sources 137), so it needs at least the development heap of 1,500 MiB; the
production default `FUSEKI_HEAP` is 4 GiB.

Staging graphs are outside the ontology graph prefix, so a rebuild neither reprojects nor deletes
them as orphans, and `AssertedOnlyQueries` excludes them from the asserted graphs when materialized
inference is on. Every other read of the union default graph can see staged triples beside the old
release: the SPARQL endpoint, the MCP tools that query or describe entities, semantic search, the
reasoning and validation endpoints, and the asserted-only reads when inference is off. It sees them
from a replacement's first chunk until its swap commits, and after a failed attempt until the next
attempt drops them. Inference materialization also reads the union, so a run in either window can
derive conclusions from staged triples. Those conclusions do not outlive the window: a replacement
that succeeds marks every rule dirty, and the next run clears every rule graph before it recomputes.

The journal stores the release, not its bytes. `RdfMutation.GraphReplace` records the graph and
the release id (`replaceReleaseGraph`), and replay projects that release again from SQL through
`OntologyActiveGraph.releaseModel`. A sealed release does not change, so the replayed graph is the
graph that was delivered. No release, or a release since deleted, replays as an empty graph. An
entry journaled by an older server (`replaceGraph`, with base64 RDF) no longer decodes, so a
rebuild that spans the upgrade fails to promote instead of replaying it; run the rebuild again
after the upgrade.

The journal and the upload limit no longer bound the graph, so activation checks
`OntologyActiveGraph.MAX_GRAPH_BYTES`, 256 MiB of RDF-Thrift, with or without RDF. The bound comes
from the final update, which holds TDB2's writer under the server's 50 s update deadline. Measured
on `openmetadata/fuseki:6.2.0-318ff87` with its databases on tmpfs, best of three, with the
`MOVE` and `ADD` swap this amendment first shipped:

| Graph | Triples | RDF-Thrift | One PUT | Chunked, 16 MiB | Chunked, 1 MiB |
|---|---|---|---|---|---|
| FIBO quickstart, with sources | 157,928 | 21,670,556 | 1,082 ms | 3,046 ms | 3,003 ms |
| FIBO quickstart, served | 30,133 | 5,032,083 | 205 ms | 211 ms (one PUT) | 519 ms |
| FHIR R5, with sources | 247,162 | 27,899,511 | 1,817 ms | 4,748 ms | 4,682 ms |
| FHIR R5, served | 58,567 | 6,154,701 | 393 ms | 395 ms (one PUT) | 1,021 ms |
| English ESCO with links, served | 357,307 | 62,117,620 | 2,807 ms | 7,141 ms | not run |

Activation of FIBO now delivers in 211 ms instead of 1,082 ms, and FHIR in 395 ms instead of
1,817 ms, because v4 removed the sources and the served graph fits one chunk. ESCO's six chunks
took about 0.5 s each and its update 4.0 s. These runs served every triple; the loss described
above appeared only once other tests had written to the dataset first. With the `INSERT WHERE`
swap, FIBO with sources took 3,161 ms in 16 MiB chunks (best of three) and about 3.2 s in 1 MiB
chunks, and served 157,928 triples in all eight runs after `RdfOntologyChunkedActivationIT`.
ESCO's update took 5.0 s over a served graph. A 256 MiB graph spends about 21 s in the update at
that rate, and the 2.5 million triple copy above took 23.9 s. A slower persistent volume or a busy
writer lowers the margin. The server holds the whole projection and its chunks in memory during a
replacement, and Fuseki holds every copied triple during the update, so heap on both sides limits
a graph near the cap.
