# Setting up Apache Jena Fuseki efficiently

OpenMetadata stores its RDF knowledge graph in a remote Apache Jena Fuseki dataset. Production sizing must account for two different memory consumers: the Fuseki JVM heap and the operating-system page cache used by TDB2's memory-mapped indexes. Giving the JVM all container memory starves the page cache and usually reduces throughput.

## Capacity planning

TDB2 storage varies with URI and literal width. A useful planning range for OpenMetadata graphs is 150-250 bytes per triple before compaction headroom.

| Live triples | Approximate live TDB2 data | Fuseki heap | Suggested total RAM | Suggested persistent disk |
| ---: | ---: | ---: | ---: | ---: |
| 1 million | 0.15-0.25 GB | 2 GB | 4-8 GB | 2 GB minimum |
| 10 million | 1.5-2.5 GB | 4 GB | 8-16 GB | 8 GB minimum |
| 50 million | 7.5-12.5 GB | 8 GB | 24-48 GB | 40 GB minimum |

Persistent storage should be at least 2-3 times the expected live dataset, plus room for the journal. TDB2 compaction builds a replacement dataset before deleting the old one, so a volume sized only for live data can run out of space during compaction. The 10 GiB PVC in `docker/rdf-store/kubernetes/fuseki-deployment.yaml` is a development default, not a production recommendation.

Keep the Fuseki heap smaller than the container memory limit. Memory beyond `-Xmx` is useful: TDB2 memory-maps its indexes and relies heavily on the OS page cache. The OpenMetadata server does not need additional heap for normal RDF queries because built-in lineage and semantic expansion execute as property-path queries inside Fuseki.

## Write throughput

TDB2 is a single-writer store. More OpenMetadata indexing threads can prepare and read batches concurrently, but Fuseki ultimately serializes write transactions. Throughput therefore depends primarily on the number and size of SPARQL UPDATE transactions, not the number of HTTP clients.

An RDF indexing run with `recreateIndex: true` clears the graph first and then uses insert-only writes. It does not perform per-entity or per-relationship reconciliation against the empty graph. Entity, relationship, and lineage data are grouped into bounded updates. Incremental runs continue to reconcile existing values.

RDF indexing hydrates every field supported by each entity repository because the RDF mapper preserves fields even when they have no explicit JSON-LD context mapping. It omits only `changeDescription`, `votes`, and the embedded `testCaseResult`, which the mapper intentionally does not emit as triples.

Start with the defaults and tune one setting at a time:

| Environment variable | Default | Purpose |
| --- | ---: | --- |
| `RDF_BULK_ENTITY_BATCH_SIZE` | `100` | Entity models per SPARQL update. |
| `RDF_BULK_RELATIONSHIP_SOURCE_BATCH_SIZE` | `100` | Source entities reconciled per relationship update. |
| `RDF_BULK_LINEAGE_EDGE_BATCH_SIZE` | `50` | Detailed lineage edges per update. |
| `RDF_MAX_UPDATE_PAYLOAD_BYTES` | `4194304` | Approximate serialized-size cap per reconciling bulk write; oversized chunks split automatically. |
| `RDF_MAX_APPEND_PAYLOAD_BYTES` | `16777216` | Serialized-size cap per insert-only append. |
| `RDF_BULK_APPEND_ENTITY_BATCH_SIZE` | `1000` | Entity models per insert-only append. |
| `RDF_REQUEST_TIMEOUT_MS` | `60000` | Maximum time for one RDF request. |

Insert-only writes — the mode a `recreateIndex` run uses after the graph is cleared — are budgeted
separately and far more generously than reconciling updates. They carry no DELETE statements and
Fuseki parses them with the streaming RDF parser instead of the SPARQL grammar, so the limiting
factor is transaction count rather than request size. Because TDB2 serializes writers, collapsing a
rebuild from thousands of transactions into dozens is the single largest throughput lever available
without changing the deployment. Raising `RDF_MAX_APPEND_PAYLOAD_BYTES` also raises peak heap in the
OpenMetadata server: one chunk is materialized as an in-memory RDF model per worker before it is
sent, so budget roughly a few times the byte cap per concurrent worker.

