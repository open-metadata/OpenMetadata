# Reindex test plan

Tracks the test cohort that exercises `SearchIndexingApplication` end-to-end:
alias swap, mid-run search availability, stats correctness, mapping integrity,
field-explosion bounds, retry semantics, stop-under-load, vector embeddings,
distributed coordination, scale, and CPU headroom.

Owner: search infra. Status column updates as each lands.

## Conventions

- Backend ITs live in `org.openmetadata.it.tests.search.*` and end in `IT.java`.
  They use the embedded `TestSuiteBootstrap` (~4s warm-up) and run under the
  default `mvn verify` profile.
- UI parity tests live in `org.openmetadata.playwright.scenarios.search.*` and
  end in `UIIT.java`. They boot the OM Docker image via `ContainerizedServer`
  (~3 min warm-up) and run under `mvn verify -P ui-it`.
- Scale + benchmark tests carry `@Tag("scale")` and run only in the nightly
  workflow; they are excluded from the default `ui-it` matrix.
- Multi-server tests carry `@Tag("distributed")` and bring up ≥ 2 OM containers
  behind a shared Postgres + OS.
- Every test ends with the **db-count == es-count + stats.failure +
  stats.warning** invariant where applicable. That single line is the umbrella
  correctness gate; #13 enforces it across all aliases as a suite-level cohort
  check.

## Shared helpers (build before tests)

All under `org.openmetadata.it.search.*` so the Collate module re-uses them
via the test-jar.

| Helper | API surface | Used by |
|---|---|---|
| `IndexAliasInspector` | `Map<String,String> aliasToIndex()`, `long docCount(alias)`, `JsonNode mapping(alias)`, `long fieldCount(alias)`, `Set<String> declaredAliases()` (reads from `IndexMappingLoader`) | #1, #4, #5, #11, #13 |
| ~~`JobStatsParser`~~ | **Not needed** — `AppRunRecord.successContext.stats` is already typed (`org.openmetadata.schema.system.Stats` → `StepStats`). Use directly. | n/a |
| `DbCountQuerier` | `Map<EntityType,Long> dbCounts()` — runs `SELECT COUNT(*)` against entity tables via the management SDK or a JDBI binding | #1, #13 |
| `EsCountQuerier` | wraps `_cat/count?alias=...`, `_search?size=0`, and `_search?aggs=cardinality(_id)` | #1, #2, #13 |
| `EsOutageInjector` | testcontainers helper: `pause(Duration)`, `dropConnections()`, `rejectWrites(Duration)` | #6, #14 |
| `BulkEntityLoader` | extends existing `EntityLoader` with `tables(int n, int columnsPer)`, `glossaryChain(int depth)`, `containerTree(int fanout, int depth)`; uses batched SDK calls | #5, #10, #11, #12 |
| `CpuSampler` | reads `docker stats --no-stream` JSON for the OM container at 1 Hz; emits min/avg/p95/max | #12, #14 |
| `HealthProbe` | hammers `/api/v1/system/version` at configurable QPS, records 2xx/5xx + latency histogram | #14 |
| `ReindexController` | thin wrapper over `Apps.searchIndexing()`: `triggerWith(config)`, `stopAndWait(timeout)`, `latestRun()`, `freshRunSince(millis)` | all reindex tests |

Helpers go into the existing test-jar `<includes>` so collate-integration-tests
picks them up automatically (`org/openmetadata/it/search/**` is already
shipped).

---

## Scenario 1 — Trigger reindex, aliases swap, explore count matches

### Goal
After a full recreate reindex, every entity alias points to a **new** backing
index, and the visible count (badges on Explore, doc_count in ES, `COUNT(*)`
in DB) reconciles for every entity type.

### 1a · `ReindexAliasSwapIT` (Tier A, backend)
- **Path:** `org/openmetadata/it/tests/search/ReindexAliasSwapIT.java`
- **Setup:** seed via `BulkEntityLoader.smallCohort()` — 50 tables in 5 schemas,
  20 topics, 30 dashboards, 1 glossary with 40 terms.
- **Steps:**
  1. Snapshot pre-run alias → index map.
  2. `ReindexController.triggerWith(recreateMode = true).awaitSuccess()`.
  3. Snapshot post-run alias → index map.
