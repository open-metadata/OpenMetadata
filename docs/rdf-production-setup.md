# Setting up Apache Jena Fuseki efficiently

OpenMetadata stores its RDF knowledge graph in a remote Apache Jena Fuseki dataset backed by TDB2.
Production sizing must account for two different memory consumers: the Fuseki JVM heap and the
operating-system page cache used by TDB2's memory-mapped indexes. Giving the JVM all container
memory starves the page cache and usually reduces throughput.

## The shipped Fuseki image

`docker/rdf-store/` builds the supported image (`openmetadata-fuseki:6.2.0`):

- **Fuseki 6.2.0 on `eclipse-temurin:21-jre-jammy`.** Jena 6.x requires Java 21. The download is
  verified against a pinned SHA-512 checksum at build time.
- **Runs as non-root user `fuseki` (uid/gid 1000).** On Kubernetes set `fsGroup: 1000` (the shipped
  manifest does) so the persistent volume is writable.
- **Launched with `--config=/fuseki/config.ttl`, not `--loc`.** The assembler file is what enables a
  server-side update timeout: `arq:updateTimeout` (set to 120 s, deliberately above the client's
  60 s request timeout) makes Fuseki itself abort a runaway UPDATE. This setting is
  config-file-only — `--timeout` on the command line applies to queries, never updates — which is
  the reason the launch moved to `--config`. Note the dataset location: `config.ttl` uses
  `/fuseki-data/openmetadata`, whereas the old `--loc=/fuseki-data` launch wrote TDB2 files directly
  into `/fuseki-data`. Upgrading from that layout requires moving the files (below) — the locations
  are deliberately not the same.
- **`FUSEKI_BASE` lives on the data volume** (`/fuseki-data/fuseki-base`). Datasets created through
  the admin API — including the `_a`/`_b` datasets used by blue/green rebuilds — are registered
  under `FUSEKI_BASE`; with the old in-image default they silently vanished on container
  replacement.
- **Explicit equal heap** (`-Xms4g -Xmx4g` in the image; the development compose files override to
  1500 MB) plus GC logging to `/fuseki-data/gc.log`.

### Upgrading an existing deployment (`--loc` → `--config`)

A wrong `tdb2:location` does not fail — it silently starts an **empty** store. Verify data
survival with a triple count before and after the upgrade:

```bash
curl -s -u admin:<password> --data-urlencode \
  'query=SELECT (COUNT(*) AS ?n) WHERE { GRAPH ?g { ?s ?p ?o } }' \
  -H 'Accept: application/sparql-results+json' \
  http://localhost:3030/openmetadata/sparql
```

Run it on the old image, then move the existing store into the location the assembler expects
before starting the new one:

```bash
# With the container stopped, on the host path backing /fuseki-data:
mkdir -p /fuseki-data/openmetadata
mv /fuseki-data/Data-0001 /fuseki-data/openmetadata/    # plus any other TDB2 files/dirs
```

Then start the new image and run the count again; the two must match. If they do not, stop and
restore rather than letting a rebuild repopulate — an empty store that looks healthy is the failure
mode this check exists to catch.
Blue/green `_a`/`_b` datasets created under the old in-image `FUSEKI_BASE` are lost by the upgrade;
this is expected — the next rebuild recreates them on the volume.

## Capacity planning

TDB2 storage varies with URI and literal width. A useful planning range for OpenMetadata graphs is
150-250 bytes per triple before compaction headroom.

| Live triples | Approximate live TDB2 data | Fuseki heap | Suggested total RAM | Suggested persistent disk |
| ---: | ---: | ---: | ---: | ---: |
| 1 million | 0.15-0.25 GB | 2 GB | 4-8 GB | 4 GB minimum |
| 10 million | 1.5-2.5 GB | 4 GB | 8-16 GB | 16 GB minimum |
| 50 million | 7.5-12.5 GB | 8 GB | 24-48 GB | 80 GB minimum |

Size the persistent volume as **at least `2 datasets × live size × 2.5`** when blue/green rebuilds
are enabled: two full datasets alternate on disk, and TDB2 compaction builds a replacement dataset
next to the old one before deleting it. Without blue/green, `live × 2.5` covers compaction and
journal headroom. The 10 GiB PVC in `docker/rdf-store/kubernetes/fuseki-deployment.yaml` is a
development default, not a production recommendation. Use SSD-class storage — TDB2's write
transactions are journal-bound, and network HDD storage classes dominate write latency.

Keep the Fuseki heap smaller than the container memory limit. Memory beyond `-Xmx` is useful: TDB2
memory-maps its indexes and relies heavily on the OS page cache. The OpenMetadata server does not
need additional heap for normal RDF queries because built-in lineage and semantic expansion execute
as property-path queries inside Fuseki.