Larger batches reduce transaction and journal overhead but increase request size, parse time, and retry cost. If a larger batch approaches `RDF_REQUEST_TIMEOUT_MS`, either reduce the batch or raise the timeout. Wide tables can produce tens of megabytes of N-Triples per 100-entity batch, so validate changes against representative catalogs.

### What not to tune

- **Do not raise `consumerThreads` or `producerThreads` to fix slow indexing.** TDB2 serializes
  write transactions; extra workers only queue on Fuseki's writer lock and multiply concurrent
  abandoned requests when timeouts occur.
- **Do not raise `RDF_WRITE_MAX_RETRIES` when requests are timing out.** The client-side deadline
  does not cancel the server-side update — Fuseki keeps parsing and committing the abandoned
  request, so each same-size retry multiplies server load. A run whose batches time out degrades
  into minutes per batch (timeout × retries, then per-entity fallback, then circuit-breaker
  cooldowns) and reports large failed-record counts concentrated in wide entity types.
- **Fuseki sizing is the primary unlock for wide-table catalogs.** Before touching batch or retry
  settings, give Fuseki production resources: at least 2 CPU cores (the Kubernetes manifest's
  `500m` CPU request is a development default), heap per the capacity table above, and container
  memory headroom beyond `-Xmx` for TDB2's page cache. If a trivial `ASK { ?s ?p ?o }` is slow,
  Fuseki is resource-starved and no client-side tuning will help.
- When timeouts persist on healthy hardware, prefer *smaller* batches over longer timeouts: a
  smaller batch bounds the blast radius of a failure and keeps the single writer's transactions
  short.

## Scheduling

The recommended RDF schedule is a weekly recreate on Saturday at midnight:

```text
0 0 * * 6
```

Search indexing defaults to Sunday at 00:30:

```text
30 0 * * 0
```

Keep the jobs separated manually. Both scan the metadata database and hydrate entity relationships, so running them together increases database pressure. OpenMetadata does not provide cross-application mutual exclusion between RDF and search indexing.

Upgrades migrate an RDF app that still has the former exact daily default (`0 0 * * *`) to the weekly schedule. Custom schedules and applications with scheduling disabled are not changed.

## Blue/green rebuilds

By default a `recreateIndex` run clears the served dataset before it starts repopulating it, so
every query returns partial results until the run finishes — on a large catalog that window is
measured in hours. Setting `RDF_BLUE_GREEN_REBUILD_ENABLED=true` changes the shape of a rebuild:
the run builds into an idle second dataset and switches to it only after the build succeeds and
passes a sanity check, so the previous graph keeps serving throughout and remains available for
rollback until the next rebuild reuses it.

Two datasets alternate — for a configured dataset named `openmetadata`, the builds land in
`openmetadata_a` and `openmetadata_b` — which bounds disk at two copies rather than leaking a new
dataset per run. Size the volume accordingly: blue/green needs room for two full datasets, on top
of the compaction headroom described below.

Because the build target is not serving traffic, the clear and compaction that precede it are free
from a user's perspective, and the build itself runs entirely with insert-only appends (see
`RDF_MAX_APPEND_PAYLOAD_BYTES` above).

## Compaction and disk growth

OpenMetadata requests Fuseki compaction after clearing a recreate run and after every successful incremental indexing run. Recreate runs skip the post-run compaction: the store was compacted while empty right after the clear, and insert-only writes leave nothing to reclaim, while compaction would block writers for up to ten minutes. Compaction is best-effort: an indexing run can succeed even if disk reclamation fails.

To compact manually:

```bash
curl -u admin:<password> -X POST \
  'http://localhost:3030/$/compact/openmetadata?deleteOld=true'
```

