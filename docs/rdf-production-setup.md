# Setting up Apache Jena Fuseki efficiently

OpenMetadata stores its RDF knowledge graph in a remote Apache Jena Fuseki dataset backed by TDB2.
Production sizing must account for two different memory consumers: the Fuseki JVM heap and the
operating-system page cache used by TDB2's memory-mapped indexes. Giving the JVM all container
memory starves the page cache and usually reduces throughput.

The [RDF ontology contract](rdf-ontology-contract.md) documents queryable predicates and the
full rebuild required to replace legacy lineage and extension triples when upgrading to 2.0.2.
The [catalog scale harness](rdf-scale-validation.md) measures full rebuilds, serving queries,
resource peaks, cancellation, and restart persistence against a specified catalog size.

## The Fuseki image

Run the published `openmetadata/fuseki` image, pinned to an immutable `<version>-<commit>` tag
(today `6.2.0-600514c`). [rdf-fuseki-image-release.md](rdf-fuseki-image-release.md) lists the
environment OpenMetadata needs, what readiness checks, and how to verify a deployment. In short:

- **Fuseki 6.2.0 on Java 21**, downloaded and checked against its SHA-512 when the image is built,
  running as uid 1000 under `tini`. On Kubernetes set `fsGroup: 1000` so the volume is writable; a
  volume written by a root-running image needs a one-time `chown`, which the entrypoint prints.
- **Datasets from `FUSEKI_DATASETS`**: `openmetadata`, `openmetadata_a`, and `openmetadata_b`, at
  `/fuseki/databases/<name>` on the `/fuseki` volume.
- **Union default graph and deadlines, server-wide.** `FUSEKI_UNION_DEFAULT_GRAPH=true` lets the
  SPARQL playground and MCP knowledge-graph tools read the named graphs OpenMetadata writes into
  without a `GRAPH` clause; without it a plain `?s ?p ?o` returns nothing.
  `FUSEKI_QUERY_TIMEOUT_MS=50000` and `FUSEKI_UPDATE_TIMEOUT_MS=50000` fire before the 60-second
  client deadline: client-side `requestTimeoutMs` releases an OpenMetadata thread but cannot stop
  work already executing in Fuseki, so the server must release TDB2's writer lock first. Jena 6.2.0
  has a known failure on the second WHERE-bearing operation in one timed update request.
  OpenMetadata's generated mutations therefore combine batch sources with `VALUES`/`UNION`, and the
  admin SPARQL API rejects requests containing more than one WHERE-bearing operation with a clear
  validation error. Direct Fuseki clients must follow the same restriction.
- **The OpenMetadata Graph Store extension** with `OPENMETADATA_EXTENSION_ENABLED=true`.
- **Admin-only access.** Only `/$/ping` is anonymous; OpenMetadata connects as `admin`.
- **Explicit equal heap** from `FUSEKI_HEAP` (default `4g`; the development compose files use
  1500 MB).
- **No Lucene text index.** The retired in-repo image wrapped each dataset in a Jena
  `text:TextDataset`; no OpenMetadata code issues `text:query`.

### Upgrading from the in-repo image

The retired `docker/rdf-store/` image stored TDB2 at `/fuseki-data/<dataset>`. Mounting that volume
at `/fuseki` does not fail: it silently starts **empty** datasets. Verify data survival with a
triple count before and after the move:

```bash
curl -s -u admin:<password> --data-urlencode \
  'query=SELECT (COUNT(*) AS ?n) WHERE { GRAPH ?g { ?s ?p ?o } }' \
  -H 'Accept: application/sparql-results+json' \
  http://localhost:3030/openmetadata/sparql
```