**Co-locate Fuseki with the OpenMetadata server (same zone, ideally same node/network).** Fuseki
acquires the TDB2 writer lock **before reading the request body**, so network transfer time and
parse time sit inside the lock. On a slow link every byte of a bulk write extends the
single-writer critical section; latency between the indexer and Fuseki is a direct multiplier on
rebuild time.

## Write throughput

TDB2 is a single-writer store, and the indexing pipeline is built around that fact: partition
workers read and translate entities in parallel, but all writes for a dataset funnel through a
single sink writer with **exactly one in-flight request**. Adding client threads does not add
write throughput by design — reader parallelism keeps the writer fed, and the writer keeps exactly
one transaction open on Fuseki at a time, so client timeouts measure actual server work instead of
queue position.

Throughput therefore depends on the number and size of write transactions:

- A `recreateIndex: true` run clears the graph (or builds into an idle blue/green dataset) and then
  uses **insert-only appends**: no reconciliation, no DELETE statements. Appends are streamed to
  the Graph Store Protocol endpoint as RDF Thrift (`RDF_STREAMING_APPEND_ENABLED`, default on), so
  indexer memory stays flat regardless of chunk size and Fuseki parses a binary stream rather than
  SPARQL text.
- Incremental runs reconcile existing values with SPARQL UPDATE and are budgeted much more
  conservatively (`RDF_MAX_UPDATE_PAYLOAD_BYTES`).
- On network-constrained links, `RDF_GZIP_REQUESTS=true` compresses streamed append bodies.
  Because the body is read inside the writer lock, compression directly shortens lock hold time.
  Only gzip is supported — **never configure deflate anywhere in the path**: Fuseki maps `deflate`
  to a compressing (not decompressing) stream and corrupts the request.

Start with the defaults and tune one setting at a time:

| Environment variable | Default | Purpose |
| --- | ---: | --- |
| `RDF_BULK_ENTITY_BATCH_SIZE` | `100` | Entity models per SPARQL update. |
| `RDF_BULK_RELATIONSHIP_SOURCE_BATCH_SIZE` | `100` | Source entities reconciled per relationship update. |
| `RDF_BULK_LINEAGE_EDGE_BATCH_SIZE` | `50` | Detailed lineage edges per update. |
| `RDF_MAX_UPDATE_PAYLOAD_BYTES` | `4194304` | Approximate serialized-size cap per reconciling bulk write; oversized chunks split automatically. |
| `RDF_MAX_APPEND_PAYLOAD_BYTES` | `16777216` | Serialized-size cap per insert-only append. |
| `RDF_BULK_APPEND_ENTITY_BATCH_SIZE` | `1000` | Entity models per insert-only append. |
| `RDF_STREAMING_APPEND_ENABLED` | `true` | Stream appends as RDF Thrift instead of materializing a combined model. |
| `RDF_GZIP_REQUESTS` | `false` | Gzip streamed append bodies (never deflate). |
| `RDF_REQUEST_TIMEOUT_MS` | `60000` | Maximum time for one RDF request. |

Insert-only appends are budgeted separately and far more generously than reconciling updates
because the limiting factor is transaction count rather than request size. Collapsing a rebuild
from thousands of transactions into dozens is the single largest throughput lever available without
changing the deployment.

Larger batches reduce transaction and journal overhead but increase request size, parse time, and
retry cost. If a larger batch approaches `RDF_REQUEST_TIMEOUT_MS`, either reduce the batch or raise
the timeout. Wide tables can produce tens of megabytes of triples per 100-entity batch, so validate
changes against representative catalogs.

### Reading the run record's stage timings

`readerTimeMs`, `processTimeMs` and `sinkTimeMs` on a run record are **aggregate work summed across
concurrent workers**, not elapsed time. Reading runs on one worker per partition and translation on
a pool of up to 50 threads, so those two stages overlap both each other and the writer. The
consequence is deliberate but easy to misread: **the stage times can add up to more than the run
actually took.** In the two-partition measurement below, the stages summed to 19.8 s for a run whose
wall clock was 12.0 s — that gap is the parallelism working, not an error.

Read them as "where did this run spend its effort", and take elapsed time from the run record's
`startTime`/`endTime`. The one stage that does approximate wall clock is `sinkTimeMs`: RDF writes are
serialized to a single in-flight request, so there is nothing for it to overlap with.

### Partition size decides read concurrency