- **Assertions:**
  - For every entity alias: `pre.index != post.index` (atomic swap).
  - Old backing index either deleted or detached (no alias points to it).
  - `EsCountQuerier.docCount(alias) == DbCountQuerier.dbCount(entityType)` for
    table, topic, dashboard, glossaryTerm.
  - `JobStatsParser.sink.failure == 0` and `sink.warning == 0` on a clean
    cohort.
- **Effort:** 0.5d (extends existing `CollateFullReindexFromCleanStateIT`).

### 1b · `ExploreCountAfterReindexUIIT` (Tier B, UI parity) — ALREADY COVERED
- **Existing:** `SimpleReindexTriggerUIIT` already triggers a reindex via the
  UI and asserts per-tab Explore counts (`assertCountForTab`) match the
  seeded counts for every {tables, topics, dashboards, pipelines} tab. The
  intent of #1b — "Explore badges read the post-swap alias" — is already
  proven.
- **Decision:** no new UIIT for #1b. Backend `ReindexAliasSwapIT` + existing
  `SimpleReindexTriggerUIIT` together cover the contract.

---

## Scenario 2 — Active reindex, still searchable, no duplicates

### 2a · `NoDuplicatesDuringReindexIT` (Tier A)
- **Path:** `org/openmetadata/it/tests/search/NoDuplicatesDuringReindexIT.java`
- **Goal:** prove search returns a stable, deduplicated view at every point
  during a recreate reindex.
- **Setup:** seed 2k tables.
- **Steps:**
  1. Capture baseline: `EsCountQuerier.distinctIds("table_search_index")`.
  2. Trigger reindex; while running, poll alias every 500ms for 30s:
     - `count == distinctIds` (no duplicate `_id`s)
     - alias resolves to **some** backing index at every probe (no gap)
     - `hits.total.value` never drops below baseline by more than the in-flight
       batch size.
  3. After run completes: same assertion.
- **Assertions:**
  - Cardinality of `_id` across all probes == distinct DB ids.
  - No probe sees zero docs.
- **Effort:** 1d. Uses `EsOutageInjector` only as a stretch test.

### 2b · `SearchAvailableDuringReindexUIIT` (existing) — ALREADY COVERED
- **Existing:** the test already probes during reindex and explicitly asserts
  "duplicates indicate the alias swap exposed both old and new index"
  (`SearchAvailableDuringReindexUIIT.java` lines 151, 167). No extension
  needed beyond the backend `NoDuplicatesDuringReindexIT` already landed.

---

## Scenario 3 — Stats: warnings, reader/processor/sink balance, embedding count

