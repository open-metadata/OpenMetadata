# RDF catalog scale validation

`scripts/rdf-catalog-scale.sh` exercises the full OpenMetadata application, PostgreSQL, and the
shipped Apache Jena Fuseki image. It measures the acceptance criteria in
[#32057](https://github.com/open-metadata/OpenMetadata/issues/32057).

## Reproduce

Run from a configured Java 21 development checkout with Docker available:

```bash
scripts/rdf-catalog-scale.sh
```

Set `JAVA_HOME` to a Java 21 runtime matching the host architecture. Both Maven and the launcher
use it; `JAVA_BIN` overrides the launch executable when needed.

The script builds the Maven dependencies and Fuseki image, starts isolated containers, and writes
the application log, report, resource samples, and individual query timings under
`.context/rdf-catalog-scale/`. It removes its containers when the test finishes. Existing local
services are separate. The test requires the dedicated launcher and is disabled in ordinary
integration-test runs. The script enables it explicitly with `rdfCatalogScale=true`.

For a smaller verification run:

```bash
RDF_SCALE_TABLES=2000 RDF_SCALE_EDGES=20000 RDF_SCALE_QUERY_SAMPLES=10 \
  RDF_SCALE_OUTPUT=.context/rdf-scale-pilot scripts/rdf-catalog-scale.sh
```

After building, `BUILD=false BUILD_IMAGE=false` reuses the compiled artifacts, classpath file, and
image. Rebuild after source changes. `RDF_SCALE_FUSEKI_IMAGE` selects an existing image built from
`docker/rdf-store`; it must include the OpenMetadata write extension and text dataset assemblers.
The restart test reserves host port 43030; set `RDF_SCALE_FUSEKI_PORT` if it is already in use.

## Workload and measurements

The default fixture contains 200,000 tables and 2,000,000 distinct, acyclic lineage edges. Normal
tables have seven columns; every hundredth table has 500. Every hundredth lineage edge has SQL,
provenance metadata, and column lineage. Every thousandth table also has custom properties.
Parents and custom-property definitions are created through the API. Tables, relationships, and
extension values are streamed into the initialized PostgreSQL database with `COPY`, then sampled
through the table API. This separates source seeding
time from RDF rebuild time and avoids including Elasticsearch construction in the measurement.

The current ontology writes **three direction/provenance triples per edge**: `om:upstream`,
`om:downstream`, and `prov:wasDerivedFrom`. Two million edges therefore contribute six million
triples before their detail resources. The harness asserts all three counts independently, the
detail count, and the table count. It also records the complete knowledge-graph triple count.

The scenario executes these steps:

1. Rebuild all entity types through the local RDF indexing application with blue/green promotion.
2. Measure entity lookup, one-hop lineage, three-hop lineage, and Lucene text-search latency through
   the authenticated OpenMetadata SPARQL API.
3. Start a distributed rebuild, wait for at least 100 successfully processed records, and cancel it
   through the application API. Assert `stopped`, an unchanged serving pointer, and unchanged graph
   counts. Wait for the cancelled workers to finish releasing their rebuild lease before retrying.
4. Run a complete distributed recovery rebuild while querying the serving dataset every five
   seconds. Verify promotion, zero failed records, exact counts, and successful query responses.
5. Restart Fuseki and verify the serving pointer, counts, and all four query types again.

Each completed query phase contains 100 samples per type by default. Concurrent sampling runs
until the rebuild ends, bounded at 2,000 samples per type. Queries return at most 100 rows, and
text search returns at most 20. These are bounded interactive queries; the three-hop query does
not compute unrestricted transitive closure. Integrity counts run before the query phases and
warm the store, including after restart. Latencies are end-to-end API measurements, with no
claimed cold-cache result.

Resources are sampled approximately every two seconds, plus collection overhead. The JSONL file
records application heap and RSS, Fuseki RSS and cgroup memory, PostgreSQL cgroup memory, allocated
disk under both data directories, remaining host disk and memory, swap usage, and host load average.
Cgroup memory includes page cache.
Reported peaks are sampled peaks, not instantaneous high-water marks. Sampling covers target
clearing/compaction, rebuilds, cancellation, and coexistence of serving and target datasets.
Observed rebuild time includes waiting for compaction and worker shutdown. The report
also records when the application first reported a terminal status. TDB2 copies index pages even
during append-only transactions, so full rebuilds compact after loading as well as after clearing
the previous generation. Blue/green runs compact the target before promotion while the previous
dataset continues serving live writes.
The sampler fails the run if host free disk falls below 12 GiB.

## Correctness checks added during validation

The pilot exposed differences between live projection and batch rebuilding. The tested revision
uses stable custom-property definition IDs and removes owned definition triples during replacement
and deletion. Batch reads now include role members, team children and inherited roles, and type
custom-property definitions. Existing stores require a full rebuild to remove already orphaned
definition nodes.

`RdfCustomPropertyProjectionTest` exercises real Jena updates, repeated projection, legacy linked
nodes, and isolation between types. `RdfBatchFieldsIT` and the custom-property case in
`TypeResourceIT` compare database-backed batch reads with entity API responses. The catalog
scenario additionally requires identical table, lineage, extension, and total-triple counts after
local rebuilding, distributed recovery, and Fuseki restart.

## Runtime configuration and scope

Defaults are an 8 GiB OpenMetadata heap; a 4 GiB Fuseki heap inside a 16 GiB, six-CPU container;
and an 8 GiB, two-CPU PostgreSQL 15 container. Both databases use disk-backed container storage,
not tmpfs. PostgreSQL durability is enabled (`fsync`, `synchronous_commit`, `full_page_writes`).
The integration bootstrap retains its other PostgreSQL settings, including 128 MiB shared
buffers, 32 MiB work memory, minimal WAL, and a 30-second checkpoint timeout.

Indexing uses batch size 1,000, two producer threads, three consumer threads, queue size 5,000, and
10,000-record distributed partitions. All entity types are requested, including the system
entities created at startup. Scheduled RDF indexing and inference jobs are paused during the
scenario so their independent writes do not alter the workload. On-demand rebuilds remain enabled.
The report records image identity, source revision, settings, job statistics, timestamps, and
resource limits.

`RDF_SCALE_BATCH_SIZE` overrides the indexing batch size. `RDF_SCALE_LINEAGE_EDGE_BATCH_SIZE`
sets the server's existing `bulkLineageEdgeBatchSize` configuration, also to 1,000 by default for
this workload. Lineage transactions have their own limit; increasing the application batch size
alone leaves the server's default 50-edge chunks unchanged. `RDF_SCALE_APPEND_PAYLOAD_BYTES`
and `RDF_SCALE_APPEND_ENTITY_BATCH_SIZE` override the server's existing append limits (defaults:
16 MiB and 1,000 entities). The report records these effective settings even if a run fails before
promotion. The shipped Fuseki extension additionally enforces a 64 MiB upload cap and a write
deadline. Larger batches reduce TDB2 transaction churn; the storage layer still splits appends
at its entity-count and payload limits. The first
200,000-table attempt used batches of 100 and was stopped for persistent index growth before
exhausting the host disk. That attempt is not a completed scale result. See
[Jena's storage FAQ](https://jena.apache.org/documentation/tdb/faqs.html) for the copy-on-write
storage model and the extra disk space required during compaction.

This is a synthetic table-heavy catalog on one application process, one metadata database, and
one Fuseki instance. Distributed mode exercises the partition coordinator and workers within that
application process; it does not establish multi-node scaling. Restart persistence and rebuild
isolation do not provide Fuseki high availability. Live ingestion throughput, long-running
inference, mixed-asset production distributions, and a controlled comparison against `main`
require separate measurements. Run the same harness on the intended storage and network before
using these results as a production capacity guarantee.