Fuseki returns an asynchronous task identifier. Inspect active and completed tasks at `/$/tasks` and confirm the data volume has enough space for both the old and replacement datasets. Unexpected journal growth usually indicates failed or skipped compaction, a write-heavy incremental workload, or a volume that filled before compaction completed.

## Configuration reference

The OpenMetadata server reads the following settings from `conf/openmetadata.yaml`:

| Environment variable | Default |
| --- | --- |
| `RDF_ENABLED` | `false` |
| `RDF_BASE_URI` | `https://open-metadata.org/` |
| `RDF_STORAGE_TYPE` | `FUSEKI` |
| `RDF_ENDPOINT` | `http://localhost:3030/openmetadata` |
| `RDF_REMOTE_ENDPOINT` | unset (deprecated fallback) |
| `RDF_CONNECT_TIMEOUT_MS` | `2000` |
| `RDF_REQUEST_TIMEOUT_MS` | `60000` |
| `RDF_WRITE_MAX_RETRIES` | `2` |
| `RDF_WRITE_RETRY_INITIAL_BACKOFF_MS` | `250` |
| `RDF_WRITE_RETRY_MAX_BACKOFF_MS` | `2000` |
| `RDF_BULK_ENTITY_BATCH_SIZE` | `100` |
| `RDF_BULK_RELATIONSHIP_SOURCE_BATCH_SIZE` | `100` |
| `RDF_BULK_LINEAGE_EDGE_BATCH_SIZE` | `50` |
| `RDF_MAX_UPDATE_PAYLOAD_BYTES` | `4194304` |
| `RDF_MAX_APPEND_PAYLOAD_BYTES` | `16777216` |
| `RDF_BULK_APPEND_ENTITY_BATCH_SIZE` | `1000` |
| `RDF_BLUE_GREEN_REBUILD_ENABLED` | `false` |
| `RDF_REMOTE_USERNAME` | `admin` |
| `RDF_REMOTE_PASSWORD` | `admin` |
| `RDF_DATASET` | `openmetadata` |
| `RDF_INFERENCE_ENABLED` | `false` |

Use `RDF_ENDPOINT` for new deployments. `RDF_REMOTE_ENDPOINT` remains a deprecated fallback for backward compatibility, and `RDF_ENDPOINT` takes precedence when both are set. Override the development credentials in every production deployment.

## Monitoring and failure diagnosis

Useful Fuseki administration endpoints are:

- `/$/ping` for liveness and readiness.
- `/$/stats` for dataset and operation statistics.
- `/$/tasks` for compaction and other asynchronous administration work.

Monitor indexing records per second, SPARQL update latency, container RSS, page-cache availability, persistent-volume usage, and journal growth. OpenMetadata logs `RDF circuit breaker is open` after repeated connection failures or request timeouts; check Fuseki health, request latency, credentials, and network reachability before increasing retries.

## Inference

In-process inference is disabled by default. Enabling `RDF_INFERENCE_ENABLED=true` causes general queries to construct the entire graph in the OpenMetadata JVM and should be limited to small graphs. The SPARQL console retains its explicit `inference` option for administrative experiments, but it has the same small-graph constraint.

Use SPARQL 1.1 property paths for transitive lineage, inverse ownership, and domain or glossary inheritance. These execute inside Fuseki without copying the graph into the OpenMetadata process. Deployments that require persistent RDFS or OWL semantics should configure a Fuseki assembler dataset with an appropriate Jena reasoner and size it independently; server-side materialization or reasoning is operationally safer than per-request full-graph inference in OpenMetadata.

The complete-lineage endpoint intentionally does not impose a row limit on its property-path query. Size `RDF_REQUEST_TIMEOUT_MS`, Fuseki resources, and client response handling for the largest lineage graph operators can request. Semantic search is not an exhaustive traversal: each seed expands at most 100 related graph candidates before reranking to the caller's requested result limit. Use the complete-lineage endpoint or direct SPARQL for exhaustive graph traversal.

For local startup and API examples, see [RDF/Apache Jena Local Development Guide](rdf-local-development.md).