### `ReindexStatsIT` (Tier A)
- **Path:** `org/openmetadata/it/tests/search/ReindexStatsIT.java`
- **Setup:**
  - Seed clean cohort (50 tables, 20 topics).
  - Seed one **broken-FK entity**: a table whose `databaseSchema` reference
    points to a UUID that was deleted via JDBI fixture (the relationship row is
    orphaned). This must surface as a warning, not a hard failure.
  - Optionally seed N entities with vector embedding enabled if the feature
    flag is on (see #8 for gating).
- **Steps:** trigger reindex, capture `AppRunRecord.successContext`.
- **Assertions:**
  - `reader.read == processor.processed`.
  - `processor.processed == sink.success + sink.failure + sink.warning`.
  - `sink.warning >= 1` (the broken-FK row).
  - If vector flag on: `vector.embedded > 0` and equals number of seeded
    embedded entities.
  - Per-entity-type stats sum equals the global stats.
- **Open questions:**
  - Exact path for broken-FK injection — through `Entity.getEntityRelationship`
    or directly via `CollectionDAO.relationshipDAO().delete()`?
  - Does `AppRunRecord` already expose a typed stats accessor, or do we read
    the raw JSON node? (Build `JobStatsParser` based on what's there.)
- **Effort:** 1d.

---

## Scenario 4 — Index mapping integrity + template fallback

### `IndexMappingTemplatesIT` (Tier A)
- **Path:** `org/openmetadata/it/tests/search/IndexMappingTemplatesIT.java`
- **Goal:** every alias has the mapping declared in `indexMapping.json`, and
  if a doc gets written to a non-existent index, the index template still
  applies the correct mapping.
- **Setup:** boot server (no seed needed for part 1).
- **Steps:**
  1. **Mapping correctness:** for every alias in `indexMapping.json`:
     - `IndexAliasInspector.mapping(alias)` exists.
     - All expected analyzer names from the language file (`om_analyzer`,
       `om_analyzer_jp`, etc.) are present.
     - Field types in the live mapping match the schema-derived expected set
       (`keyword` vs `text` vs `nested`).
  2. **Template fallback:** delete an alias (e.g., `mlmodel_search_index`),
     then publish a single doc via low-level OS client; assert:
     - The index was auto-created (template took effect).
     - The auto-created mapping matches the canonical one in
       `indexMapping.json`.
     - `entityType`, `id`, `deleted` fields all have correct type.
- **Run matrix:** OpenSearch (default) and Elasticsearch (`-DsearchType=elasticsearch`).
- **Effort:** 1.5d (includes building `IndexAliasInspector` mapping diff).

---

## Scenario 5 — No field explosions

### `IndexFieldExplosionIT` (Tier A)
- **Path:** `org/openmetadata/it/tests/search/IndexFieldExplosionIT.java`
- **Goal:** prove the mapping is bounded regardless of:
  - DatabaseSchema with many child tables.
  - Entities with many custom properties.
- **Setup & steps:**
  1. **Schema with many tables:** create 1 databaseSchema + 500 tables under
     it; trigger reindex. Read mapping for `database_schema_search_index` and
     `table_search_index`.
  2. **Custom properties:** add 50 custom properties to the `table` entity
     type; create 10 tables that set all 50 values. Trigger reindex. Read
     `table_search_index` mapping.
- **Assertions:**
  - `IndexAliasInspector.fieldCount("database_schema_search_index")` is within
    a tight bound (e.g., < 80) **and** does not scale with the number of child
    tables.
  - `fieldCount("table_search_index")` is unchanged after adding custom
    properties (de-normalized — custom-property values live as a single
    `flattened` or `keyword`-array field).
  - No `customProperties.<name>` keys appear as top-level mapping entries.
- **Why:** catches OM #23514-class regressions where a nested array was
  inadvertently mapped as `object` and exploded field count.
- **Effort:** 1d.

---

## Scenario 6 — Live indexing retry semantics

### `LiveIndexRetryIT` (Tier A)
- **Path:** `org/openmetadata/it/tests/search/LiveIndexRetryIT.java`
- **Goal:** when ES is briefly unavailable, the live-indexing path retries up
  to 3 times, records each retry, and eventually either succeeds (if ES
  recovers) or surfaces failure in stats.
- **Setup:** seed nothing; rely on live-index path triggered by entity
  creation.
- **Steps:**
  1. Pause OS container via `EsOutageInjector.pause(Duration.ofSeconds(2))`
     in a background thread.
  2. Create a table → live-index attempt fires.
  3. Unpause; entity should land in the index.
- **Assertions:**
  - Internal counter (or log scrape via `LogCaptureExtension`) shows ≤ 3
    retries for the index event.
  - Eventually-consistent assertion: doc is present within 10s of unpause.
- **Negative variant:** pause for > 10s so all 3 retries fail; assert failure
  recorded in `AppRunRecord` for the next reindex run and live-index dropped
  the event with a logged error (no silent loss).
- **Open question:** how do we observe retry count without log scraping? If
  there's a metric exposed, use that. Otherwise reuse the existing
  `Awaitility` + `LogCaptureExtension` pattern from `SimpleReindexTriggerUIIT`.
- **Effort:** 1.5d.

---

## Scenario 7 — Stop-under-load

### 7a · `ReindexStopUnderLoadIT` (Tier A)
- **Path:** `org/openmetadata/it/tests/search/ReindexStopUnderLoadIT.java`
- **Goal:** stop signal must terminate the run promptly even under heavy load.
- **Setup:** seed 10k tables (use `BulkEntityLoader.tables(10_000, 5)`).
- **Steps:**
  1. Trigger reindex with batchSize=100, threads=4.
  2. Awaitility 5s to let it warm up; capture `startTimestamp`.
  3. Call `ReindexController.stopAndWait(Duration.ofSeconds(15))`.
- **Assertions:**
  - `AppRunRecord.status` transitions to `STOPPED` within 15s.
  - `endTimestamp - stopRequestTimestamp <= 10s`.
  - `EsCountQuerier.docCount(alias)` stops increasing within 2s of stop
    request (no docs written after `stopRequestTimestamp + 2s`).
- **Effort:** 1d.

### 7b · `StopReindexUIIT` (Tier B) — DEFERRED
- **Status:** deferred. Awaiting confirmation of the Stop button testid in
  `/settings/apps/SearchIndexingApplication` — current `SearchIndexAppPage`
  has no locator for it. To unblock: open the page in dev, inspect the stop
  control, then add `Locator stopButton()` to the page object and write the
  test. Backend test `ReindexStopUnderLoadIT` already covers the contract.
- **Effort:** 0.5d once locator is known.

---

## Scenario 8 — Vector embeddings + column indexing

### `VectorEmbeddingIndexingIT` (Tier A, gated)
- **Path:** `org/openmetadata/it/tests/search/VectorEmbeddingIndexingIT.java`
- **Gating:** `@EnabledIfSystemProperty(named = "vectorEmbedding", matches = "true")`.
  Add `-DvectorEmbedding=true` to the nightly profile only.
- **Setup:** enable vector embedding feature in `openmetadata-secure-test.yaml`
  (or runtime config), seed 10 tables with 5 columns each.
- **Assertions:**
  - Each table doc has `embedding` field with declared dimension (e.g., 384).
  - `columns[].embedding` is present and has the same dimension.
  - kNN query against `embedding` returns the seeded table when given its own
    vector ± noise.
  - `JobStatsParser.vector.embedded` equals seeded count.
- **Effort:** 1.5d (mostly figuring out kNN query syntax across OS/ES).

---

## Scenario 9 — Multi-server distributed reindex + coordinator failover

### 9a · `DistributedReindexCoordinationIT` (Tier D)
- **Path:** `org/openmetadata/it/tests/search/distributed/DistributedReindexCoordinationIT.java`
- **Goal:** 2 OM servers share the reindex workload via partitioning; total
  work matches single-server result.
- **Infra:** new `DistributedServer` helper that brings up 2 OM containers
  behind a shared Postgres + OS via testcontainers `Network`. Already
  partially proven by `DistributedAutoTuneReindexUIIT`.
- **Assertions:** see #13 invariant; plus each server contributed
  `processor.processed > 0` (proven via per-server stats endpoint, if
  exposed, or via log scrape).

### 9b · `DistributedCoordinatorFailoverIT` (Tier D)
- **Path:** `.../distributed/DistributedCoordinatorFailoverIT.java`
- **Goal:** kill the coordinator mid-run; the surviving server promotes and
  the run still completes.
- **Setup:** 2 OM containers, seed 5k tables.
- **Steps:**
  1. Trigger reindex; identify coordinator via app log or the
     `/v1/system/apps/SearchIndexingApplication/status` endpoint.
  2. Once `processor.processed > 500`, kill coordinator container.
  3. Awaitility up to 60s for the surviving server to promote (election +
     resume).
  4. Run completes.
- **Assertions:**
  - Final run status is `SUCCESS`.
  - `db_count == es_count`.
  - Partition log shows the surviving node took over remaining partitions.
- **Open question:** is there an explicit leader election, or does the app run
  on one server with the other as a hot standby waiting on a DB lock? Behavior
  of the test depends on this. Validate during helper build.
- **Effort:** 3d (most of the infra work is `DistributedServer` helper).

---

## Scenario 10 — Reindex benchmark

### `ReindexBenchmarkIT` (Tier C, `@Tag("scale")`)
- **Path:** `org/openmetadata/it/tests/search/scale/ReindexBenchmarkIT.java`
- **Goal:** measure throughput and latency under controlled conditions so
  regressions are caught nightly.
- **Setup:** seed 10k tables.
- **Steps:** trigger reindex 3 times back-to-back, discard warm-up run, average
  the rest.
- **Output:** write JSON to `target/benchmark/reindex-<git-sha>.json`:
  ```json
  {
    "throughput_docs_per_sec": 1850.4,
    "p50_batch_ms": 42,
    "p95_batch_ms": 180,
    "peak_heap_mb": 1240,
    "total_ms": 5410
  }
  ```
- **CI compares** against last known-good baseline checked into
  `openmetadata-integration-tests/baselines/`. Failure if any metric regresses
  > 20%.
- **Effort:** 2d (most is the comparison harness).

---

## Scenario 11 — Heavily nested containers (no blowup, efficient reads)

### `NestedHierarchyIndexIT` (Tier A)
- **Path:** `org/openmetadata/it/tests/search/NestedHierarchyIndexIT.java`
- **Goal:**
  - Deeply nested entity hierarchies (10-level container tree, 10-level
    glossary chain) reindex successfully — no stack overflow, no OOM.
  - Searching deep descendants does not produce N+1 search calls.
- **Setup:**
  - `BulkEntityLoader.containerTree(fanout=3, depth=10)` → ~88k container
    docs.
  - `BulkEntityLoader.glossaryChain(depth=10)` → 11 terms.
- **Assertions:**
  - Reindex completes; final stats: `failure == 0`.
  - All 88k container docs are searchable.
  - Mapping has a bounded `path` field (or equivalent) — no per-level field
    explosion.
  - "Find leaf by name" search uses ≤ 2 ES round trips (instrumented via a
    `RestClient` request counter installed for the test).
- **Effort:** 1.5d.

---

## Scenario 12 — 100k entity load test

### `Scale100kEntitiesIT` (Tier C, `@Tag("scale")`, nightly only)
- **Path:** `org/openmetadata/it/tests/search/scale/Scale100kEntitiesIT.java`
- **Goal:** prove the engine scales with prod-sized JVM + OS heap.
- **Infra:**
  - OM container: `-Xmx4g` (matches prod base profile).
  - OpenSearch container: `-Xmx2g`, `indices.query.bool.max_clause_count=4096`.
  - Postgres container: prod-sized config.
- **Setup:** seed 100k tables across 50 schemas. Use multi-threaded
  `BulkEntityLoader` so seeding doesn't blow the test budget.
- **Steps:** trigger reindex once.
- **Assertions:**
  - Reindex completes within configured timeout (target: < 30 min on CI ARM).
  - `db_count == es_count`.
  - CpuSampler.avg < 80% on the OM container (see #14 for the strict variant).
  - Heap utilization at end of run < 90% of `-Xmx`.
- **Output:** same JSON format as #10, written to `target/benchmark/scale-*.json`.
- **Effort:** 2d.

---

## Scenario 13 — DB↔ES count reconciliation

### `DbToEsCountReconciliationIT` (Tier A, umbrella gate)
- **Path:** `org/openmetadata/it/tests/search/DbToEsCountReconciliationIT.java`
- **Goal:** the single most important correctness invariant — for every alias
  in `indexMapping.json`:
  ```
  db_count(entityType) == es_count(alias) + stats.failure(entityType) + stats.warning(entityType)
  ```
- **Setup:** seed a cohort that exercises every alias (one of each
  user-creatable entity type + a few of each entity that supports relationships
  / hierarchies / custom properties).
- **Steps:** trigger reindex; capture stats; compute reconciliation per
  alias.
- **Assertions:** invariant holds for every single alias listed in
  `indexMapping.json`. Test fails with a per-alias table showing the diff.
- **Effort:** 1d. This test should be the **last** thing in any reindex CI
  matrix and is the canonical gate.

---

## Scenario 14 — CPU headroom + Jetty liveness

### `ReindexCpuHeadroomIT` (Tier C, `@Tag("scale")`)
- **Path:** `org/openmetadata/it/tests/search/scale/ReindexCpuHeadroomIT.java`
- **Goal:** during a sustained reindex, the OM container's CPU stays below the
  k8s health-probe ceiling and Jetty keeps serving traffic.
- **Setup:** seed 50k tables. OM container with `-Xmx2g`, single CPU equiv
  (`--cpus=2`).
- **Steps:**
  1. Start `CpuSampler` at 1 Hz.
  2. Start `HealthProbe.run(qps=10, duration=Duration.ofMinutes(15))` against
     `/api/v1/system/version`.
  3. Trigger reindex.
  4. Wait for completion.
  5. Stop both probes; collect samples.
- **Assertions:**
  - `CpuSampler.p95 < 75%` over the reindex window.
  - `HealthProbe.successRatio == 1.0` (no dropped probes).
  - `HealthProbe.latencyP99 < 500ms`.
  - Reindex completes successfully (regression of #14 should not mask via a
    silent reindex failure).
- **Effort:** 2d. Most of the work is `CpuSampler` and `HealthProbe`.

---

## Collate-side mirroring

For each Tier A test that exercises the indexable surface (1, 3, 5, 8, 13),
add a thin mirror under
`collate-integration-tests/src/test/java/io/collate/it/tests/search/` that:

1. Boots a Collate server (via the existing `CollateTestServer`).
2. Seeds at least one Collate-only entity type (e.g., `dynamicAgent`).
3. Re-runs the same invariant.

The OM tests prove the engine; the Collate mirrors prove the schema delta
hasn't regressed indexing. Helpers are shared via the OM test-jar (already
plumbed by the recent merge).

Mirrors needed:

| OM test | Collate mirror |
|---|---|
| `ReindexAliasSwapIT` | `CollateReindexAliasSwapIT` |
| `ReindexStatsIT` | `CollateReindexStatsIT` |
| `IndexFieldExplosionIT` | `CollateIndexFieldExplosionIT` (covers dynamicAgent custom properties) |
| `VectorEmbeddingIndexingIT` | `CollateVectorEmbeddingIndexingIT` (Collate is where vector is most likely enabled) |
| `DbToEsCountReconciliationIT` | `CollateDbToEsCountReconciliationIT` |

Each mirror is < 80 lines — it's a constructor swap on the existing factory
+ a re-assertion.

---

## Build order

| Phase | Items | Effort |
|---|---|---|
| 0 | Shared helpers: `IndexAliasInspector`, `JobStatsParser`, `DbCountQuerier`, `EsCountQuerier`, `ReindexController`, `BulkEntityLoader` extensions | 2d |
| 1 | Umbrella correctness: #1a, #2a, #3, #13 (+ Collate mirrors of #1, #3, #13) | 4d |
| 2 | Mapping correctness: #4, #5, #11 (+ Collate mirror of #5) | 4d |
| 3 | Failure paths: #6, #7 (+ #7b UI) | 3d |
| 4 | UI parity: #1b, #2b extension | 1d |
| 5 | Vector embeddings: #8 (+ Collate mirror) | 2d |
| 6 | Multi-server infra + #9 | 4d |
| 7 | Scale tier helpers (`CpuSampler`, `HealthProbe`) + #10, #12, #14 | 5d |

Total: ~25d. Phases 0–3 are the load-bearing cohort; everything past phase 4
can land in parallel.

## Resolved questions

1. **Stats accessor.** Fully typed — `AppRunRecord.successContext.stats` is
   `org.openmetadata.schema.system.Stats` with typed getters for `jobStats`,
   `readerStats`, `processStats`, `sinkStats`, `vectorStats`, `entityStats`.
   Each is a `StepStats` with `totalRecords`, `successRecords`,
   `failedRecords`, `warningRecords`, plus vector + timing fields. **`JobStatsParser`
   helper is dropped** — tests use the typed schema directly.
2. **Multi-server coordination.** DB-lock based, **not** leader-election.
   `DistributedSearchIndexCoordinator` acquires `SEARCH_REINDEX_LOCK` via
   `SearchReindexLockDAO` with a 5-min timeout. Partitions are claimed via
   `FOR UPDATE SKIP LOCKED`. Takeover happens when a partition's claim is
   unrefreshed for 3 min (`PARTITION_CLAIM_TIMEOUT_MS`). Quartz is
   clustered. So #9b validates **partition reclaim**, not leader election —
   kill the server holding partitions, wait 3 min, surviving node claims them.
3. **Retry instrumentation.** Two signals exist:
   - Micrometer counter `search.retry.enqueued` (in `SearchIndexRetryQueue`).
   - DB table `search_index_retry_queue` with statuses `STATUS_PENDING`,
     `STATUS_PENDING_RETRY_1`, `STATUS_PENDING_RETRY_2`, `STATUS_FAILED`,
     etc. Query directly for assertion — no log scraping needed.
4. **Broken-FK injection.** Use `Entity.getCollectionDAO().tableDAO().delete(uuid)`
   (pattern from `LineageBrokenReferenceIT.java`). The DAO delete leaves
   `entity_relationship` rows orphaned. `buildSearchIndexDoc()` already
   tolerates this and surfaces a warning in `StepStats.warningRecords`.
5. **Alias enumeration source.** `IndexMappingLoader.getInstance().getIndexMapping()`
   returns the merged OM+Collate map. OM file loads first
   (`openmetadata-spec/.../indexMapping.json`); Collate file overrides
   matching keys (`openmetadata-service/.../elasticsearch/collate/indexMapping.json`).
   No dynamic/plugin/per-tenant registration. **`#13` enumerates via this
   loader**, not by reading the JSON file directly.