Measured end to end (`RdfIndexAppScaleIT`, 2,000 tables, Fuseki 6.2.0), the **read stage is about
three quarters of a run** — 11.6 s of a 15.5 s job, against 3.1 s of RDF writes and 0.6 s of
translation. Reading is not wasteful: the RDF mapper needs an entity's full field set, because a
search-index-style subset silently drops triples. It is simply the largest stage.

A partition is the unit of read concurrency — one worker reads one partition at a time — so the
number of partitions caps how much of that stage runs in parallel:

| `partitionSize` | Effective size | Partitions | App wall clock |
| ---: | ---: | ---: | ---: |
| `10000` (default) | 6,666 after the entity complexity factor | 1 | 15.5 s |
| `1000` (the floor) | 1,000 | 2 | **12.0 s** |

Going from one reader to two cut wall clock 23%, and the summed stage time (19.8 s) exceeding wall
clock (12.0 s) is the proof that partitions really did run concurrently.

The practical consequence: **with the default, any entity type holding fewer than ~6,700 rows gets a
single partition and reindexes single-threaded**, however many servers or cores are available. If a
catalog is small or mid-sized and a rebuild looks slower than these numbers suggest, lower
`partitionSize` (1,000 is the floor) so the type spans several partitions. Large catalogs already
produce plenty of partitions and need no change — and more partitions are not free, since each
carries claim and heartbeat traffic.

### What not to tune

- **Do not raise `consumerThreads` or `producerThreads` to fix slow indexing.** Writes are
  single-file by design; extra workers only speed up the read/translate side, which is rarely the
  bottleneck.
- **Do not raise `RDF_WRITE_MAX_RETRIES` when requests are timing out.** The client-side deadline
  does not cancel the server-side update — Fuseki keeps parsing and committing the abandoned
  request, so each same-size retry multiplies server load. (The server-side `arq:updateTimeout` in
  the shipped `config.ttl` bounds this damage, but retry storms still waste the writer.)
- **Fuseki sizing is the primary unlock for wide-table catalogs.** Before touching batch or retry
  settings, give Fuseki production resources: at least 2 CPU cores (request = limit in the shipped
  manifest), heap per the capacity table above, container memory headroom beyond `-Xmx` for TDB2's
  page cache, and SSD storage. If a trivial `ASK { ?s ?p ?o }` is slow, Fuseki is
  resource-starved and no client-side tuning will help.
- When timeouts persist on healthy hardware, prefer *smaller* batches over longer timeouts: a
  smaller batch bounds the blast radius of a failure and keeps the single writer's transactions
  short.

## Scheduling

The recommended RDF schedule is a weekly recreate on Saturday at midnight; search indexing defaults
to Sunday at 00:30:

```text
RDF:    0 0 * * 6
Search: 30 0 * * 0
```

Both jobs scan the metadata database and hydrate entity relationships, so running them together
thrashes the database. Two mechanisms keep them apart:

- **Missed-run suppression.** RDF and search reindex triggers use the Quartz `DoNothing` misfire
  policy: a pod that restarts after a missed weekend fire does **not** launch a surprise full
  reindex at deploy time — the job simply waits for its next scheduled slot. (Light daily apps keep
  the default catch-up behavior.)
- **Cross-app admission guard.** A cron-triggered RDF reindex checks for an active search reindex
  (reindex lock, active `search_index_job` rows with a fresh heartbeat, or a live search app run)
  and defers, re-checking every 60 s for up to 30 minutes. If the search run still hasn't finished,
  the RDF run ends `STOPPED` with an explanatory message and waits for its next scheduled slot.
  **On-demand runs bypass the guard** (operator intent wins) with a warning in the logs.

Upgrades migrate an RDF app that still has the former exact daily default (`0 0 * * *`) to the
weekly schedule. Custom schedules and applications with scheduling disabled are not changed.

## Blue/green rebuilds

By default a `recreateIndex` run clears the served dataset before it starts repopulating it, so
every query returns partial results until the run finishes — on a large catalog that window is
measured in hours. Enabling **Blue/Green Rebuild** in the RDF Indexing application's configuration
(alongside *Recreate RDF Store*) changes the shape of a rebuild:
the run builds into an idle second dataset and switches to it only after the build succeeds, so the
previous graph keeps serving throughout and remains available for rollback until the next rebuild
reuses it.

Two datasets alternate — for a configured dataset named `openmetadata`, the builds land in
`openmetadata_a` and `openmetadata_b` — which bounds disk at two copies rather than leaking a new
dataset per run. Size the volume per the capacity-planning formula above.

