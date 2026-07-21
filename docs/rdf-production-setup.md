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
| `RDF_REQUEST_TIMEOUT_MS` | `60000` | Maximum time for one RDF request. |

Larger batches reduce transaction and journal overhead but increase request size, parse time, and retry cost. If a larger batch approaches `RDF_REQUEST_TIMEOUT_MS`, either reduce the batch or raise the timeout. Wide tables can produce tens of megabytes of N-Triples per 100-entity batch, so validate changes against representative catalogs.

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

## Compaction and disk growth

OpenMetadata requests Fuseki compaction after clearing a recreate run and after every successful indexing run. Compaction is best-effort: an indexing run can succeed even if disk reclamation fails.

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
| `RDF_REMOTE_USERNAME` | `admin` |
| `RDF_REMOTE_PASSWORD` | `admin` |
| `RDF_DATASET` | `openmetadata` |
| `RDF_INFERENCE_ENABLED` | `false` |
| `RDF_DEFAULT_INFERENCE_LEVEL` | `NONE` |
| `RDF_MAX_IN_MEMORY_INFERENCE_TRIPLES` | `100000` |
| `RDF_MATERIALIZED_INFERENCE_ENABLED` | `false` |
| `RDF_SHACL_VALIDATION_MODE` | `REPORT` |
| `RDF_DEREFERENCEABLE_IRIS` | `false` |
| `RDF_STRICT_OWL_PROFILE` | `true` |
| `RDF_ASK_COLLATE_ENABLED` | `false` |
| `RDF_FEDERATION_ENABLED` | `false` |

Use `RDF_ENDPOINT` for new deployments. `RDF_REMOTE_ENDPOINT` remains a deprecated fallback for backward compatibility, and `RDF_ENDPOINT` takes precedence when both are set. Override the development credentials in every production deployment.

## Monitoring and failure diagnosis

Useful Fuseki administration endpoints are:

- `/$/ping` for liveness and readiness.
- `/$/stats` for dataset and operation statistics.
- `/$/tasks` for compaction and other asynchronous administration work.

Monitor indexing records per second, SPARQL update latency, container RSS, page-cache availability, persistent-volume usage, and journal growth. OpenMetadata logs `RDF circuit breaker is open` after repeated connection failures or request timeouts; check Fuseki health, request latency, credentials, and network reachability before increasing retries.

## Inference

Materialized inference is the production path. Set `RDF_MATERIALIZED_INFERENCE_ENABLED=true`, keep the asserted RDF rebuild current, and schedule `RdfInferenceApp`. Rules write to durable per-rule named graphs in Fuseki and expose dirty state, last materialization time, triple count, and error details through the inference status APIs.

Legacy in-process inference is bounded by `RDF_MAX_IN_MEMORY_INFERENCE_TRIPLES` and refuses to copy a larger store into the OpenMetadata JVM. Keep the default bound unless a measured small deployment has enough heap. Use SPARQL 1.1 property paths for request-specific traversal; they execute inside Fuseki without copying the graph.

The complete-lineage endpoint intentionally does not impose a row limit on its property-path query. Size `RDF_REQUEST_TIMEOUT_MS`, Fuseki resources, and client response handling for the largest lineage graph operators can request. Semantic search is not an exhaustive traversal: each seed expands at most 100 related graph candidates before reranking to the caller's requested result limit. Use the complete-lineage endpoint or direct SPARQL for exhaustive graph traversal.

For local startup and API examples, see [RDF/Apache Jena Local Development Guide](rdf-local-development.md).

Ontology Studio configuration, security, and release checks are documented in [Ontology Studio 2.0](ontology-studio-2.0.md).