Run it on the old image, stop it, copy the three dataset directories into `/fuseki/databases/` on
a new volume ([the commands](rdf-fuseki-image-release.md#cutting-over-an-existing-deployment)), start
the published image and run the count again; the two must match. If they do not, stop and restore
rather than letting a rebuild repopulate: an empty store that looks healthy is the failure mode
this check exists to catch. Alternatively start empty and run the RDF indexing app with
`recreateIndex: true`. Preserve the `rdf_active_dataset` SQL row either way, and copy all three
datasets, since the active pointer may name an alternate.

Apply the native 2.0.2 SQL migrations and upgrade every OpenMetadata pod before enabling online
rebuilds. Older pods do not participate in the mutation journal or routing fence.

## Access to the agent SPARQL endpoint

`POST /v1/rdf/sparql/agent` is the read-only endpoint the AI agent's knowledge-graph tool calls as
the signed-in user. It requires the `ExecuteSparqlQuery` operation on the `rdf` resource.

- **Default.** The Data Consumer policy grants it through its own rule,
  `DataConsumerPolicy-ExecuteSparqlQuery-Rule`. Every user inherits Data Consumer through the
  Organization team, so users can run agent SPARQL queries on a fresh install and after upgrading
  to 2.1.0. The upgrade adds the rule to an existing `DataConsumerPolicy` once; if you delete it
  afterwards, later upgrades do not restore it. The upgrade skips the rule if no allow rule of
  Data Consumer lists `ViewAll` any more, for example because you removed it. In that case add
  the rule yourself if you want the default.
- **Restricted viewing.** The endpoint evaluates queries over the whole projected graph and does
  not filter by asset (#33224). If you restrict what users can view through custom policies,
  **delete `DataConsumerPolicy-ExecuteSparqlQuery-Rule`**, or those users can query assets they
  cannot otherwise see. The upgrade only notices that `ViewAll` was removed from Data Consumer. It
  does not notice a `ViewAll` narrowed by a condition or to specific resources, or deny rules in
  other policies such as domain-only or conditional-deny policies, so check for those yourself
  before or after upgrading.
- **Opting out.** Delete that rule to withdraw the grant from everyone. To withdraw it from
  specific users, give them a role with a deny rule for `ExecuteSparqlQuery`; a deny rule wins
  over the inherited grant. Admins always pass.
- **Granting selectively.** With the rule deleted, grant the operation to chosen roles with a
  policy rule that names `ExecuteSparqlQuery`. A wildcard `All` allow rule does not grant it.

`GET /v1/permissions/rdf?user=<name>` reports the effective result for a user.

## Capacity planning

TDB2 storage varies with URI and literal width. A useful planning range for OpenMetadata graphs is
150-250 bytes per triple before compaction headroom.

| Live triples | Approximate live TDB2 data | Fuseki heap | Suggested total RAM | Suggested persistent disk |
| ---: | ---: | ---: | ---: | ---: |
| 1 million | 0.15-0.25 GB | 2 GB | 4-8 GB | 4 GB minimum |
| 10 million | 1.5-2.5 GB | 4 GB | 8-16 GB | 16 GB minimum |
| 50 million | 7.5-12.5 GB | 8 GB | 24-48 GB | 80 GB minimum |

Size the persistent volume as **at least `3 datasets × live size × 2.5`** when blue/green rebuilds
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

## Live write recovery

The 2.0.2 migration creates the live queue and shared projection health tables for MySQL and
PostgreSQL. Pending work survives server restarts and executor rejection. A failed operation stays
at the head of the queue, with its attempt count and error recorded, and retries after 1, 2, 4, …,
up to 60 seconds. Later operations wait so a failed add cannot be replayed after its matching delete.
A command that fails ten delivery attempts is moved to `rdf_live_write_dead_letter`, including its
payload, attempt count, and error. Moving it, advancing the queue, and marking shared health degraded
are one SQL transaction. Later commands can proceed while the skipped operation remains visible for
reconciliation. Dead letters are never replayed behind newer writes, which could restore an edge
that a later command deleted. A successful full rebuild removes only dead letters whose failure
versions were known when that rebuild started.

A crash after Jena commits but before SQL acknowledges causes replay; entity reconciliation and
set-based relationship updates tolerate that repeated delivery. Recovery uses the current serving
dataset and participates in the existing blue/green mutation journal.

`GET /v1/rdf/status` reports `DEGRADED` after a failed live operation or when the oldest queued
operation is at least 30 seconds old. Every server reads the same SQL state. Successful replay
clears the queue condition automatically; it does not require an indexing-app run. Failures outside
the durable queue remain recorded separately. Only a successful recreate run covering all entity
types acknowledges those failures, and only those known before that run started.

Inspect outstanding work without reading entity payloads:

```sql
SELECT id, createdAt, attempts, nextAttemptAt, lastError
FROM rdf_live_write_queue ORDER BY id LIMIT 50;

SELECT failureVersion, repairedVersion, updatedAt, lastError
FROM rdf_projection_health WHERE id = 'active';

SELECT id, createdAt, attempts, failedAt, lastError, failureVersion
FROM rdf_live_write_dead_letter ORDER BY id LIMIT 50;
```

The queue retains unacknowledged operations rather than expiring them. Monitor SQL disk usage and
`ontology.rdf.queue.pending` / `ontology.rdf.queue.lag` during prolonged outages. The pending gauge
reports the shared backlog on each server; aggregate it with `max` across instances. An invalid command
blocks later work only until its delivery attempts are exhausted. Repair the reported error and run a
full rebuild to reconcile dead letters. Do not delete queue or dead-letter rows to make status green.
Failed operations remain visible until recovered.

Writes already dropped by older releases have no recovery record and need a one-time rebuild.
The metadata commit and queue insert are still separate transactions: a process crash in that
short interval, or a SQL outage that prevents enqueueing, is outside the queue's delivery guarantee.
Enqueue failures are logged and degrade projection health when SQL is available; a failed health
write is retried while that process remains alive. This is not a transactional metadata outbox.

During a rolling upgrade from a release before 2.1.0, reasoning freshness can report results as
current that are not. Older servers enqueue without recording
`rdf_projection_health.enqueuedWatermark`. A 2.1.0 server that delivers or dead-letters such a
write records its ID, but an older server that drains it removes the only trace of that write. An
older server's blue/green promotion also switches datasets without assigning a new generation.
Avoid blue/green rebuilds until every server runs 2.1.0, and refresh reasoning after the last older
server stops.

## Write throughput

TDB2 is a single-writer store, and the indexing pipeline is built around that fact: reader
threads load and translate entities in parallel, but all writes for a dataset funnel through a
single sink writer with **exactly one in-flight request**. Adding client threads does not add
write throughput by design — reader parallelism keeps the writer fed, and the writer keeps exactly
one transaction open on Fuseki at a time, so client timeouts measure actual server work instead of
queue position. For the same reason a reindex runs on one server: spreading it across servers
would add readers, but every write would still wait for the same Fuseki writer.

Live metadata hooks persist replayable operations in `rdf_live_write_queue` after the metadata
transaction commits, then execute asynchronously. A database fence permits one live writer across
all servers, regardless of `ASYNC_MAX_CONCURRENT_RDF_WRITES`. Producers use a separate, short SQL
transaction and do not wait for the triplestore. Each server holds at most one drain task and loads
one pending operation at a time; reaching 1,000 pending operations no longer discards writes.
Entity operations carry only type and ID. Replay reads current metadata without the entity cache,
so it does not restore an old entity snapshot or copy service connection credentials into the queue.

This adds a small SQL transaction per live hook and an entity read per replay. Measure ingestion
request latency and queue lag under the expected load when comparing throughput.

The RDF app's `relationshipIsolationMaxFailures` setting separately limits failed per-source writes
when isolating a failed relationship batch (default three; zero disables that isolation pass).
Successful source writes do not consume this budget. It is independent of HTTP request retries and
the live queue's ten-delivery limit.

Throughput therefore depends on the number and size of write transactions:

- A `recreateIndex: true` run clears the graph (or builds into an idle blue/green dataset) and then
  uses **insert-only appends**. RDF Thrift is serialized to a bounded temporary file before HTTP,
  without a combined model or body string. This detects byte-limit and serialization failures
  before Fuseki can commit a valid prefix. Memory still includes the queued per-entity models;
  temporary disk must accommodate concurrent bounded uploads.
- Incremental runs reconcile existing values with SPARQL UPDATE and are budgeted much more
  conservatively (`RDF_MAX_UPDATE_PAYLOAD_BYTES`).
- `RDF_GZIP_REQUESTS=true` compresses append bodies. The server stages and bounds the decompressed
  upload before acquiring TDB2's writer, then checks the operation deadline during parsing and
  before commit. Only gzip is supported.

The image includes a Graph Store extension (`OPENMETADATA_EXTENSION_ENABLED=true`). Its defaults
are 50 seconds per upload, 64 MiB decompressed per request, and 16 simultaneous receivers. Override
the first two with `OPENMETADATA_WRITE_TIMEOUT_MS` and `OPENMETADATA_MAX_UPLOAD_BYTES`.
Indexing preflights the dataset before clearing data, and fails only when the dataset cannot be
used: it does not exist, the credentials are rejected, the user is not authorized, the dataset is
read-only, or `tdb2:unionDefaultGraph` is off. Union is checked by behaviour, so it holds on any
Fuseki: readiness writes one triple into a named graph, asks for it without a `GRAPH` clause, and
removes it. OpenMetadata writes every entity into a named graph, so without union the SPARQL
playground, the MCP tools, SHACL validation and inference see none of them. The extension and the
`arq:*Timeout` settings are optional. On Apache Jena Fuseki without them, indexing proceeds with
the client's own upload budget and deadline and logs each missing guarantee. Without the extension
a Graph Store upload holds TDB2's writer while it transfers, so other writes wait behind it: a small
update issued during a 4.4 MB upload at 200 KB/s waited 20 s on stock Fuseki 6.0.0 and 0.23 s with
the extension. `arq:updateTimeout` alone does not protect Graph Store POST/PUT.

These are cooperative deadlines: checks abort expired parsing and roll back the transaction;
blocked storage I/O or a TDB2 commit itself cannot be forcibly interrupted safely. Client timeout,
connection loss after submission, and server/gateway failures have uncertain write outcomes and
are never automatically retried or bisected. Only failures known to precede a connection are retried.

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
| `RDF_REQUEST_TIMEOUT_MS` | `60000` | Maximum client wait for one RDF request. |
| `ASYNC_MAX_CONCURRENT_RDF_WRITES` | `8` | Legacy setting; durable live delivery serializes writes across servers to preserve ordering. |

Insert-only appends are budgeted separately and far more generously than reconciling updates
because the limiting factor is transaction count rather than request size. Collapsing a rebuild
from thousands of transactions into dozens is the single largest throughput lever available without
changing the deployment.

Larger batches reduce transaction and journal overhead but increase request size, parse time, and
retry cost. If a larger batch approaches `RDF_REQUEST_TIMEOUT_MS`, reduce the batch. Raising only
the client deadline does not change the shipped server deadlines. Wide tables can produce tens of
megabytes of triples per 100-entity batch, so validate changes against representative catalogs.

## Read throughput

TDB2 readers use snapshot transactions and remain concurrent while the single writer commits.
OpenMetadata keeps interactive reads bounded at both layers: API query/result limits prevent
unbounded responses, graph exploration has a 30-second aggregate traversal budget and a bounded
short-TTL cache, and Fuseki aborts an abandoned query after 50 seconds. Keep Fuseki near the
OpenMetadata servers and preserve memory outside `-Xmx` for the OS page cache; RDF indexes are
memory-mapped, so starving page cache is a common cause of slow reads and writes together.

### Reading the run record's stage timings

`readerTimeMs`, `processTimeMs` and `sinkTimeMs` on a run record are **aggregate work summed across
concurrent threads**, not elapsed time. Reading runs on the reader threads and translation on a pool
of up to 50 threads, so those two stages overlap both each other and the writer. The consequence is
deliberate but easy to misread: **the stage times can add up to more than the run actually took.**
In the four-reader measurement below, reading alone summed to 70 s in a run that took 41.5 s —
that gap is the parallelism working, not an error.

Read them as "where did this run spend its effort", and take elapsed time from the run record's
`startTime`/`endTime`. The one stage that does approximate wall clock is `sinkTimeMs`: RDF writes are
serialized to a single in-flight request, so there is nothing for it to overlap with.

### Reader threads decide read concurrency

A reindex pages each entity type by keyset, which fetches stored rows only, and hands each page to
one of `producerThreads` reader threads, which load the entity's full field set — the expensive
part of a read, because the RDF mapper needs every field — and pass it to the writer. A type of any
size is read by every reader thread at once.

Measured end to end on one catalog of 10,000 tables, every hundredth of them 500 columns wide, with
Fuseki 6.2.0 on a 4 GiB heap. Each time is the mean of three runs and includes clearing and
compacting the dataset, about 11.5 s of every run:

| Reindex | App wall clock | Records / s |
| --- | ---: | ---: |
| `producerThreads: 4` (default) | 43.3 s | 231 |
| `producerThreads: 8` | 42.9 s | 233 |
| The distributed mode this replaced, at its defaults | 77.4 s | 129 |

Beyond four readers the single writer is busy most of the run, so more readers help only a little.
Raise `producerThreads` when `readerTimeMs` dominates and `sinkTimeMs` is well below the run's
duration; otherwise the writer, not reading, is the limit.

Loaded pages wait in memory for the writer, so a run reads ahead at most two pages per reader
thread and at most about 4,000 loaded entities, never fewer than two pages. A larger `batchSize`
therefore shortens the read-ahead rather than multiplying memory: at `batchSize: 1000` four pages
are in flight whatever `producerThreads` is.

### What not to tune

- **Do not raise `producerThreads` past the point where `sinkTimeMs` approaches the run's
  duration.** Writes are single-file by design; extra readers only speed up the read/translate
  side, and once the writer is saturated they add database load without making the run faster.
- **Do not raise `RDF_WRITE_MAX_RETRIES` when requests are timing out.** The client-side deadline
  does not cancel the server-side update — Fuseki keeps parsing and committing the abandoned
  request, so each same-size retry multiplies server load. (The server-side `arq:updateTimeout` in
  `FUSEKI_UPDATE_TIMEOUT_MS` bounds this damage, but retry storms still waste the writer.)
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
- **One run at a time.** Every run takes the `rdf_reindex_lock` row before anything else, including
  the admission-guard wait, and renews it every 30 s until it has reported its final status. A run
  that finds the lock held, such as a scheduled run meeting an on-demand run, ends `STOPPED` with a
  message naming the run that holds it, rather than failing. An on-demand run triggered while a
  scheduled run waits for the guard is skipped the same way; stop the waiting run to start at once.
  The lock of a run whose server stopped expires after five minutes.

Upgrades migrate an RDF app that still has the former exact daily default (`0 0 * * *`) to the
weekly schedule. Custom schedules and applications with scheduling disabled are not changed.

## Blue/green rebuilds

By default a `recreateIndex` run clears the served dataset before it starts repopulating it, so
every query returns partial results until the run finishes — on a large catalog that window is
measured in hours. From the clear until a complete rebuild finishes, `GET /v1/rdf/status` reports
`DEGRADED`. The rebuild runs on the one server that started it and is not resumed elsewhere: if that
server stops mid-run (a rolling deploy, an OOM kill, a node drain), the graph stays partial, and
`DEGRADED`, until the next rebuild completes. Use blue/green for catalogs whose rebuild takes long
enough to overlap a deploy; an interrupted blue/green run leaves the previous graph serving. Enabling **Blue/Green Rebuild** in the RDF Indexing application's configuration
(alongside *Recreate RDF Store*) changes the shape of a rebuild:
the run builds into an idle second dataset and switches to it only after the build succeeds, so the
previous graph keeps serving until cutover, and its dataset is retained until the next rebuild
reuses it.

Builds alternate between the fixed `openmetadata_a` and `openmetadata_b` names derived from the
configured endpoint. The original `openmetadata` directory remains present too: allow space for
up to three dataset copies plus compaction headroom until an operator retires the unused original.
Custom endpoint names need matching base, `_a`, and `_b` assembler declarations.

The run records the selected dataset, rebuild generation, and payload budget on the job, and
every write of the run uses those immutable values. Live writes commit a mutation journal entry before contacting
Fuseki and route under the shared SQL fence. Promotion replays the journal into the completed
snapshot, then atomically checks the final watermark and changes the pointer. Each pod consults
that pointer when routing; there is no polling delay after cutover. Promotion also marks
materialized inference rules dirty in the same transaction so their output can be rebuilt.

The journal is bounded to 256 MiB or 100,000 mutations. Exhaustion or inability to capture a
mutation fails the rebuild while allowing the live mutation to proceed against the serving graph.
A 120-second lease, renewed every 30 seconds, fences an abandoned run. A new run can reclaim an
expired target; stale generation handles cannot write to it. Catch-up has a five-minute budget.
An uncertain **build** write quarantines its generation to prevent a delayed request corrupting
an immediately reused target. After restarting Fuseki to terminate outstanding requests, an
administrator may remove that specific failed row from `rdf_rebuild_state` by its `rebuildId`;
the next rebuild clears the target. The serving pointer is unaffected by this recovery.
These limits bound resource use; sufficiently busy catalogs may require a quieter rebuild window.
An explicitly requested blue/green run never falls back to clearing the serving graph.

Promotion is gated twice:

- a sanity check refuses to activate a dataset that reports zero triples after indexing records;
- a **success-ratio gate** (`minSuccessRatio` in the RDF app configuration, default `0.95`) refuses
  to activate when the rebuild lost more than the configured fraction of records. In both cases the
  previous dataset keeps serving and the run fails visibly.

Deleting a dataset through the Fuseki admin API removes its registration but **not** its TDB2 files;
the alternation reuses and clears the same two directory names. Allow disk for both datasets and
compaction's replacement generation. To reclaim the
idle dataset's disk entirely, stop Fuseki and remove the unused
`{FUSEKI_BASE}/databases/<dataset>_a|_b` directory of the dataset that is not the active pointer.

## Compaction and disk growth

OpenMetadata requests Fuseki compaction after clearing a recreate run and after indexing its
records. Blue/green runs compact the target before promotion so live writers can continue using
the serving dataset. In-place runs compact after reporting completion. TDB2 copies index pages
even during insert-only writes; clearing and compacting an
empty target does not reclaim the obsolete pages created during its subsequent rebuild. Larger
bounded batches reduce transaction churn, but the volume must still accommodate peak usage before
compaction. See the [scale validation](rdf-scale-validation.md) for measurements and workload settings.
Compaction is best-effort: an indexing run can succeed even if disk reclamation fails.

To compact manually:

```bash
curl -u admin:<password> -X POST \
  'http://localhost:3030/$/compact/openmetadata?deleteOld=true'
```

Fuseki returns an asynchronous task identifier. Inspect active and completed tasks at `/$/tasks`
and confirm the data volume has enough space for both the old and replacement datasets. TDB2 index
growth can reflect small transactions, failed or skipped compaction, or a volume that filled before
compaction completed. [Jena storage FAQ](https://jena.apache.org/documentation/tdb/faqs.html).

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
| `ASYNC_MAX_CONCURRENT_RDF_WRITES` | `8` (effective `1` for Fuseki) |
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
| `RDF_AI_ENABLED` | `false` |
| `RDF_FEDERATION_ENABLED` | `false` |

Use `RDF_ENDPOINT` for new deployments. `RDF_REMOTE_ENDPOINT` remains a deprecated fallback for
backward compatibility, and `RDF_ENDPOINT` takes precedence when both are set. Override the
development credentials in every production deployment.

## Monitoring and failure diagnosis

Useful Fuseki administration endpoints are:

- `/$/ping` for liveness and readiness.
- `/$/stats` for dataset and operation statistics.
- `/$/metrics` for **Prometheus-format metrics** — scrape this in production; it exposes request
  counts and latency per endpoint alongside JVM memory and GC figures. It requires basic auth,
  like every path except `/$/ping`; configure the Prometheus scrape with the Fuseki credentials.
- `/$/tasks` for compaction and other asynchronous administration work.

On the OpenMetadata side:

- Micrometer publishes `rdf.fuseki.request` (latency, tagged by operation and outcome),
  `rdf.fuseki.timeouts`, `rdf.fuseki.payload.bytes`, and `rdf.index.job` (whole-run duration
  tagged by outcome). Requests slower than 10 s log a warning with operation and payload size.
- Per-record indexing failures persist in the `rdf_index_failures` table, are wiped at the start of
  each run, and are queryable at `GET /v1/rdf/reindex/failures` (also surfaced by the RDF app's
  "View Reindex Failures" button in the UI).
- A server that starts while an RDF run is executing on another server leaves that run alone. When
  the run's own server stopped, its run record is marked failed once its reindex lock expires,
  within about six minutes, with a message naming the server that stopped renewing the lock.

Monitor indexing records per second, SPARQL update latency, container RSS, page-cache availability,
persistent-volume usage, and journal growth. OpenMetadata logs `RDF circuit breaker is open` after
repeated connection failures or request timeouts; check Fuseki health, request latency,
credentials, and network reachability before increasing retries.

## Inference

Materialized inference is the only inference path. Set `RDF_MATERIALIZED_INFERENCE_ENABLED=true`, keep the asserted RDF rebuild current, and schedule `RdfInferenceApp`. Rules write to durable per-rule named graphs in Fuseki and expose dirty state, last materialization time, triple count, and error details through the inference status APIs. SPARQL queries see that output when they request `inferenceLevel=custom`.

`inferenceLevel=none`, the default, reads asserted data only. Fuseki's union default graph also holds the rule graphs (`<baseUri>graph/inferred/<rule>`), so while materialized inference is enabled OpenMetadata runs such a query with every other named graph as its dataset (`FROM` and `FROM NAMED`). The complete-lineage endpoint, the RDF insights and the agent SPARQL endpoint read asserted data the same way. A query that declares its own `FROM` or `FROM NAMED` runs as written. Each server reads the graph list from Fuseki and relists after its own write names a graph the list lacks, or after a blue/green promotion; a background refresh every two minutes picks up graphs created by another server or written to Fuseki directly, so those can be missing from `none` results until then. Inferred graphs are never included (ADR:2026-10-11-asserted-only-rdf-reads-name-every-non-inferred-graph). Jena evaluates a query over several `FROM` graphs through a read-only union view rather than TDB2's native union default graph, so expect `none` queries over large datasets to cost more than `custom` ones. Disabling materialized inference does not empty the rule graphs: clear `graph/inferred/*` first, or `none` queries include them again.

A run recomputes the whole rule bundle whenever any rule is dirty, because rules read each other's conclusions; a requested rule name only has to exist. The run empties every rule graph, then applies the enabled rules in passes until a pass derives nothing new, so conclusions of facts removed since the last run disappear. While a run is in progress, `custom` queries see an incomplete closure. A run that needs more than 64 passes fails and leaves its rules dirty, as does any rule the store rejects. Changes that arrive during a run, whether graph writes or rule edits, keep the affected rules dirty for the next run. When a run runs out of passes after such changes, the growing input rather than the rules kept it from converging: it stops without recording an error, leaves every rule dirty, and ends `STOPPED` (`409` on demand).

Only one run executes at a time across the cluster. A scheduled run that finds another in progress ends `STOPPED`; an on-demand `POST /v1/rdf/rules/materialize` returns `409`. The run holds a five-minute lease in `rdf_reindex_lock`, renewed every 30 seconds, so a server that stops mid-run blocks others for at most five minutes. A run whose lease another server takes over, for example after its renewals stalled past the expiry, stops at its next update and leaves the rule status to the run that took over, ending `STOPPED` (`409` on demand). A run that stops waiting for an update at `requestTimeoutMs` keeps its lease until it expires instead of releasing it, because Fuseki may still be applying that update; keep `arq:updateTimeout` well under five minutes so the update ends first. Deleting a rule empties its graph at once, or through the next run when one is in progress. The `transitive-lineage-closure` starter rule ships disabled, because it stores every ancestor/descendant pair; prefer `prov:wasDerivedFrom+` anchored to the assets in question. Stored rules that no longer pass validation are disabled before they next run, with the reason in their `lastError`.

OpenMetadata no longer runs reasoners in its own process. `RDF_INFERENCE_ENABLED`, `RDF_DEFAULT_INFERENCE_LEVEL`, and `RDF_MAX_IN_MEMORY_INFERENCE_TRIPLES` are ignored, with a startup warning when `RDF_INFERENCE_ENABLED` is set, and SPARQL requests for `rdfs` or `owl` inference return `503`. Use SPARQL 1.1 property paths for request-specific traversal; they execute inside Fuseki without copying the graph.
The complete-lineage endpoint intentionally does not impose a row limit on its property-path query.
Size `RDF_REQUEST_TIMEOUT_MS`, Fuseki resources, and client response handling for the largest
lineage graph operators can request. Semantic search is not an exhaustive traversal: each seed
expands at most 100 related graph candidates before reranking to the caller's requested result
limit. Use the complete-lineage endpoint or direct SPARQL for exhaustive graph traversal.

## Historical transport benchmark

The original `RdfWritePathScaleHarness` measurements used Fuseki 6.2.0 in Docker (2 CPUs,
`-Xms4g -Xmx4g`) and a synthetic catalog with every 100th table having 500 columns:

| Scale | Original transport | Wall clock | Entities/s |
| ---: | --- | ---: | ---: |
| 20k entities | piped RDF Thrift | 21.8 s | 918 |
| 20k entities | `connection.load` | 25.6 s | 782 |
| 20k entities | piped RDF Thrift + gzip | 20.8 s | 963 |
| 100k entities | piped RDF Thrift | 158 s | 632 |

These are historical results from before complete-payload staging and durable rebuild coordination.
The measurements below were taken on the retired in-repo image, before it gained Lucene indexes;
the published image has none.
They compare transports on this branch, not this branch against `origin/main`, and do not establish
current indexing-app or live-event throughput. The harness exercises translation and storage;
`scripts/rdf-reindex-benchmark.sh` instead triggers the complete indexing app.

Run `scripts/rdf-write-path-benchmark.sh` for the current storage path. For an app/live comparison,
use the same seeded catalog and fresh dataset state on `origin/main` and this branch. Record total
app duration including relationships, OM/Fuseki peak memory, retry counts, exact final graph state,
and live-event queue lag plus p95/p99 visibility latency. Include wide tables, long literals, two
pods, interruption, and restart. Raising the append count limit alone does not combine the app's
100-entity reader submissions; measure batch settings at the actual app boundary.

A local validation run of the revised code (10,000 entities, 100-entity submissions, every 100th
table with 500 columns, 1 GiB Fuseki heap) took 37.7 seconds with staged Thrift and 43.0 seconds with
the library fallback. Both added exactly 855,803 stored triples. Storage time was 33.3 versus
34.5 seconds; translation time differed substantially, so the total-time difference is not a
reliable speedup estimate. This was one local trial on a shared host, not a production comparison
against `origin/main` or a live-event latency benchmark.

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
# the server aborts it near arq:updateTimeout. Takes ~1 minute, and is the direct
# proof that FUSEKI_UPDATE_TIMEOUT_MS reached the server.
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