It is a per-run application setting rather than server configuration because it changes the shape of
one rebuild, not the capability of the deployment: an administrator can enable it, watch one weekend
run, and turn it back off without a redeploy. Servers always follow the dataset pointer, so every
pod converges on a promoted dataset without restarting. If the volume cannot hold two datasets the
build fails before promotion and the previous dataset keeps serving — the same failure mode
blue/green exists to provide.

Promotion is gated twice:

- a sanity check refuses to activate a dataset that reports zero triples after indexing records;
- a **success-ratio gate** (`minSuccessRatio` in the RDF app configuration, default `0.95`) refuses
  to activate when the rebuild lost more than the configured fraction of records. In both cases the
  previous dataset keeps serving and the run fails visibly.

Deleting a dataset through the Fuseki admin API removes its registration but **not** its TDB2 files;
the alternation reuses and clears the same two directories, so disk stays bounded. To reclaim the
idle dataset's disk entirely, stop Fuseki and remove the unused
`{FUSEKI_BASE}/databases/<dataset>_a|_b` directory of the dataset that is not the active pointer.

## Compaction and disk growth

OpenMetadata requests Fuseki compaction after clearing a recreate run and after every successful
incremental indexing run. Recreate runs skip the post-run compaction: the store was compacted while
empty right after the clear, and insert-only writes leave nothing to reclaim, while compaction
would block writers for up to ten minutes. Compaction is best-effort: an indexing run can succeed
even if disk reclamation fails.

To compact manually:

```bash
curl -u admin:<password> -X POST \
  'http://localhost:3030/$/compact/openmetadata?deleteOld=true'
```

Fuseki returns an asynchronous task identifier. Inspect active and completed tasks at `/$/tasks`
and confirm the data volume has enough space for both the old and replacement datasets. Unexpected
journal growth usually indicates failed or skipped compaction, a write-heavy incremental workload,
or a volume that filled before compaction completed.

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
| `RDF_STREAMING_APPEND_ENABLED` | `true` |
| `RDF_GZIP_REQUESTS` | `false` |
| `RDF_REMOTE_USERNAME` | `admin` |
| `RDF_REMOTE_PASSWORD` | `admin` |
| `RDF_DATASET` | `openmetadata` |
| `RDF_INFERENCE_ENABLED` | `false` |
| `RDF_MATERIALIZED_INFERENCE_ENABLED` | `false` |
| `RDF_MAX_IN_MEMORY_INFERENCE_TRIPLES` | `100000` |
| `RDF_DEFAULT_INFERENCE_LEVEL` | `NONE` |
| `RDF_MAX_IN_MEMORY_INFERENCE_TRIPLES` | `100000` |
| `RDF_MATERIALIZED_INFERENCE_ENABLED` | `false` |
| `RDF_SHACL_VALIDATION_MODE` | `REPORT` |
| `RDF_DEREFERENCEABLE_IRIS` | `false` |
| `RDF_STRICT_OWL_PROFILE` | `true` |
| `RDF_ASK_COLLATE_ENABLED` | `false` |
| `RDF_FEDERATION_ENABLED` | `false` |

Use `RDF_ENDPOINT` for new deployments. `RDF_REMOTE_ENDPOINT` remains a deprecated fallback for
backward compatibility, and `RDF_ENDPOINT` takes precedence when both are set. Override the
development credentials in every production deployment.

## Monitoring and failure diagnosis

Useful Fuseki administration endpoints are:

- `/$/ping` for liveness and readiness.
- `/$/stats` for dataset and operation statistics.
- `/$/metrics` for **Prometheus-format metrics** — scrape this in production; it exposes request
  counts and latency per endpoint alongside JVM memory and GC figures. The shipped `shiro.ini`
  marks it anonymous (like `/$/ping` and `/$/stats`) so scraping works without credentials; delete
  the `/$/metrics = anon` line in `docker/rdf-store/shiro.ini.template` to require admin auth.
- `/$/tasks` for compaction and other asynchronous administration work.

On the OpenMetadata side:

- Micrometer publishes `rdf.fuseki.request` (latency, tagged by operation and outcome),
  `rdf.fuseki.timeouts`, `rdf.fuseki.payload.bytes`, and `rdf.index.job` (whole-run duration
  tagged by outcome). Requests slower than 10 s log a warning with operation and payload size.
- Per-record indexing failures persist in the `rdf_index_failures` table, are wiped at the start of
  each run, and are queryable at `GET /v1/rdf/reindex/failures` (also surfaced by the RDF app's
  "View Reindex Failures" button in the UI).

Monitor indexing records per second, SPARQL update latency, container RSS, page-cache availability,
persistent-volume usage, and journal growth. OpenMetadata logs `RDF circuit breaker is open` after
repeated connection failures or request timeouts; check Fuseki health, request latency,
credentials, and network reachability before increasing retries.

## Inference

Materialized inference is the production path. Set `RDF_MATERIALIZED_INFERENCE_ENABLED=true`, keep the asserted RDF rebuild current, and schedule `RdfInferenceApp`. Rules write to durable per-rule named graphs in Fuseki and expose dirty state, last materialization time, triple count, and error details through the inference status APIs.

Legacy in-process inference is bounded by `RDF_MAX_IN_MEMORY_INFERENCE_TRIPLES` and refuses to copy a larger store into the OpenMetadata JVM. Keep the default bound unless a measured small deployment has enough heap. Use SPARQL 1.1 property paths for request-specific traversal; they execute inside Fuseki without copying the graph.
The complete-lineage endpoint intentionally does not impose a row limit on its property-path query.
Size `RDF_REQUEST_TIMEOUT_MS`, Fuseki resources, and client response handling for the largest
lineage graph operators can request. Semantic search is not an exhaustive traversal: each seed
expands at most 100 related graph candidates before reranking to the caller's requested result
limit. Use the complete-lineage endpoint or direct SPARQL for exhaustive graph traversal.

## Measured write throughput

Numbers from `scripts/rdf-reindex-benchmark.sh`'s write-path harness against Fuseki 6.2.0 in
Docker (2 CPUs, `-Xms4g -Xmx4g`, persistent volume) co-located with the client. Synthetic catalog:
every 100th table 500 columns, the rest 7, so wide tables are represented.

| Scale | Transport | Wall clock | Entities/s | Triples/s |
| ---: | --- | ---: | ---: | ---: |
| 20k entities (1.79M triples) | streaming (default) | 21.8 s | 918 | 82,000 |
| 20k entities | `connection.load` fallback | 25.6 s | 782 | 70,000 |
| 20k entities | streaming + gzip | 20.8 s | 963 | 86,000 |
| 100k entities (8.96M triples) | streaming (default) | 158 s | 632 | 57,000 |

Three things this measures that matter for planning:

- **Streaming is ~17% faster than the fallback** and holds indexer memory flat, which is why it is
  the default. Gzip measured ~5% on loopback — inside noise there, and expected to matter only when
  the network, not the writer lock, is the constraint.
- **Throughput decays as the store grows.** Instantaneous rate fell from ~1,050 entities/s at 20k to
  ~400/s by 90k as TDB2's indexes deepen. Size a rebuild against the *end* of that curve, not the
  start; the 100k average above already includes the decay.
- **The client is not the bottleneck.** Translation was 5–16% of wall clock and Fuseki writes
  84–95%, and Fuseki showed no heap pressure (Old Gen 150 MB of a 4 GB heap, 1.9 s of GC across the
  100k run). That is the single-writer store being the limit, exactly as the pipeline assumes — so
  spend on Fuseki CPU and disk before touching client-side knobs.

Note on disk: TDB2 stores named-graph data as **quads across six indexes** plus a node table, and
`CLEAR ALL` does not reclaim anything until a compaction runs. An uncompacted store carrying the
churn of several rebuilds was an order of magnitude larger than its live triple count suggests.
Treat the bytes-per-triple figure in the capacity table as a rough starting point and measure your
own catalog before sizing a volume.

## Verifying and benchmarking a deployment

Two scripts turn the guidance above into checks against a real stack:

```bash
# Smoke-test the RDF services; non-zero exit if any check fails.
./docker/docker-compose-quickstart/test-rdf-services.sh

# Add the runaway-UPDATE check: submits a deliberately expensive UPDATE and asserts
# the server aborts it near arq:updateTimeout. Takes ~2 minutes, and is the direct
# proof that the --config launch (not --loc) is in effect.
./docker/docker-compose-quickstart/test-rdf-services.sh --with-timeout-test
```

```bash
# Measure a full rebuild: wall-clock, records/second, failures, resulting triple
# count, and the number of Fuseki requests the run cost.
OM_TOKEN=<admin-or-bot-jwt> ./scripts/rdf-reindex-benchmark.sh

# Seed a catalog first. Wide tables dominate reindex payload size, so the seeder
# mixes them in rather than generating uniformly narrow ones.
OM_TOKEN=<jwt> SEED_TABLES=100000 SEED_WIDE_EVERY=100 SEED_WIDE_COLUMNS=500 \
  ./scripts/rdf-reindex-benchmark.sh
```

Measure before tuning: the defaults in this document are sized for a co-located
Fuseki on SSD, and the benchmark is how you find out where your deployment actually
sits relative to the envelope above.

For local startup and API examples, see [RDF/Apache Jena Local Development Guide](rdf-local-development.md).
