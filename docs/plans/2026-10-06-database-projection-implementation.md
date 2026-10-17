# Database projection implementation

Status: **partial implementation, shipping in 2.2 as the stacked PRs #35570–#35577 (merged in
order); production capture remains disabled.** Shared search document preparation and RDF
translation are in use, but the durable capture/expansion/delivery service is not yet implemented
end to end. The indexing apps stay for manual and emergency rebuilds; their weekly schedules are
retired (steps 3 and 4). The original checkpoints below describe foundation coverage, not
completion of the transparent-indexing goal.
Tracks the approved [search/RDF design](2026-10-06-database-search-indexing-design.md).

## Reliability, API latency and recovery — 2026-10-10

Decisions:

- **The API never waits for search or RDF.** A write returns after its database commit; indexing
  happens afterwards, with no read-your-write wait, not even a bounded one.
- **Last write wins** for rebuild writes (see the limits below), and every catch-up write rebuilds
  from the current database state.
- **A failed write is a durable dirty marker, not an operation to replay.** The search retry queue
  is keyed by entity; the RDF queue keeps entity locators. Several failures of one entity collapse
  into one row, and a change that went through after the failure is included when the row is
  retried.
- **Several servers share one queue.** A worker claims a row with a token; a new failure re-arms an
  in-flight row so its completion is rejected and the row runs again with newer state; an
  abandoned claim is reclaimed after ten minutes. RDF keeps one writer for the cluster.

Order of work: (1) recovery that survives outages, (2) asynchronous writes, (3) checked
propagation, a scheduled repair, recovery when the cluster comes back empty, writes to both
indexes during a rebuild, no forced refresh and retiring the weekly reindex. The intent row first
planned for step 2 was dropped on 2026-10-11; the scheduled repair covers what it would have.

### Step 1: recovery that survives outages

| Area | Change | Main classes |
|---|---|---|
| Search retries | A transient failure is retried with a doubling wait up to an hour, for about a day, before it is marked `FAILED`; before, it was three attempts in 30 seconds. A missing index (404), a timeout (408) and a conflict (409) are retried. The next attempt time is stored in `search_index_retry_queue.nextAttemptAt`. Queue depth per status is published as `search.retry.queue.depth`. | `SearchIndexRetryWorker`, `SearchIndexRetryQueue` |
| Retry writes | Every retry goes through the bulk path with the time it read its rows, as version-guarded writes, so a retry never replaces a document a later write read more recently. A row deleted between the retry's read and its write loses the document. A single-table retry now rewrites its column documents too. | `SearchIndexRetryWorker` |
| Promotion | A failed new-index run no longer replaces a serving index that has documents; it promotes only when nothing is served. A type with failed records waits for the end-of-job ratio check instead of being promoted early. | `DefaultRecreateHandler`, `DistributedSearchIndexExecutor` |
| Reindex during an outage | A bulk batch that fails because the cluster cannot take writes, or meets an open breaker, keeps retrying for about ten minutes instead of failing its documents; it keeps its request slot, so readers wait. | `BulkOutageRetry`, both bulk sinks |
| RDF outages | A live write that fails while Fuseki does not answer waits for it without spending an attempt, so an outage cannot dead-letter the queue; the projection reports `DEGRADED` as soon as the oldest write has failed, not after 30 seconds. A write that fails while Fuseki answers still counts. | `RdfStoreUnavailableException`, `RdfLiveWriteStore`, `RdfLiveWriter` |
| RDF dead letters | While the live queue is idle, dead letters are replayed every five minutes. Entity writes reload the row; an edge change is applied only if the database still agrees with it, so a late replay cannot restore a removed edge or remove a re-added one. Health clears only when every failure since the last repair was a replayed dead letter; a failure outside the queue still needs a rebuild. | `RdfLiveWrite`, `RdfLiveWriteStore` |

The 2.2.0 migration adds `search_index_retry_queue.nextAttemptAt` and
`rdf_live_write_dead_letter.replayedAt`, on MySQL and PostgreSQL.

### Step 1 verification

- **Unit tests:** 4,585 passed across the search, reindex, RDF and entity-lifecycle packages.
- **PostgreSQL and Elasticsearch 9.3:** 51/51. `SearchIndexRetryQueueIT` (41) includes a retry that
  must not replace a document a later write read, and a failed retry that is not claimed before its
  next attempt time. Promotion, alias swap, stop under load, duplicates during a recreate, in-place
  runs, partition starts and the unrefreshed staged count also passed.
- **MySQL and OpenSearch 3.4:** 48/48 of the retry, promotion, alias-swap, in-place and
  partition-start classes, which runs the new retry-time query and migration on MySQL.
- **RDF, MySQL and PostgreSQL with Fuseki:** 56/56 (`RdfLiveWriteRecoveryIT` 30,
  `RdfBlueGreenRebuildIT` 26). New cases: an unreachable store spends no attempts; dead letters are
  replayed and health recovers; a failure outside the queue still needs a rebuild; a dead letter
  that still fails is kept for the next replay.

### Still open after step 1

- ~~Writes still run after commit on the request thread~~ — done in step 2 below; the forced
  refresh on every write was dropped in step 3.
- ~~A crash between commit and the post-commit write leaves no record~~ — accepted on 2026-10-11;
  the scheduled repair rebuilds such a document (step 3).
- ~~A retry's cascade stops at 5,000 descendants; child propagation is never checked~~ — step 3.
- ~~A cluster that comes back empty is not rebuilt~~ — the index check in step 3.
- ~~A bulk response that rejects single documents with 429 fails them~~ — retried in step 3.
- RDF enqueues take a cluster-wide lock. Step 3 removed it; the rebase onto main on 2026-10-14
  restored it, because RDF reasoning freshness (#34975, #35199) reads queue ids as commit order.
  Live writes still apply the database's current state.

### Step 2: search is eventually consistent

An API call no longer waits for search. Its search writes are queued after the commit and applied
on per-entity lanes (`LiveSearchWrites` over `OrderedLaneExecutor`); there is no flag and no
read-your-write wait. Typical lag is the time of one write.

| Rule | How |
|---|---|
| A write indexes the entity as it was committed | It snapshots the entity when queued (the response may mask or strip it later) and is version-guarded by that time, not by when its lane runs it. |
| Writes to one entity apply in order | One lane per entity id (or FQN). Lineage edges go on the lane of the entity whose document holds them; a basic test suite's `testSuite` field and a test case's cleared status go on the table's and the test case's lanes. |
| A write that rebuilds from the database is stamped when it starts | `updateEntity(reference)` and fan-outs read the row on the lane, so they are as new as that read, not as old as their queue time. |
| A create cannot put back older state | Creates are guarded like updates (`sourceReadAt`); before, a create was an unguarded merge, so one applied after a newer write undid it. |
| A fan-out follows the writes queued before it | Writes to other entities' documents — child propagation, domain and data-product moves, FQN-prefix renames, glossary re-indexing, deleted results and relationships — run on a separate executor once markers on every lane show the earlier writes are applied (`queueFanOut`). Otherwise a child's own queued create, applied later, would put back what the fan-out changed. |
| Inside a transaction, nothing is queued before the commit | Writes and fan-outs go through the existing deferral scope. Post-commit work that reads search to find what a rename will rewrite (tag cache invalidation) still runs on the committing thread before the rename is queued. |
| A queued write reads the database, not a cache | Lane threads serve no HTTP request, so each write clears the per-request caches (`PerRequestContextCleaner`) before and after it runs; otherwise a rebuild read an entity as an earlier write on that thread had cached it. |
| Failures and overflow are retried from the database | A failed write, or one a full lane sheds, goes to the search retry queue by its entity. Shutdown drains the lanes and sheds what is left to the retry queue. |

Server reads that used search right after a write were moved to the database: a test case's latest
result comes from the time-series table (the list path already did).

Tests: `QueuedSearchWrites.await()` (integration tests) waits for every write the server queued
before the call, in process or through the admin-only, test-support
`POST /v1/test-support/search/queued-writes/await`. Shared search reads in `BaseEntityIT`,
`SearchDocuments`, the column-grid and incident barriers, data product assets and the tests that
read once after a write use it. Playwright: the global search box, the service list, the asset
pickers (domain, data product, ports, tag, glossary term) search again until the new entity is
listed (`searchUntilVisible`, `searchAssetPickerUntilListed`), and the shared seed waits until its
data assets are searchable (`EntityClass.waitUntilSearchable`). An explore filter check and adding
or removing a tag's assets wait until the change is indexed before reading search-backed lists.

### Step 2 verification

- **Integration tests, every CI lane on MySQL and Elasticsearch 9.3:** parallel 16,842 tests,
  global-state 504, retry-queue 41, multi-node 23, rdf 211 — no failures. A first 34-class
  PostgreSQL run had found the defects fixed above (stale per-request cache on lane threads, creates
  overwriting newer writes, the test case result read) and tests that read search once after a
  write; the failed classes then passed 1,184/1,184.
- **PostgreSQL and OpenSearch 3.4:** the search suite (`-Psearch-it`) 69/69; the parallel lane
  16,841 with one failing class, `RdfLiveProjectionIT`, whose wait for `DEGRADED` raced the
  30-second lag rule while the store was down. Fixed (RDF outages row above): it passed twice on
  PostgreSQL and OpenSearch, and with `RdfLiveWriteRecoveryIT` (33/33) on PostgreSQL and
  Elasticsearch.
- **Unit tests:** the service suite, 11,415 tests; one failure, not from this work —
  `TaskWorkflowLifecycleResolverTest` expects a `Medium` task priority default that the generated
  `Task` does not carry at this branch's base either.
- **Playwright,** on a local server built from this branch: the helpers' specs (domain, data
  product, tag, glossary and port asset pickers, service and entity search, tier and tag explore
  filters, nested columns), then 482 tests across 15 search-heavy specs (domains, data products,
  tags, teams, glossary, explore filters and browse, advanced search, global search suggestions).
  The tag asset filter failed by reading the asset list right after the add and was fixed. Three
  failures did not involve indexing: a count read once before its request returned and a
  domain-scoped user's sidebar (both pass alone), and the glossary term drawer's tag picker not
  opening. Bulk edit cannot load locally: the UI dev server never opens the WebSocket the CSV
  export reports on.

Known limits:

- Ordering is per server. A create queued on one server and a parent's fan-out on another, within
  the lag, can leave the child with the parent's previous inherited field until the next write or
  the next repair pass, which rebuilds children read just before their parent changed (step 3).
- A crash between commit and the queued write leaves no record; accepted on 2026-10-11, the next
  repair pass rebuilds the document (step 3).
- ~~The CSV import's batched search write still runs inline~~ — queued in step 3.
- Adding matching test cases to a logical suite now reads the database unless the filter has free
  text (step 3). Glossary tag validation already read the database (only its labels come from
  search); a governance workflow's periodic batch fetch keeps its search filters.
- Search-side RBAC filters (owners, domains, tags in the index) follow the same lag; entity reads
  and writes authorize against the database.

### Step 3: repair and recovery — 2026-10-11

Decisions (2026-10-11):

- **A crash between commit and the queued search write is accepted**, like any write that dies with
  its process. No intent row. The scheduled repair rebuilds such a document on its next pass; a
  lost delete is swept away overnight.
- **The weekly full reindex is retired.** Live writes and the scheduled repair keep search
  current; a reindex is for upgrades and emergencies.
- **During a new-index rebuild, live writes go to both the serving and the staged index.**
- **Live writes do not force a refresh.**

| Area | Change | Main classes |
|---|---|---|
| Writes by query | Every update-by-query and delete-by-query refreshes its targets first, waits for its background task, and retries version conflicts up to three attempts. What is still undone, or a request that fails, is recorded as a repair scope: the retry worker rebuilds the documents the query matched from the database, skipping those rewritten since. The managers no longer write retry rows that name a value instead of an entity, which the worker could not resolve. | `ByQueryPolicy`, `ByQueryAware*Client`, `SearchRepairScope`, `SearchScopeRepair`, `SearchDocumentRebuilder` |
| Retry cascades | A cascade that passes 5,000 descendants records the rest as a repair scope instead of dropping them. | `SearchIndexRetryWorker` |
| Refresh | Document writes no longer force a refresh. Writes by query refresh their targets first. A table's column documents are rewritten by id rather than updated by query. The test barrier refreshes after draining. | entity managers, `SearchRepository`, `QueuedSearchWrites` |
| Bulk writes | A bulk create waits for its response and throws the ids it rejected; a rejected column document retries its table (it used to retry the column id, which the worker deleted from every index). Documents a bulk rejects with 429 are retried with the outage backoff instead of counted failed. | entity managers, both bulk sinks |
| Rebuilds | While a rebuild stages an index, live writes reach both indexes. A recreate or run that fails discards what it staged; its route used to be renewed until the server restarted. The orphan cleaner skips a staged index a run still writes to. Before a new index is promoted, rows the partitions did not reach are written to it. | `RebuildAwareEntityManagement`, `DefaultRecreateHandler`, `DistributedIndexingStrategy`, `OrphanedIndexCleaner`, `StagedIndexCompleteness` |
| Scheduled repair | Every 15 minutes one server runs a pass (lock `SEARCH_REPAIR_LOCK` in `search_reindex_lock`, progress in `projection_repair_state`). It rebuilds documents missing or read before their row last changed, and the children of a changed parent read in the 10 minutes before it changed. Once a day it deletes documents whose rows are gone. A document that fails to rebuild goes to the retry queue, and inheriting documents that fail are recorded as a repair scope, so one bad row cannot stall every later pass; within a scope, a batch that fails is rebuilt one document at a time and only the documents that still fail are queued, so the scope settles; a sweep or index check that fails is tried again next time. Only a database or search outage leaves the window for the next pass. | `SearchRepairJob`, `ChangedDocumentsRepair`, `OrphanedDocumentsSweep` |
| Lost indexes | Each pass checks every type's index exists and carries its alias. The alias reads name the serving indexes, 20 per request: a read that names no index resolves against the whole cluster, which a search role limited to OpenMetadata's indexes may not do, and a failed read is an error rather than "missing". A type still broken a minute later gets its templates rewritten, a forced reindex of just those types, and the missing index created. | `SearchIndexCheck` |
| Weekly reindex | The seed has no schedule; the 2.2.0 migration moves installs on the shipped Sunday 00:30 schedule to on-demand runs and keeps any other. Moving an app to no schedule now removes its recurring job (it threw). Bulk writes use their own search connection pool. | `SearchIndexingScheduleMigration`, `AppScheduler`, both search clients |
| Orphan sweep | The in-place sweep never removed a real orphan: indexes map `updatedAt` as epoch seconds while it holds milliseconds, so its "changed since the run" clause matched every document. The clause is gone; writes happen after commit and stamp `sourceReadAt`. | `InPlaceIndexSweep` |
| Time series | Live time-series writes carry their queue time and are guarded like entity writes; the bulk reference reindex is guarded too. Search listings of time-series records drop `sourceReadAt` before reading a record, as they already dropped the legacy `deleted` field; without that every incident listing answered 400 once a record was stamped. | `LiveSearchWrites`, `SearchRepository`, `SearchVersionGuard`, `EntityTimeSeriesRepository` |
| Rebuilt test cases | A rebuild from the database fences a test case's or logical suite's relationship field at the revision it read, whatever the entity's last change was. It used the live partial-update path, which accepts only a change to that field alone, so the retry worker could never rebuild a test case last changed in any other field, and the repair failed on them. | `SearchDocumentRebuilder`, `BulkWriteOptions`, `SearchDocumentUpdates` |
| CSV import | Its search writes are queued like any other write. | `EntityCsv` |
| Logical test suites | Adding the test cases a filter matches reads the database unless the filter has free text. | `TestCaseResource`, `TestCaseRepository` |
| RDF | Every live write applies the database's current state, as a replay does, so a write delivered late cannot put back older data. Producers keep the cluster-wide enqueue lock: RDF reasoning freshness reads queue ids as commit order. | `RdfLiveWriteStore`, `RdfLiveWriter`, `RdfLiveWrite` |

The 2.2.0 migration adds `projection_repair_state` (named `search_repair_state` until step 4) on
MySQL and PostgreSQL.

Left as they are: glossary tag validation reads tags from the database and uses search only for the
labels in its response; a governance workflow's batch fetch runs periodically with user-written
search filters that have no database equivalent.

Tests: `SearchRepairIT` (a lost document, an orphan, a child that missed its parent's change, a
recorded repair), `SearchIndexRecoveryIT` (a deleted index and one a write created without its
aliases), `SearchWriteRoutesIT` (writes reach both indexes; a discarded rebuild loses nothing), the
filtered logical-suite add without a search wait, and unit tests for the policy, scopes, rebuilder,
dual writes, completeness, migration, cleaner, the repair pass's lock and window
(`SearchRepairJobTest`), stale-document detection (`ChangedDocumentsRepairTest`) and the index check
(`SearchIndexCheckTest`). `POST /v1/test-support/search/repair` runs a
pass on demand.

### Step 3 verification

First round, MySQL 8.3 + Elasticsearch 9.3, full parallel lane: 16,839 tests, 10 failures, four
causes, all fixed:

- Incident listings answered 400 once incident records carried `sourceReadAt` (six classes): the
  strict time-series reader now drops it.
- Every repair pass failed: inheriting test cases could not be rebuilt (the fenced-write bug in the
  table above), and one failing type stopped the sweep and held the window (two `SearchRepairIT`
  cases).
- `PersonaAIContextIT` read search right after its setup without waiting; it now waits through the
  test barrier.

Second round, on the fixed jar:

| Run | Tests | Failures |
|---|---:|---:|
| MySQL + Elasticsearch, the 14 classes above and around them | 635 | 0 |
| MySQL + Elasticsearch, global-state lane | 504 | 1, then 0 |
| MySQL + Elasticsearch, retry-queue / multi-node / rdf lanes | 41 / 23 / 211 | 0 |
| PostgreSQL + OpenSearch, search-it profile | 71 | 0 |
| PostgreSQL + OpenSearch, full parallel lane | 16,846 | 0 |
| Service unit tests | 11,460 | 1 |

The global-state failure was `WorkflowDefinitionResourceIT.test_ApiEndpointPeriodicBatchWorkflow`:
a periodic batch workflow selects its entities through search, and the test triggered it the
moment its endpoints were created. Three batch-trigger tests now wait for their entities to be
searchable, as the others already did (59/59 afterwards). The unit failure is
`TaskWorkflowLifecycleResolverTest.workflowStartVariablesTolerateNullOptionalFields`, which fails
on `main` too.

The scheduled pass ran on its own timer in every lane server, about two minutes after startup, and
no pass failed in the second round. On a fresh server it rebuilt the relationship types the
migration tool seeds (it writes no search documents) and a classification. A fresh install's Search
Indexing application has no schedule.

Playwright, against this branch's server on PostgreSQL + Elasticsearch 9.3 (the same 17
search-heavy specs as step 2, four workers): 500 passed, 8 failed. Seven tests opened a
search-backed list or count right after a write made through the UI and never queried it again;
they passed only because every write forced a refresh. They now reopen the tab or reload until the
item is listed (`openTabUntilListed`, `checkAssetsCount`, `navigateToSubDomain`), and the Domains,
Data Products, Data Product and Subdomains and subdomain pagination specs then passed 77/77. The
eighth, `Glossary.spec.ts` "Create term with related terms, tags and owners during creation",
fails the same way on code this branch does not touch (the tag dropdown of the term form never
opens) and failed in the step 2 runs too. `SearchIndexApplication.spec.ts` (Basic project) passed,
including the reindex it starts.

On the final jar, which adds the per-document fallback in scope repairs, `SearchRepairIT`,
`AsyncSearchIndexConsistencyIT`, `SearchWriteRoutesIT` and `WorkflowDefinitionResourceIT` passed
75/75 (9 skipped as on `main`), and `SearchIndexRetryQueueIT` 41/41, on MySQL + Elasticsearch and
on PostgreSQL + OpenSearch.

The UI itself waits a fixed 500 ms (`ES_UPDATE_DELAY`) before re-reading search after asset
changes. Without the forced refresh that is shorter than the one-second refresh interval, so a
user can see the previous asset list or count until the page is reloaded. Raising the delay, or
re-reading until the count changes, would hide that; neither is done.

### Step 4: RDF repair, and no weekly schedule for either projection — 2026-10-11

Decided 2026-10-11: RDF gets a scheduled repair like search's, and neither reindex application ships
a schedule.

| Area | Change | Main classes |
|---|---|---|
| Shared pass | The lock, window, state row and daily sweep timing moved out of the search repair into a base both repairs extend. The state table is now `projection_repair_state`, one row per repair. A type whose table has no `updatedAt` column (an undefined-column error on PostgreSQL or MySQL) is set aside for the server's life with one warning instead of failing every pass; the RDF repair met one, `event_subscription_entity`. | `ScheduledRepairJob`, `RepairByEntityType` |
| RDF projection check | A full RdfIndexApp rebuild starts when no run is on record, when the store has no ontology graph, or when the last full build failed at least a day ago. A stopped build stays stopped; the reason must hold for a minute; nothing starts while an RDF rebuild or a search reindex runs. Without this, a fresh install, or one upgraded to 2.1.0 (which clears the run records), would stay REBUILDING and refuse agent SPARQL until someone ran the app. | `RdfProjectionCheck`, `RdfRepairJob` |
| RDF changed rows | Rows changed since the last pass are compared with their projection's `dct:modified`, which only the entity's own projection writes. A missing or different one is queued as a refresh on the live write queue, which re-reads the row, so the cluster's one RDF writer applies fixes in turn with live writes. | `ChangedEntitiesRdfRepair`, `RdfProjectedEntities`, `RdfUpdater.refreshEntity` |
| RDF sweep | Once a day, one grouped query counts every type's projections; a type whose store holds more projections than its table has rows (deleted rows stay in the table) is listed by the first hex digit of its ids, and the entities whose rows are gone are queued for removal. | `RdfOrphanSweep` |
| Waiting | A pass waits while an RDF rebuild holds its lock, while the store does not answer, and while the live queue's oldest write is more than a minute old. | `RdfRepairJob` |
| Schedules | The RdfIndexApp seed has no schedule. The 2.2.0 migration retires the shipped crons of both applications (`30 0 * * 0` for search, `0 0 * * 6` for RDF) and keeps any other. | `ReindexScheduleMigration` |
| Tests | `POST /v1/test-support/rdf/repair` runs a pass. The IT bootstrap builds the RDF projection before the rdf lane's tests: on a fresh database the repair would otherwise start that build a few minutes in and clear the graph under them. | `TestSupportRdfResource`, `TestSuiteBootstrap` |

Not covered by the RDF pass: a lost relationship write (an edge between entities, lineage), since a
refresh rewrites only an entity's own triples; it waits for a full rebuild. A crash-lost write is
caught only if its row's `updatedAt` moved, as for search.

Tests: `RdfRepairIT` (a projection the store lost, a stale one, an entity whose row is gone, a pass
another server holds, a projection never built), unit tests for the projection check, the
changed-row comparison, the sweep, the SPARQL reads, the pass's waiting rules, the per-type loop
and the migration.

### Step 4 verification

| Run | Tests | Failures |
|---|---:|---:|
| MySQL + Elasticsearch, rdf lane (with `RdfRepairIT`) | 216 | 0 |
| PostgreSQL + Elasticsearch, `RdfRepairIT` | 5 | 0 |
| MySQL + Elasticsearch, global-state lane | 504 | 0 |
| Both combinations, `SearchRepairIT` and `AsyncSearchIndexConsistencyIT` on the shared base | 14 each | 0 |
| Service unit tests | 11,485 | 1 |

The unit failure is `TaskWorkflowLifecycleResolverTest`, which fails on `main` too. The first
`RdfRepairIT` run found that `event_subscription_entity` has no `updatedAt` column: every pass
failed on it and never reached the sweep, which is why types without one are now set aside. In the
rdf lane the background RDF repair started no rebuild of its own: the bootstrap builds the
projection before the tests, and the only rebuild was the one `RdfRepairIT` asks for.

### Migrations target 2.2 — 2026-10-11

This work ships in 2.2, so its schema changes live in `bootstrap/sql/migrations/native/2.2.0` (the
projection journal tables, `search_index_job.inPlaceIndexMapping`, `search_index_partition.startCursor`,
`search_index_retry_queue.nextAttemptAt`, `rdf_live_write_dead_letter.replayedAt`,
`search_index_write_route` and `projection_repair_state`), and the weekly-schedule retirement runs
from the `v220` migration classes. The 2.1.0 migration is unchanged from `main`.

Verified on fresh databases migrated through 2.1.0 and then 2.2.0: the capture ITs, which build their
tables from the 2.2.0 statements (193, 0 failures); the search ITs that use the new tables and
columns on MySQL + Elasticsearch and PostgreSQL + OpenSearch (53 each, 0 failures); the RDF ITs on
PostgreSQL (61, 0 failures) and the rdf lane on MySQL (216, 0 failures); and the migration unit tests
(490, 0 failures). On MySQL these tables are now created after 2.1.0 sets the database collation;
the projection queries that meet older tables already compare through `JSON_UNQUOTE(JSON_QUOTE(…))`
and `CAST(… AS CHAR)`, so they do not depend on matching collations.

## In-place reindex and shared write routes — 2026-10-10

Two live indexing bugs were fixed ahead of the projection manager. A full reindex erased pipeline
execution history, because it promoted an empty index for every type it could not refill. On
several servers, a rebuild promoted an index that missed live writes handled by the other servers.
The design is in [Rebuilds today](2026-10-06-database-search-indexing-design.md#rebuilds-today-in-place-by-default-implemented-2026-10-10).

| Step | Change | Main classes |
|---|---|---|
| 0 | Failing ITs first: a reindex erases execution history; a write read before a newer one replaces it. | `SearchReindexInPlaceIT` |
| 1 | Writes are ordered by when their content was read (`sourceReadAt`), including soft delete and restore. | `SearchVersionGuard`, `SoftDeleteScript` |
| 2 | Rebuilt documents keep the fields only live writes used to set: pipeline status, usage, upstream lineage, service style. | index classes, `RebuiltDocumentFieldsTest` |
| 3 | Each type is rewritten in place, rebuilt into a new index, or skipped. In-place writes are guarded upserts; a sweep removes documents of deleted rows. The mapping hash covers only the configured language, and every index declares `sourceReadAt`. `force` requests new indexes. | `ReindexModePlanner`, `LiveSearchIndexState`, `ReindexTargets`, `BulkWriteOptions`, `InPlaceIndexSweep`, `RawIndexOperations` |
| 4 | New-index runs share their write routes through `search_index_write_route`, wait for them to propagate before reading, and unregister a discarded index before deleting it. Lineage, embedding, child-propagation and untargeted bulk writes follow the routes. | `StagedIndexRoutes`, `DefaultRecreateHandler` |
| 5 | Each partition stores the start key the coordinator found when it created the job, so a server that did not create the job starts the partition at the same row. That server used to find the start with `OFFSET` when it claimed the partition, which skipped rows once earlier rows were deleted, and cost O(rangeStart) per claim. | `DistributedSearchIndexCoordinator`, `PartitionWorker`, `SearchIndexPartitionStartIT` |

The 2.2.0 migration adds `search_index_job.inPlaceIndexMapping` (participants read it to find their
in-place targets), the `search_index_write_route` table and `search_index_partition.startCursor`,
on MySQL and PostgreSQL.

`force` is the existing `EventPublisherJob` option that the CLI `--force` already sets. No schema or
generated code changed; the UI has no toggle for it.

### In-place verification

- **Unit tests:** 3,687 passed across the search and reindex packages, system status, lineage and
  DAO composition.
- **Integration tests**, against real OpenSearch:
  - `SearchReindexInPlaceIT`, `SearchReindexInPlaceRunIT`, `SearchIndexPromotionIT`: 10/10. A rerun
    keeps the serving index, repairs a document changed only in search, removes a document whose
    row is gone and keeps one read after the run read its row. A tampered mapping hash and `force`
    each build a new index. The Step 0 history test is green.
  - 30 reindex-related classes (110 tests) on the Step 3 build: two failures, both expected
    changes. `ReindexAliasSwapIT` expected even `pipelineStatus` to get a new index;
    `IndexFieldExplosionIT` saw the table mapping grow by one field, `sourceReadAt`, which led to
    declaring it at index creation.
  - Step 4 build: 81/81, including `SearchWriteRoutesIT` (a route another server registers captures
    this server's writes; a lapsed one does not) and the two fixed classes.
  - The runs above used PostgreSQL and Elasticsearch 9.3. On MySQL and OpenSearch 3.4, the in-place,
    routes, promotion, alias-swap, field-count, async-consistency and column-toggle classes passed
    25/25, and the sweep removed the planted orphan there too.
  - Step 5 build: `SearchIndexPartitionStartIT` with the alias-swap, stop-under-load,
    duplicates, in-place, routes and promotion classes passed 16/16 on PostgreSQL and
    Elasticsearch 9.3, and 9/9 on MySQL and OpenSearch 3.4 (a subset of the same classes). The new
    test partitions classifications, hard-deletes rows that sort before a partition, and checks that
    a coordinator that did not create the job still sees the start key recorded at creation. The
    search-index unit tests passed 705/705.
- **Server logs** of the runs show the expected modes: `table=NEW_INDEX` on the first run after the
  hash change, `table=IN_PLACE` after it, `pipelineStatus=SKIP`, and one orphan removed by the sweep.
- **Timing** (`ReindexBenchmarkIT`, 10,000 seeded tables with five columns plus the rest of the IT
  catalog, PostgreSQL and Elasticsearch 9.3 on a laptop, two measured runs each):

  | Run | Average | Table documents/s | Modes |
  |---|---:|---:|---|
  | Forced rebuild | 34.2 s | 292 | 67 new indexes, 2 skipped |
  | Default (in place) | 31.2 s | 320 | 66 in place, column index rebuilt, 2 skipped |

  In-place writes are scripted upserts, dearer per document than a plain index write into an
  empty index; skipping index creation and promotion more than pays for it here. These are single
  local samples, not capacity numbers.

ITs whose subject is the new-index path now request it with `force`
(`ReindexHelpers.FORCED_REBUILD`): alias swap, duplicates during a recreate, stop under load, unsafe
bulk config and the baseline reset. `ReindexBenchmarkIT` reports in-place runs separately.

### Remaining limits

- Ordering uses server clocks. Cascades (child updates by query) stamp no read time and are not
  ordered against a rebuild; the repair rebuilds children read just before their parent's row
  changed. An entity's own vote and follower updates are guarded live writes, and live time-series
  writes stamp a read time since step 3.
- New-index runs keep plain bulk writes, so the last write wins: a live write between a batch's
  read and its write can be replaced by the older copy the batch read. This was accepted on
  2026-10-10 to keep rebuilds simple and fast; no guard is planned. ~~Routing is staged-only~~ —
  since step 3 live writes go to the serving index and the staged one, so a discarded staged index
  loses nothing, and a failed run deletes its routes.
- Since step 1 of the reliability work, a failed new-index run keeps a serving index that has
  documents and is promoted only when nothing is served; the success ratio decides what failed.
- Report-data indexes are rewritten in place without the sweep: they have no id column.
- Partitions still end after a row count and time-series types page by offset, so rows inserted
  during a run can push older rows out of every partition's reach. Since step 3 a new index is
  checked against the database by id before promotion and the missing rows are written; an in-place
  run leaves a skipped row's previous document, which the scheduled repair rewrites if it is stale.
- The in-place sweep never removed a real orphan before step 3: it skipped documents whose
  `updatedAt` was at or after the run start, and indexes map `updatedAt` as `epoch_second` while it
  holds milliseconds, so the clause matched every document. The clause is gone; `sourceReadAt` alone
  decides what the run rewrote.

### Two-process rebuild under live writes

Two server JVMs shared one MySQL 8.3 and one Elasticsearch 9.3 holding 5,000 tables with 20
columns each. A forced table rebuild ran on the coordinator while a script sent creates, updates
and hard deletes to the other server for the whole scan. `local-only` deletes the route rows as soon
as they appear, which reproduces the old routing that lived in the coordinator's JVM only.

| Run | Rebuild | Lost updates | Missing creates | Deleted but still indexed | Rows missing from index |
|---|---:|---:|---:|---:|---:|
| local-only | 21 s | 160 of 244 | 1 of 29 | 11 of 15 | 16 |
| shared, 1 | 28 s | 2 of 319 | 0 of 39 | 0 of 20 | 0 |
| shared, 2 | 18 s | 0 of 273 | 0 of 32 | 0 of 16 | 23 |
| shared, 3 | 24 s | 3 of 363 | 0 of 44 | 0 of 22 | 17 |

Every write was committed (database checks matched), and the retry queue stayed empty.
- **Lost updates in the shared runs:** each has `_version` 2 in the promoted index where its
  untouched neighbours have 1. The routed live write landed first, then the scan's plain bulk write
  of the copy it had read earlier replaced it. This is the accepted last-write-wins limit above.
- **Missing rows:** all were the first rows of partitions the participant claimed. It found each
  start with `OFFSET`, which the deletes had moved forward. Step 5 stores the start keys; the rerun
  below has none missing.

The driver is kept outside the repository; it seeds through the REST API and reads the result from
the database and the index directly.

Rerun after Step 5, on the same database (4,927 of the seeded tables left) with the same driver.
The participant processed 4, 5 and 6 of the 10 table partitions while rows were hard-deleted:

| Run | Rebuild | Lost updates | Missing creates | Deleted but still indexed | Rows missing from index |
|---|---:|---:|---:|---:|---:|
| shared, 1 | 19 s | 0 of 209 | 0 of 24 | 0 of 13 | 0 |
| shared, 2 | 14 s | 1 of 199 | 0 of 23 | 0 of 12 | 0 |
| shared, 3 | 18 s | 0 of 211 | 0 of 25 | 0 of 13 | 0 |

The PostgreSQL integration-test lane was running on the same machine during these runs, so the
rebuild times are not benchmarks.

## Remaining review items — 2026-10-07 (third pass)

This pass closes most of the items the second review left open (listed at the end of the next
section). Capture remains unregistered in production, and no indexing schedule changed.

### A caller-owned transaction keeps the only retry

`RepositoryTransactionRunner` now runs on the thread-bound handle. If that handle is already in a
transaction, a raw `inTransaction` or a `@Transaction` SQL object method opened it, so the runner
joins it without `DeadlockRetry`. Previously the runner retried its own unit after a deadlock had
already rolled back the caller's earlier writes, and could commit that unit alone. A deadlock now
propagates to the owner. A runner boundary nested in another runner boundary already joined the
outer one.

This is only half of the nested-boundary problem. The runner's search, RDF and post-commit effects
still publish when the inner unit returns, before the caller commits. No production path wraps a
repository flush in a raw transaction today. Deferring those effects to JDBI's
`afterCommit`/`afterRollback` would hold thread-local collectors open across the caller's code, and
they would leak if the caller ended the transaction any other way. That change is left until a
caller needs it.

### Updates that keep their name skip the before-image read

`EntityDAO` updates and compare-and-swap updates first run the DAO's own statement with the
unchanged name hash added to its predicate. If it matches a row, the name did not change, and the
fact records the same locator before and after. A rename, a missing row or a failed compare-and-swap
matches nothing, so capture falls back to the locked before-image read and the original statement.
`unchangedNameUpdateIsOneStatementAndRenameStillRecordsTheFormerName` asserts one statement for
the common case.

### Single statements capture without savepoints

Each single-statement write now runs without a per-call `SAVEPOINT`/`RELEASE` pair. That covers:
- entity inserts and deletes;
- extension `insert`, `delete`, `deleteAll` and the two batch deletes;
- relationship `insert` and `bulkInsertTo`;
- tag `applyTag`;
- field `insert` and `upsert`.

Such a statement either applies completely or not at all. `CaptureTransaction.executeBuffered`
sorts failures into two kinds:
- **Rejected by the database** (`UnableToExecuteStatementException`): the statement applied nothing,
  so the caller can continue exactly as it could without capture.
- **Anything else:** the outcome is unknown, so the transaction is poisoned and commit fails until it
  rolls back.

Capture work that runs after a statement has applied goes through `CaptureTransaction.afterWrite`,
which poisons on any failure.

JDBC batches and multi-statement captures keep their savepoint. A batch is not one statement: with
MySQL's default `continueBatchOnError`, earlier rows apply before a later row fails. The second
pass had moved tag `applyTagsBatchInternal` off its savepoint, which let a caller that caught the
failure commit the applied rows without capture.
`aCaughtBatchFailureCannotCommitTheRowsItApplied` covers that case.

### Guarded upserts read their before-image without a savepoint

Lineage, pipeline-JSON, ontology and metric-group upserts still need the former row. They no longer
use a savepoint:
- **PostgreSQL:** the guard is `ON CONFLICT DO NOTHING RETURNING`, so an absent row is inserted and
  captured in one statement. An existing row is locked and read, then the DAO's statement runs with
  `RETURNING`. The guard no longer rewrites existing rows.
- **MySQL:** a no-op `ON DUPLICATE KEY` guard creates or locks the row, which is then read before and
  after the DAO's statement. The read falls back to the secondary unique keys when the guard
  conflicted through one of them. Every step after the guard is post-write capture.

For one write per transaction, including the three commit statements, the statement count is:

| Path | PostgreSQL | MySQL |
|---|---:|---:|
| Buffered upsert (`HAS`) | 4 | 4 |
| Guarded upsert (`UPSTREAM`), absent row | 4 | 7 |
| Guarded upsert (`UPSTREAM`), existing row | 6 | 7 |

The second pass used about six statements plus a savepoint for every guarded upsert.

### Field point writes buffer their rows

Field-relationship `insert` and `upsert` no longer insert a header per call. They read their stored
row back, so a key the database coerced is never captured as written, and buffer it until commit.
An upsert's guard creates or locks the row before its locked before-image read. Destructive and
set-based statements still insert their header first, because their retained rows need its ID
before the source rows disappear.

### Retention scans only facts that still have consumers

Retention scans pages of mutation IDs that still have consumer rows. Each page is locked with
`SKIP LOCKED`, and the cursor moves past rows that another sweeper holds instead of ending the
pass. A kept anchor (a rename, the delete of a named row, or a prefix fact) is archived by deleting
its completed consumer rows, so later passes never read it again. Because an archived anchor is
never revisited, a newer entity fact that carries all of an older archived anchor's locators
deletes that anchor. Only older anchors are deleted, which keeps compaction acyclic.
`aNewerRenameRetiresAnAnchorArchivedBeforeIt` covers this. `overlappingSweepersKeepTheFinalLocator`
covers the locked page.

### PostgreSQL rewrites only the entity's own name

On PostgreSQL, `ENTITY` scope now sets the root `fullyQualifiedName` with `jsonb_set`, as MySQL
already did. Text `REPLACE` remains only for `NESTED` scope (containers, whose columns store their
own FQNs). Previously the PostgreSQL rewrite also changed any other entity reference in the row
whose FQN shared the prefix. For example, renaming glossary `Sales` would rewrite a term's
`realizedIn` asset `Sales.db.s.t`.

An audit of the callers found this safe. Six tables call `updateFqn`:
- tag, glossary term, domain, data product and knowledge page use `ENTITY` scope;
- container uses `NESTED`.

None of the `ENTITY` tables keeps nested FQNs that reads trust. Each embedded reference is either
stripped before storage, rebuilt on read, or not under the renamed prefix. Entities that do store
nested FQNs (tables, topics, dashboards' data models, search indexes, API endpoints, pipelines,
ML models) are never prefix-rewritten, because their parents cannot be renamed. Renaming one would
need `NESTED` scope or a cascade written in code.

`entityRewriteLeavesReferencesToOtherEntitiesUnderThePrefix` asserts the behavior on both
databases, with and without capture.

### Known limitation: commits that bypass `Connection.commit`

The capture buffer is flushed only by `Connection.commit` and by `setAutoCommit(true)`. Some
commits bypass both:
- MySQL DDL, `LOCK TABLES` and the other implicit-commit statements;
- a raw `COMMIT` executed as SQL.

These would commit writes without their buffered facts, which then flush with the next commit or
are discarded by a rollback. No captured write path issues them, and `ProjectionCapturePlugin` is
not installed in production. Migrations and maintenance that issue such statements must run on a
JDBI instance without the plugin, or commit through JDBC before issuing them.

### The 30-second concurrency-test timeouts came from the test harness

Three concurrency ITs intermittently failed with a 30-second timeout, but only when several
classes ran at once: field concurrent upserts, tag concurrent association and the FQN rewrite's
concurrent insert. Each test starts a write with `CompletableFuture.runAsync`, pauses it in a SQL
hook until the test thread releases it, and waits on the test thread with `join()`.

JUnit's parallel workers are ForkJoin threads. On JDK 21+, a ForkJoin thread that joins a future
can run pending common-pool tasks itself, including the write it just submitted. That write then
waits for a release that only its own thread can give, until the hook's timeout fires. A
standalone check on JDK 22.0.2 saw a joining ForkJoin thread run its own `runAsync` task 1,984 of
2,000 times.

The capture ITs now run that work on dedicated threads (`DedicatedThreads.EXECUTOR`). The
pre-existing resource ITs that use `supplyAsync` do not pause in hooks and were left alone.

### Third-pass verification

- **Unit tests:** **254 passed**. They cover projection contracts, the connection, buffer and
  retention units, the repository runner and side-effect scope, and search repository behavior.
- **Integration tests:** the complete capture suite ran on MySQL and PostgreSQL: **383 tests, 0
  failures, 6 skipped** (opt-in diagnostics and MySQL-only cases). It took 3:26 instead of 6:30;
  the previous run included about three minutes of 30-second hangs. The suite includes the
  repository boundary ITs (`EntityTransactionBoundaryIT`, `OneTransactionFlushAtomicityIT`,
  `EntityHardDeletionAtomicityIT`, `EntitySubtreeAtomicityIT`).
- **Red check:** `aCaughtBatchFailureCannotCommitTheRowsItApplied` fails with the tag batch moved
  back off its savepoint:
  - MySQL commits the batch's first row (`expected: <1> but was: <2>`);
  - PostgreSQL cannot continue the transaction.

  It passes with the savepoint.
- **Formatting:** `spotless:apply` was run on both Java modules.
- **Build:** Maven used the isolated repository `/tmp/openmetadata-projection-review-m2`.
- **Logs:** `/tmp/reviewer-r2d-unit.log`, `/tmp/reviewer-r3-it.log`,
  `/tmp/reviewer-r3-bench.log`, `/tmp/reviewer-r3-bench2.log` and
  `/tmp/reviewer-r3-fqn-bench-{1,2}.log`.

Opt-in diagnostics, measured as p50 over one write per transaction (single local samples):

| Write path | PostgreSQL baseline → captured | MySQL baseline → captured | Second pass, captured ÷ baseline (PG / MySQL) |
|---|---:|---:|---:|
| Entity, 100 durable transactions | 0.41 → 0.86 ms | 1.73 → 3.26 ms | 2.5× / 2.0× |
| Relationship upsert, buffered (`HAS`) | 0.46 → 0.86 ms | 0.99 → 2.21 ms | 2.6× / 2.6× |
| Relationship upsert, guarded (`UPSTREAM`) | 0.39 → 1.16 ms | 0.72 → 3.06 ms | 3.4× / 4.7× |
| Tag application (unchanged path) | 0.54 → 1.20 ms | 1.54 → 2.86 ms | 1.7× / 1.8× |
| Field insert | 0.52 → 1.27 ms | 1.62 → 3.94 ms | 2.2× / 1.9× |
| Field upsert | 0.48 → 1.46 ms | 1.57 → 4.25 ms | 2.7× / 2.8× |
| FQN rewrite, 10,000 descendants (run alone, twice) | 262–275 → 258–268 ms | 203–208 → 214–217 ms | ≈1.0× / ≈1.0× |

On this laptop, run-to-run noise is about ±0.3 ms; the unchanged tag path moved by that much.
- **Relationship and entity paths:** the ratios dropped for the ones that changed.
- **Field point writes:** a single-write transaction now issues 5 statements for an insert and 7
  for an upsert, up from 4 and 6, because the stored row is read back. The per-call
  `SAVEPOINT`/`RELEASE` pair is gone, so round trips fell from 6 and 8 to 5 and 7. Several writes
  in one transaction now share the three commit statements instead of each inserting a header.
- **Field benchmark:** its statement assertions were updated to these counts.

These remain diagnostics, not the API latency gate.

## Design corrections from the second review — 2026-10-07

A second review pass changed three capture decisions and fixed defects in the newer code. Capture
remains unregistered in production, and no indexing schedule changed.

### Entity FQN rewrites record one prefix fact

`EntityMutationCapture` now runs the DAO's own single-statement `updateFqnInternal` and buffers one
`EntityPrefixMutation` (entity type, old prefix, new prefix). It no longer locks, rewrites and
journals descendants 100 at a time. `EntityFqnMutationCapture` and the locked prefix-page query
are removed.

- **Enumerating members:**
  [`EntityPrefixMembers`](../../openmetadata-service/src/main/java/org/openmetadata/service/projection/EntityPrefixMembers.java)
  pages the committed members of a prefix fact by keyset over the hash index, one bounded index
  range per page, and derives each member's former locator. The set is a superset: rows already
  under the new prefix are included, and expansion refreshes by ID.
- **Owner lookup:** `ProjectionOwnerLookup` first resolves an old hash through any later prefix
  facts, then runs its usual lookup. Each hop only applies facts with a higher ID, so repeated
  renames terminate. Its history branches now read entity facts only.
- **Retention:** prefix facts are retained, like rename anchors.

The earlier design kept per-descendant facts because prefix strings "cannot recover identities
deleted or renamed again before expansion". The other facts already cover those cases:
- A descendant deleted before expansion records its own `DELETE` fact by ID.
- A subtree renamed again records its own prefix fact.
- Old names resolve through the prefix-fact chain.

The 10,000-descendant / 20,000-row diagnostic, timings excluding seeding:

| Database | Baseline | Captured, previous design | Captured now | Captured statements |
|---|---:|---:|---:|---:|
| MySQL | 209 ms | 2,408 ms | 198 ms | 3 (was 321) |
| PostgreSQL | 320 ms | 2,502 ms | 299 ms | 3 (was 321) |

These are single local samples. The captured cost is now the rewrite plus one fact and its
consumers.

### Point membership writes buffer their rows

Relationship `insert`, `bulkInsertTo`, tag `applyTag` and tag batch application name every row
they write. Their capture now runs the source statement unchanged and buffers the membership row
taken from the call's arguments in the existing pre-commit buffer
([`BufferedMembership`](../../openmetadata-service/src/main/java/org/openmetadata/service/projection/BufferedMembership.java)).
At commit, the buffer inserts one header per membership kind for the whole transaction, all
snapshot rows in multi-row statements, and the consumer rows. The previous path paid, per call:
- a guard upsert;
- an immediate header insert with generated keys;
- before/after snapshot reads;
- a `SAVEPOINT`/`RELEASE` pair.

Some upserts keep the guarded before/after path in
[`RelationshipUpsertCapture`](../../openmetadata-service/src/main/java/org/openmetadata/service/projection/RelationshipUpsertCapture.java),
because their former row can carry a dependency the arguments do not name:
- **Lineage** (`UPSTREAM`), or any JSON naming a pipeline: the old pipeline must be invalidated.
- **Ontology upserts:** relationship and type IDs.
- **Metric-group membership:** MySQL resolves it through a secondary unique key to a different row.

The first attempt also buffered these. It failed `lineageUpdateRetainsOldAndNewPipelineIdentifiers`,
the secondary-unique-conflict test and the ontology replacement test, which is why the routing exists.

A failed point-write capture can no longer be undone by a per-call savepoint. A failed buffer flush
therefore poisons the transaction: commit fails until rollback, so a caller that catches the error
cannot commit half-captured. A point write's capture failure now fails the commit instead of the
statement, which matches uncaptured PostgreSQL behavior. The affected recovery tests were rewritten
to assert this contract, and `caughtSpillFailurePoisonsTheTransaction` covers the poison path.

One relationship upsert per transaction now issues 4 statements instead of 6, and no savepoints.
In a multi-write transaction it is one statement per write plus three per kind at commit. Local
p50 timings from the opt-in diagnostics (single local samples on a loaded laptop; the
entity baseline itself moved from 0.5 to 0.9 ms between runs) measured one write per transaction:

| Write path | PostgreSQL baseline → captured | MySQL baseline → captured |
|---|---:|---:|
| Relationship upsert, buffered (`HAS`) | 0.44 → 1.11 ms | 0.81 → 2.10 ms |
| Relationship upsert, guarded (`UPSTREAM`, unchanged path) | 0.38 → 1.28 ms | 0.76 → 3.60 ms |
| Tag application, buffered | 0.60 → 1.02 ms (was 0.52 → 1.10) | 1.70 → 3.07 ms (was 1.83 → 3.94) |

Single-write transactions understate the gain, because the three commit statements are shared by
every point write in a transaction. These are diagnostics, not the API latency gate.

### Retention discards facts that retire no locator

A completed entity fact that records no former name is now discarded: an insert, an unchanged-name
update, or a delete of a missing row. The entity's current row resolves its name, and any later
rename, delete or prefix rewrite records its own former locator. Anchors are kept for renames,
deletes of named rows and prefix rewrites. Previously the last fact of every entity ever written
stayed in the journal, and every retention pass rescanned it.

### Defects fixed

- **Tag prefix renames (live behavior, present at `HEAD`).** `updateTagPrefixInternal` and
  `updateTargetFQNHashPrefixInternal` used `REPLACE`, which rewrote every occurrence of the prefix.
  `Sales.PreSales.Leads` became `Revenue.PreRevenue.Leads` while its hash kept `PreSales`. Repeated
  target segments, such as service and database both named `SNOWFLAKE`, corrupted target hashes the
  same way. Both statements now rewrite only the leading prefix. A regression test covers both
  captured and uncaptured DAOs.
- **Error masking on a failed commit.** `ProjectionCaptureConnection` closed the JDBC connection
  when rollback failed during commit. JDBI's auto-commit restore then failed on the closed
  connection, and that error replaced the original one, hiding deadlocks from `DeadlockRetry`. The
  connection is now left to the pool.
- **Stale savepoints.** Releasing a savepoint left later savepoints in the capture's checkpoint list;
  both databases release them too. That could exhaust the 64-savepoint cap.
- **Untyped search retries.** Five search updates enqueued retries without an entity type, which
  makes the retry worker probe every type to resolve them: field updates, certification, page-parent
  removal, test-result status and the test-suite `postCreate`. `TestSuiteRepository.postCreate` also
  wrote to the canonical index instead of the staged write target during a reindex.
- **Second scan on extension removal.** MySQL cross-entity extension removal now drives its delete
  from the retained owners (`STRAIGHT_JOIN`, primary-key lookups) instead of a second full scan of
  `entity_extension`.
- **Unused index.** The `(createdAt, id)` index on `metadata_projection_mutation` was unused; it is
  removed from the unreleased `2.2.0` schema.
- **Style.** Flagged page sizes and limits are now named constants.

### Second-review verification

- **Unit tests:** **249 passed**. They cover projection contracts, the connection, buffer and
  retention units, and the search repository behavior tests, including the typed-retry
  verifications.
- **Integration tests:** the complete capture suite on MySQL and PostgreSQL, ran **344 tests, 0
  failures, 5 skipped** (opt-in timing diagnostics and MySQL-only cases). It covers:
  - `EntityFqnRewriteIT`, rewritten for the prefix-fact contract: one rewrite statement and one fact
    for 205 descendants, member paging with derived former locators, concurrent pre-rewrite inserts,
    unique-conflict and caught-failure rollback, buffered-fact rollback, and journal failure.
  - Chained-rename owner lookup after deletion; prefix facts are not owners.
  - Retention of prefix facts and the new no-former-locator rule.
  - The leading-prefix tag rename, with and without capture.
  - Buffered relationship/tag capture, the guarded lineage/ontology/metric-group paths, poisoned
    spills, commit-time capture failure, deadlock replay with one header per transaction, and
    repository boundaries.
- **Benchmarks:** the opt-in benchmarks ran separately (see above).
- **Formatting:** `spotless:apply`/`spotless:check` passed for both Java modules.
- **Build:** Maven used the isolated repository `/tmp/openmetadata-projection-review-m2`.
- **Logs:** `/tmp/reviewer-final-unit.log`, `/tmp/reviewer-final-it.log` and
  `/tmp/reviewer-final-bench.log`.

### Still open from this review

> The [third pass](#remaining-review-items--2026-10-07-third-pass) closed most of these. What remains:
> - the effects of a caller-owned transaction publish before it commits;
> - set-based headers;
> - commits that bypass `Connection.commit` (documented);
> - text rewriting of container JSON.

- **Guarded paths.** Lineage, ontology and metric-group upserts keep the guarded path: about six
  statements and a savepoint each. Its PostgreSQL guard still rewrites the existing row
  (`DO UPDATE SET fromId = fromId`).
- **Per-call headers.** Field-relationship and extension point writes, and every destructive or
  set-based membership statement, still insert a header per call; destructive ones need it before
  their rows disappear.
- **Before-image reads.** Entity updates still read a before-image.
- **Retention scans.** Retention still rescans the retained anchors on every pass, though they are
  now only renames, deletes and prefix facts.
- **Implicit commits.** Commits that bypass `Connection.commit`, such as DDL or a raw `COMMIT`, are
  still not guarded.
- **Nested boundaries.** A raw `inTransaction` around a repository flush is not detected as a nested
  boundary. This exists at `HEAD`.
- **JSON rewrite reach.** On PostgreSQL, and for MySQL containers, the JSON prefix rewrite can also
  change other entities' references that share the prefix. This exists at `HEAD`.

## Review corrections — 2026-10-07

The review correctly identified activation blockers and regressions. This pass addresses the
following, with verification recorded below when complete:

- Consolidate the five **unshipped** projection migrations into the unreleased 2.2.0
  schema, for both databases. Create the final nullable membership facts, locator hashes and indexes
  directly; remove the `locatorHashesReady` column, upgrade indexes and owner-lookup backfill.
  This is not a rewrite of a shipped release migration.
- Keep RDF degradation on single-entity live delivery. Rebuild batch failures still throw, but the
  rebuild's retry and health accounting owns their outcome.
- Narrow MySQL relationship upsert fallback to its actual unique keys: `relationshipId` and the
  generated `metricGroupMetricId`. PostgreSQL rejects unrelated unique conflicts as before.
- Reject unsupported SQL update/batch/call methods and mutation queries on enrolled DAO families,
  including overrides. The exclusion list names nonprojected task-sequence writes; the existing
  pre-1.1 tag-hash migration exclusion remains explicit. Unsupported overrides of FQN rewrites fail
  closed with capture installed. Unreviewed CTE queries also fail closed, because PostgreSQL permits
  data-changing CTEs; existing metric hierarchy reads are explicitly allowed. The typed FQN adapter
  described below now covers the inherited prefix rewrite; specialized DAO writes still block
  production registration.
- Keep entity before-image reads in the source transaction, execute the source statement, and only
  then journal successful conditional writes. A capture savepoint also isolates a caught statement
  failure from the rest of an enclosing transaction.
- Route feed relationship cleanup through `EntityRelationshipDAO`. Move the pipeline status raw
  JDBC batch into the time-series DAO on the repository's DAO root. This removes the raw bypass;
  time-series capture itself remains pending.
- Lock only consumer rows when claiming expansion work, so search and RDF can claim independently.
- Carry the entity type through the search update adapters into retries. A partial live write to a
  staged index reloads the complete projection fields before writing, preventing an empty staged
  document from generating an avoidable partial-update retry.
- Use real source-table migration DDL in SQL fixtures, including generated keys, collations and
  indexes. Share one container per backend per test JVM, retain separate fixture databases, and
  respect the lane's `databaseType`. Timing diagnostics require
  `-Dprojection.capture.benchmark=true`; ordinary CI keeps deterministic correctness checks.
- Exercise the actual paginated reindex reader and bulk sink for live/rebuild parity, assert concrete
  expected values, and cover PATCH field preservation/removal and empty staged targets.
- Remove unused `SearchRepository` forwarding methods, reuse document builders, share retry field
  selection with the reindex path, and reduce expected field-validation logging to DEBUG.

**Still blocking activation:** measured capture cost for the remaining guarded and set-based
membership paths (lineage, ontology and metric-group upserts; field-relationship and extension
point writes; destructive selections) and entity before-image reads; final
historical-locator/generation retirement and maintenance scheduling;
time-series/specialized capture and extension-owner expansion; repository-owned dependency expansion;
durable delivery and version fences; shared cross-replica rebuild routing and barriers; RDF reconstruction
from current state; crash-after-commit recovery through that service; load/SLO gates.
The changes above do not make it safe to remove either scheduled rebuild yet.

**Live behavior changes included in this branch:** parameterized transactional tag rename, corrected
field prefix rename, partial-update field removal/follower/vote/custom-property fixes, and staged
partial-write hydration. This continuation also parameterizes descendant FQN rewrites and fixes
repeated-prefix hash corruption: only the leading hash prefix changes, matching the JSON locator.
These must be named in the eventual PR description rather than presented
as a behavior-neutral refactor.

### Review-fix verification

- Regression tests first reproduced the bulk RDF health regression, phantom facts after rejected
  compare-and-swap, caught statement failures damaging an enclosing transaction, broad relationship
  conflict retention, conflicting SEARCH/RDF claims, and the empty staged-document failure.
  The unreviewed data-changing CTE test also failed before its policy fix.
- The broad service unit selection passed **345 tests**. The final focused capture-policy and RDF
  health/batching selection passed **70 tests**, including the additional CTE rejection/read checks.
  These selections overlap and are not an aggregate test count.
- Focused SQL regression tests passed **105 tests across MySQL and PostgreSQL**. They cover the
  actual generated relationship unique key, caught failures/savepoints, conditional writes and
  independently claimable target consumers.
- The first broad MySQL/Elasticsearch run exposed test-fixture errors against the real schema
  (missing mandatory tag columns and an incorrectly shaped parameter source) and a test querying
  an analyzed `id` field. After correcting those fixtures and using direct document GET for the
  staged assertion, all **26 tests** in the affected three classes passed. The remaining broad-run
  cases had already passed or were intentionally skipped.
- PostgreSQL/OpenSearch with Redis and Jena enabled passed **194 tests**, with **four expected
  skips** (two opt-in timing diagnostics, the MySQL-only unique-conflict case and the cache-disabled
  deadlock scenario). This includes all selected capture/store fixtures, pipeline bulk status APIs,
  PATCH preservation/removal, the real reindex reader/sink, staged partial writes, RDF rebuild/live
  recovery and existing repository transaction boundaries. Those boundary tests still do not
  establish capture-through-runner or crash-after-commit delivery guarantees.
- Maven used an isolated local snapshot repository for this worktree because another worktree was
  replacing shared snapshot artifacts. No build configuration was changed. Execution logs are
  `/tmp/projection-review-all-unit.log`, `/tmp/projection-review-policy-green.log`,
  `/tmp/projection-review-sql-green.log`, `/tmp/projection-review-mysql-corrections.log` and
  `/tmp/projection-review-postgres.log`.
- Combined JaCoCo reports match the compiled classes. Line coverage includes `CaptureWritePolicy`
  **95.5%**, `EntityMutationCapture` **98.9%**, `RelationshipUpsertCapture` **90.3%**, all three
  membership capture decorators **100%**, `ProjectionJournal` **97.9%**, `ProjectionWorkStore`
  **98.9%**, `ProjectionOwnerLookup` **100%**, `SearchDocumentBuilder` **100%**,
  `SearchProjectionFields` **93.3%**, `SearchDocumentContextLoader` **93.5%** and
  `RdfEntityProjection` **97.9%**. Coverage measures the exercised foundation, not completion of
  the unimplemented projection service.
- `mvn -B -pl openmetadata-service,openmetadata-integration-tests spotless:apply spotless:check`
  and `git diff --check` passed.

Production latency and sustained throughput were **not** established by these correctness tests.
The following pass implements bounded buffering and conservative retention. Representative load
gates remain mandatory before capture registration or schedule removal.

## Capture batching and retention — 2026-10-07

Implemented a JDBC-scoped, bounded pre-commit buffer in
`projection/ProjectionCapturePlugin`, `ProjectionCaptureConnection` and `ProjectionCaptureBuffer`.
Entity facts and all consumer rows are buffered up to 1,000 entries or approximately 1 MiB before
spilling. Membership headers remain immediate because retained SQL snapshots require their
foreign-key identities before a destructive write. Savepoint rollback restores buffered facts even
after a later append caused a spill; pre-commit capture failure aborts the SQL transaction before
JDBI restores autocommit. The buffer follows the actual JDBC connection across SQL-object extension
contexts, with no new ThreadLocal or global cache. Installation remains explicit in fixtures.

`RetainedMembershipWriter` replaces per-100-row source mutations with SQL joins against the captured
keys, shared by relationship, tag and field capture. Nullable legacy tag keys are handled separately
on PostgreSQL so ordinary joins use equality. Tag/field hashes already share the source's ASCII
collation. MySQL relationship keys use a JSON string round-trip to give retained values literal
coercibility, so the indexed source column's collation wins, including legacy Unicode collations.
Capturing the affected set still requires
O(affected rows) database work and locks; fewer round trips do not remove that cost.

`ProjectionJournalRetention` scans at most 100 journal rows per transaction and accepts a deletion
budget of 4–1,000 total rows. It age-gates facts and requires every captured target's expansion to be
complete. Snapshot children are deleted in bounded batches before consumers and parents; unfinished
cleanup resumes after restart. Pending delivery and revision/tombstone rows stay in
`ProjectionWorkStore`. Entity compaction requires a higher-ID committed fact for the same identity
that preserves every nonnull before/after locator. Increasing anchors make compaction acyclic under
competing sweepers. This preserves historical owner lookup while compacting repeated updates. Final
identity/name anchors remain until a dependency-lifetime protocol can retire them safely. Each sweep
wraps to zero to revisit late commits and skipped locks. Scheduling belongs to the pending manager.

Verification for this pass:

- The buffering and large-deletion tests first reproduced premature journal visibility and 61
  source deletes for 6,005 associations. Retention tests also failed against an empty implementation.
- **81 service unit tests passed.** The broad capture regression selection ran **200 SQL tests**
  across both databases: **199 passed, one opt-in timing case skipped**. The retention, journal,
  work-store and owner-lookup selection passed **68 SQL tests**.
- After the indexed-comparison correction, **52** query-plan, large-deletion, tag recovery and
  buffer checks passed. The strengthened repository test initially expected one upsert snapshot;
  its before/after assertion was corrected, and all **12** repository cases passed on rerun.
  These selections overlap; they are not an aggregate count of unique tests.
- Twenty separate entity DAO inserts share one journal insert and one consumer insert at commit.
  Tests exercise count/byte-limit spills, JDBC implicit commit, savepoint restoration after a spill,
  caught capture failure and separate connections on the same thread.
- Twelve SQL cases use the actual repository runner on both databases: nested boundary orderings,
  commit/rollback publication, a retained DAO root different from the global root, and replay after
  a pre-commit SQL-state deadlock injection. Replay now combines entity, relationship, tag and field
  writes through nested repository boundaries, asserts that only the final attempt's identities
  survive in source/snapshot/journal rows, and checks one consumer insert per attempt. This tests
  real SQL rollback and runner replay; it is not a native database lock-cycle benchmark or
  end-to-end crash-after-commit delivery test.
- Retention tests cover both target consumers, leased/missing consumers, all three snapshot tables,
  row budgets, restart, age, unknown formats, rollback after parent deletion, overlapping sweepers,
  late commits and historical owner lookup after rename/deletion. Pending and completed work rows
  retain their delivery/revision state.
- JaCoCo line coverage: buffer **95.7%**, connection boundary **98.8%**, plugin **90.9%**, shared
  membership writer **100%**, retention **98.9%**, journal **98.1%**. All modified capture adapters
  and transaction helpers exceed 90% in the focused runs.
- Logs: `/tmp/projection-batching-sql-3.log`, `/tmp/projection-retention-build.log`,
  `/tmp/projection-retention-sql.log`, `/tmp/projection-batching-final-sql.log`,
  `/tmp/projection-batching-runner-final.log`, `/tmp/projection-batching-final-coverage.log`.
- Final `spotless:apply spotless:check` passed for service and integration tests, and
  `git diff --check` passed. The final integration sources compile successfully.

The first 100,000-tag diagnostic exposed a MySQL query-plan regression: casting retained keys to
binary reduced the source lookup to its `source` prefix, scanning the tag table repeatedly. The
test's runaway query was cancelled. The writer now preserves indexed source comparisons, and a
deterministic query-plan regression checks both hash families and Unicode relationship subtypes
under current and legacy collations. The opt-in large test checks the plan before executing the
delete. This is why constant statement counts alone are not sufficient performance evidence.

The rerun verified all four MySQL plan cases and completed the large delete on both engines. One
local 100,000-association deletion (110,000 initial rows, timing excludes EXPLAIN) measured:

| Database | Existing delete | Delete with capture | JDBI statements with capture |
|---|---:|---:|---:|
| PostgreSQL | 245 ms | 1,872 ms | 5 |
| MySQL | 20,288 ms | 32,923 ms | 4 |

These are single local diagnostic samples, **not API p95/p99 or a production performance pass**.
Both paths retain a material fan-out cost. Single-row timing diagnostics also show capture overhead;
batching does not remove the cost of creating durable facts or preserving deleted membership.
Further capture-cost reduction and representative load/latency validation remain mandatory before
activation. The benchmark records both the baseline and captured result, and its seed setup uses
bounded multirow inserts outside the measurement.

Docker stopped during the first rerun with `no space left on device` and database I/O failures.
The engine was restarted after disk space recovered; no database volumes or unrelated files were
removed. The interrupted selection is not counted as a successful run. Corrected query-plan fixtures
refresh source statistics and assert the actual point-delete contract. The recovered run passed the
plan, 100,000-row, tag deletion/recovery and buffer tests; the repository test separately verifies the
two snapshots required by relationship upsert (before and after), not one snapshot per edge.

## Atomic deletion and extension capture — 2026-10-07

PostgreSQL selected deletes now use one data-changing CTE to retain the rows actually deleted.
`DeletedMembershipCapture` shares this operation across tag usage, entity relationships and field
relationships, including joined relationship deletes. It preserves the DAO's selection predicate
and returns only compact dependency columns. Source deletion and retention either both succeed or
both roll back. Updates/renames, explicit tag delete batches and MySQL retain their existing
locked-key path. This removes the PostgreSQL second lookup of every selected source key; it does
not remove the need to persist affected membership.

The regression first reproduced five statements for a PostgreSQL tag delete. It now uses three
(header, atomic delete/retention, consumer registration); MySQL remains at four. The 100,000-tag
diagnostic measured PostgreSQL **325 ms baseline / 721 ms captured**, and MySQL **21,921 ms baseline /
36,814 ms captured**, excluding EXPLAIN. PostgreSQL's earlier captured sample was 1,872 ms.
These are separate local samples, not a controlled production comparison or an API latency pass.
MySQL's material capture overhead remains an activation blocker. The benchmark now explains the
actual bound statement on both engines.

`ExtensionMutationCapture` covers every current write in `EntityExtensionDAO`: point writes,
insert batches, bean batches, revision increments, point/all/schema-scoped cleanup and removal
of an extension across entities. Known owner UUIDs join the bounded pre-commit fact buffer without
a before-image query. Twenty separate writes share one journal insert and one consumer insert.
Cross-entity removal retains owner UUIDs in `metadata_projection_extension`, using atomic returning
on PostgreSQL and locked membership on MySQL. No extension JSON is copied into capture. Unknown
writes/overrides fail closed. All extensions, including history, are conservatively captured;
repository input classification and safe history-only exclusions remain future optimizations.

The new fact distinguishes a known UUID from a retained owner page. Owner types and dependent
units must still be resolved during background expansion. Ordinary extension capture is covered;
this does not cover the separate extension time-series DAO, register capture in production, or
implement delivery. The new snapshot table is in both unreleased 2.2.0 schemas and participates
in bounded, child-first retention after both required consumers complete.

The [bulk delivery contract](2026-10-06-database-search-indexing-design.md#bulk-transport-is-the-default)
now explicitly distinguishes per-document revision/outcome tracking from network batching.
Live updates, repairs and rebuilds must use bounded bulk transport with count, byte, concurrency
and age limits. Bulk transport already exists in the app sinks and `updateEntitiesIndex`; the
remaining manager must reuse it and preserve item-level retries and fences. These SQL capture
measurements precede search delivery and are not measurements of one-search-call-per-row.

Verification checkpoints:

- The deletion selection ran 129 SQL cases: 126 passed, two expected timing skips, and one old
  relationship concurrency hook timed out because it waited for a separate DELETE. The hook now
  coordinates after PostgreSQL's combined statement. All 16 cases in that relationship class and
  both 100,000-row diagnostics passed on rerun. Existing tag/field concurrency and caught-failure
  checks pass on both engines, preserving uncaptured late inserts and restoring failed deletes.
- Extension tests first reproduced missing journal obligations for point and cross-entity changes
  on both engines. The first green selection passed 46 SQL cases across extension capture,
  transaction buffering and journal retention. The final selection passed **65 unit tests** and
  **87 SQL cases with one expected timing skip**, including additional extension owner pagination,
  target-independent retention and caught failures after deletion. A further **22 tag mutation and
  rename SQL cases passed** to cover the retained update/batch paths after changing selected deletes.
  These selections overlap earlier runs.
- Combined JaCoCo line coverage is **100%** for the new deletion helper, extension fact, extension
  capture decorator and extension snapshot store; journal retention is **98.9%**. The new SQL
  fixtures use migration DDL, shared per-backend containers and the lane's database selection.
- `spotless:apply spotless:check` passed for service and integration tests. No app schedules or
  production capture registration changed.
- Logs: `/tmp/projection-delete-red.log`, `/tmp/projection-delete-sql.log`,
  `/tmp/projection-delete-benchmark.log`, `/tmp/projection-extension-red.log`,
  `/tmp/projection-extension-sql.log`, `/tmp/projection-extension-final-sql.log`,
  `/tmp/projection-continuation-tag-regression.log`, `/tmp/projection-continuation-coverage-final.log`,
  `/tmp/projection-continuation-format.log`.

## Typed entity FQN rewrites — 2026-10-07

> **Superseded capture design.** The per-page identity capture described below was replaced by a
> single prefix fact; see
> [Design corrections from the second review](#entity-fqn-rewrites-record-one-prefix-fact). The
> shared `FqnPrefixRewrite` SQL, leading-hash rewrite and caller audit below remain current.

`EntityDAO.updateFqn` and the container override now share `FqnPrefixRewrite`: a typed, bound
prefix request and one dialect-specific assignment. The public repository call is unchanged.
The SQL string is no longer assembled from FQN values or parsed by capture. The container DAO
selects nested-column rewriting; ordinary MySQL entity writes retain their root-only behavior,
and PostgreSQL retains its nested JSON behavior. (Superseded: since the third pass, PostgreSQL
`ENTITY` scope is root-only as well.) Quoted segments, apostrophes, backslashes and
Unicode are bound literally. Hash rewriting now changes only the leading prefix; a repeated
prefix later in an FQN must remain unchanged alongside its JSON value.

`EntityFqnMutationCapture` locks at most 100 entity identities/locators, updates exactly those IDs
in one SQL statement and records the resulting locators. It advances by stable entity ID, which
also prevents revisiting rows when the replacement still matches the original prefix. A concurrent
insert outside the retained page cannot be changed by a later broad-predicate UPDATE without a
fact. `EntityLocatorQuery` shares the compact reads with ordinary entity capture. No orchestration
was added to `EntityRepository`, and no entity JSON is copied into the journal. Existing entity
facts and independent search/RDF consumer obligations cover the rewritten owners; repository-owned
dependency expansion must still refresh references embedded elsewhere.

The writer buffers these per-entity facts before commit and uses bulk source writes per page.
This is bounded request memory, not constant request cost or background fan-out: a large rename
still takes O(changed entities) source work and retains locks until the transaction completes.
The local 10,000-descendant / 20,000-source-row diagnostic measured **641 ms baseline / 2,408 ms
captured on MySQL**, and **426 ms / 2,502 ms on PostgreSQL**. The baseline uses one SQL statement;
capture uses 321, including source pages, locator reads and grouped journal/consumer inserts.
These samples do not satisfy the API latency gate. A more efficient retained rewrite scope or
server-side fact insertion should be evaluated before activation, without losing actual changed
identities or old/new locators. Search bulk delivery does not address this source-transaction cost.

The audit found inherited callers in glossary, glossary-term, tag, classification, domain,
data-product and knowledge-page flows, plus the container specialization. There is no other
current `updateFqnInternal` production caller or overriding raw-SQL implementation. This does
not complete the separate audit of specialized entity/time-series methods and migration writers.

Verification:

- The initial regression failed on both databases because capture rejected `updateFqnInternal`.
  The corrected fixture selection passed **54 SQL cases with one expected timing skip**, including
  all existing entity-capture cases. The first attempt exposed test-only registry initialization
  and PostgreSQL seed-cast mistakes; both fixtures were corrected before the passing run.
- A further selection passed **48 SQL cases**, including two opt-in 10,000-row diagnostics,
  22 FQN cases, transaction-buffer recovery and repository boundary checks. These selections
  overlap and are not an aggregate count. The fixtures use actual chart/container migration DDL,
  generated columns, unique keys, indexes and collations on both backends. The schema fixture
  now includes the relevant 1.4.0/1.8.2 indexes and container bootstrap/generated-parent changes.
- FQN checks cover capture enabled/disabled, independent consumers, nested container columns,
  generated parent hashes, exact-root/sibling exclusion, quoted Unicode names, repeated and
  overlapping prefixes, later-page unique conflicts, caught failures, buffer spill, journal failure
  and concurrent insertion. Source updates are asserted to be bulk: 205 descendants require three.
- **68 unit tests passed**. Combined JaCoCo line coverage: `FqnPrefixRewrite`, `EntityLocatorQuery`
  and `EntityMutationCapture` **100%**; `EntityFqnMutationCapture` **93.9%** (the defensive guard for
  a locked entity changing identity was not forced).
- Existing API rename/reparent regressions and the expanded repository deadlock-replay selection
  passed **14 cases on PostgreSQL/OpenSearch and 14 on MySQL/Elasticsearch**, with no failures or
  skips. They assert descendant and embedded search references for glossary/term, classification,
  tag and domain renames, container parent listings, and glossary cascade replay. The repository
  tests also exercise FQN capture during nested boundaries and a pre-commit deadlock through both
  transaction entry points, using a repository-owned DAO root.
- `spotless:apply spotless:check` passed for both Java modules, and `git diff --check` passed.
  Capture remains unregistered in production; no indexing schedules were disabled.
- Logs: `/tmp/projection-fqn-red.log`, `/tmp/projection-fqn-unit.log`,
  `/tmp/projection-fqn-sql-fixed-fixture.log`, `/tmp/projection-fqn-bulk.log`,
  `/tmp/projection-fqn-coverage.log`, `/tmp/projection-fqn-api-postgres.log`,
  `/tmp/projection-fqn-api-mysql.log`, `/tmp/projection-fqn-format.log`.

## Constraints

- Keep domain, glossary, lineage, tag and time-series rules with their owning repositories or
  focused collaborators. Do not add orchestration to `EntityRepository`.
- Preserve synchronous search visibility and the current RDF contract during migration.
- Keep both indexing apps working. Disable recurring rebuilds only after durable capture,
  dependency coverage and recovery pass their release gates.
- Reuse real integration fixtures and consolidate duplicate helpers/tests. Mock external
  boundaries only. Run the Java formatting and coverage checks.

## Ordered work

### 1. Establish and extract the transaction boundary

- [x] Run `OneTransactionFlushAtomicityIT` and `EntityTransactionBoundaryIT` against the baseline.
- [x] Extend `EntityTransactionBoundaryIT` for mixed flush/explicit transactions, rollback and
  post-commit publication. Reuse `it/util/TransactionCounter.java` instead of its duplicate helper.
- [x] Extract transaction execution and deferred-effect coordination from
  `jdbi3/EntityRepository.java` into focused `jdbi3/RepositoryTransactionRunner.java` and
  `jdbi3/RepositorySideEffectScope.java`; keep repository entry methods as delegates.
- [x] Consolidate transaction unit coverage around the extracted boundary, preserving nested
  retry, rollback tracking and request-thread cleanup behavior.
- [x] Move search/lineage delivery recovery into `search/DeferredSearchWrites.java`, retaining
  durable entity locators and checked transport failures from the search engine clients.
- [x] Verify the extracted code on both databases/search engines, Redis cache invalidation and
  existing RDF live recovery before completing this step.

Verification: `mvn test -pl openmetadata-service -Dtest=RepositoryTransactionRunnerTest,RepositorySideEffectScopeTest,RepositoryTransactionContextTest,TransactionRollbackTrackerTest,DeferredSearchWritesTest`
and `mvn test -pl openmetadata-integration-tests -Dtest=OneTransactionFlushAtomicityIT,EntityTransactionBoundaryIT`.
For direct Surefire `test` runs, set `-DdatabaseType=mysql -DsearchType=elasticsearch` or
`-DdatabaseType=postgres -DsearchType=opensearch` explicitly; the named backend profiles configure
Failsafe, while the direct test bootstrap defaults to PostgreSQL/Elasticsearch. Set
`-DcacheProvider=redis` to exercise the cache-specific atomicity test.

### 2. Introduce durable projection work at the persistence boundary

- [x] Add versioned entity facts, independent search/RDF expansion records and work for explicit
  target generations. These are relational rows, not persisted entity JSON snapshots.
- [x] Add focused `ProjectionJournal` and `ProjectionWorkStore` persistence components and new
  `2.2.0` native schema for both databases (consolidated before release). No new orchestration in `EntityRepository`.
- [x] Capture standard `EntityDAO` inserts, updates, compare-and-swap operations, hard deletes and
  their batch variants through `EntityMutationCapture`, on the SQL object's actual handle.
  Autocommit callers receive an enclosing transaction. Old locators are read under row locks;
  facts are persisted after a successful statement in the same transaction/savepoint. Failed
  compare-and-swap writes publish no fact. Batch capture uses bounded multi-row inserts.
- [x] Implement independent expansion claims, atomic dependency pages/cursors, coalesced dirty
  epochs, fresh delivery revisions, conditional acknowledgment and retained uncertain outcomes.
  A SQL lease does not fence a remote request; no delivery worker is enabled by these stores.
- [x] Verify store transactions/recovery, SQL statement bounds and existing RDF regressions;
  measure local transaction capture cost on both databases. Representative API latency/load
  verification remains a separate activation gate.
- [x] Verify relationship capture across point/typed upserts, all declared deletion shapes,
  bulk insertion and inherited/explicit domain moves. Retain membership in SQL and apply source
  deletes/repoints to exactly that set. Preserve both endpoints, relation subtype, ontology IDs
  and old/new lineage pipeline IDs for independent search/RDF expansion.
- [x] Capture current-schema `TagUsageDAO` apply, batch, delete and rename methods. Retain source,
  tag FQN/hash and target hash in SQL; preserve old/new locators for renames and independent
  search/RDF consumers. Tag prefix rewrites now have bound DAO parameters; compound term rename
  is transactional. No projection orchestration was added to `EntityRepository`.
- [x] Add bounded owner lookup using repository-declared current tables plus indexed entity
  mutation history. Nested-field ownership is explicit, name reuse returns all candidate IDs,
  and every newly captured fact includes its hashes. Repository declarations and expansion into
  delivered projection units remain separate work.
- [x] Verify field-relationship capture across inserts, metadata upserts, batch inserts, typed
  deletes, prefix cleanup and exact/prefix renames. Retain both endpoints and relationship metadata
  for independent search/RDF consumers; bound request-side mutation pages.
- [x] Capture current `EntityExtensionDAO` writes and cross-entity removal, preserving owning
  UUIDs without copying payloads. Verify buffering, rollback, concurrent insertion and retention.
- [x] Capture inherited entity FQN prefix rewrites through a typed request, including the
  container specialization, retained identities/locators and atomic bulk pages. Measured rename
  overhead remains an activation blocker.
- [ ] Cover time-series mutations,
  inherited/overridden DAO writes, raw SQL and migration/retention paths.
  Retain affected membership before destructive operations. An entity's old FQN alone does not
  retain the glossary/domain/tag dependency set.
  Bulk destructive capture must cover the actual deleted rows, including concurrent insertions;
  a preimage select followed by a broad predicate delete is not sufficient at `READ COMMITTED`.
- [ ] Track expansion-to-delivery obligations for visibility and rebuild barriers; implement
  safe retention and generation retirement. Expansion completion is not delivery completion.
- [ ] Add the worker and target fencing, then register capture in core startup only after the
  remaining capture, dependency and performance gates pass.

Capture coverage at this checkpoint:

| Persistence entry point | Coverage / remaining work |
| --- | --- |
| `EntityDAO.insert/insertMany/update/updateMany/updateWithVersion/updateIfMatches/delete/deleteByIds` | Decorated on the actual handle; rollback, batching and concurrent insert/delete covered on both databases. An absent delete retains the requested ID. |
| `EntityDAO.updateFqn/updateFqnInternal` | Typed bound rewrite that runs as one statement and buffers one prefix fact. `EntityPrefixMembers` enumerates the members from committed state. `ENTITY` scope is root-only on both databases; containers also rewrite their nested columns. Rollback and concurrency are covered on both databases. A 10,000-descendant rename costs about the same as the uncaptured rewrite. |
| Specialized entity DAOs, including `FeedDAOs` overrides | Pending explicit coverage of task/conversation/custom insert and update methods; overriding a default entry method can bypass the standard captured SQL method. |
| `EntityRelationshipDAO` point/typed insert and delete | Verified: stable endpoint/type facts, relation subtype, ontology relationship/type IDs and old/new lineage pipeline IDs. Includes primary and secondary unique conflicts on both databases. |
| Relationship bulk delete, `bulkUpdateFromIdInternal`, `repointInherited*`, `addInheritedVia`, `removeInheritedVia` | Verified: locked retained membership, bounded source-write pages, independent consumer pages and concurrency/rollback cases. Existing inherited/explicit predicates remain in the DAO. |
| `bulkInsertTo`, `bulkInsertAllToRelationship`, `bulkInsertAllToRelationshipWithExclusions` | Implemented: bounded capture of supplied keys; catalog candidates retained and inserted in SQL with the existing ignore/conflict/exclusion behavior. |
| Feed relationship cleanup | Both task cleanup methods delegate to `EntityRelationshipDAO`; source predicates and retained membership are covered on both backends. |
| `TagUsageDAO` apply, batch, delete and rename methods | Verified retained source/tag/target-hash membership, exact-key destructive writes, before/after rename locators and independent consumers. Owner lookup resolves nested tagged fields across captured entity rename/deletion. Repository source declarations and expansion/delivery integration remain pending. The pre-1.1 `upsertFQNHash` migration is explicitly excluded from current-schema capture. |
| `FieldRelationshipDAO` insert/upsert/delete and prefix changes | Verified transactional endpoint/metadata retention, bounded destructive writes, rollback and concurrency on both databases. Covers joins, pipeline-task owners, custom-property definitions and feed/task links. Repository ownership declarations and expansion/delivery remain pending; legacy raw field rewrites in migrations remain outside this adapter. |
| `EntityExtensionDAO` insert/batch/revision/delete | Known owner UUIDs captured in the commit buffer; cross-entity removal retains owner membership in SQL. All current DAO write shapes, rollback and concurrent removal are covered. Background owner/dependency expansion and explicit history-only exclusions remain pending. |
| `EntityTimeSeriesDAO` and specialized time-series writers | Pending stable record keys, indexed extension coverage and retention deletes. |
| Raw SQL, migration, bulk import and retention paths | Pipeline status batches now use the repository time-series DAO. Remaining raw writers and retention extension hooks still need coverage. |

This is a coverage checklist, not a fallback to the old search index as a source of dependency
membership. None of the pending rows is claimed complete by the entity-capture tests.

### 3. Connect canonical search and RDF strategies

- [x] Extract shared search field declarations, batch context loading, document construction and
  update policies from `SearchRepository` and `ReindexingUtil`. Route all production calls to the
  existing search index mappers through `SearchDocumentBuilder`, including columns and pipeline
  executions. Vector generation and raw child-update scripts retain their existing handlers.
- [ ] Unify coherent field hydration across live, retry and scans. Some index mappers still read
  repositories internally; the extracted builder alone does not establish snapshot consistency.
- [x] Share RDF entity translation and bounded storage delivery across live, recovery and rebuild.
  A translation failure cannot make the combined batch method acknowledge successful delivery.
- [ ] Reuse RDF field declarations and predicate/relationship ownership under the shared manager.
- [ ] Register dependency rules owned by glossary, domain/data-product, tag, lineage and
  time-series repositories; retain destructive-change membership before cleanup.
- [ ] Route live, repair and rebuild through the same preparation/delivery contracts, retaining
  current target fencing and strengthening it where the design requires proof.
- [x] Extend the existing API consistency suite for derived fields, deletion, live/bulk parity and
  recovery of missing documents. Re-run column, glossary/domain, retry, app rebuild and RDF fidelity
  and live-recovery scenarios. Consolidate preparation tests around the extracted components.
- [ ] Add complete dependency-delivery and multi-pod promotion integration scenarios as those
  contracts are implemented; the existing preparation checks do not establish those guarantees.

### 4. Delegate app maintenance and lifecycle

- [ ] Move authoritative execution, job identity, progress and recovery under
  `projection/MetadataProjectionManager.java` with constructor-injected target strategies.
- [ ] Adapt Search Indexing and RDF apps to submit, observe and cancel their mapped core jobs.
  Uninstall cannot purge shared work; search-only maintenance cannot rebuild RDF incidentally.
- [ ] Add a recurring-trigger-only scheduler operation and verify `None` transitions with real
  Quartz state, preserving active and on-demand jobs.
- [ ] Run the failure/load gates before removing routine schedules or changing visibility policy.

## Stage 1 evidence

- Baseline backend reactor build: `mvn -B -pl openmetadata-service -am -DskipTests install` passed.
  Tests were intentionally not executed by this artifact/bootstrap build.
- Baseline transaction integration run: 16 passed; one cache-specific test skipped with cache
  disabled. This run used PostgreSQL/Elasticsearch. Both mixed-boundary rollback cases passed.
- Regression first observed: the explicit transaction entry point failed the new handle-context
  test with `No repository transaction is active`; the original flush handle-identity check passed.
- Final clean service build: 102 unit tests passed, including retry, scope, cache, RDF updater,
  lineage, metric repositories and checked search transport failures. Command:
  ```sh
  mvn -B -pl openmetadata-service -Pstatic-code-analysis \
    -Djacoco-plugin.version=0.8.12 -Dsonar.skip=true \
    -Dtest=RepositoryTransactionRunnerTest,RepositorySideEffectScopeTest,RepositoryTransactionContextTest,TransactionRollbackTrackerTest,DeadlockRetryTest,PostCommitActionQueueTest,DeferredCacheInvalidationTest,RdfUpdaterTest,LineageUtilTest,DeferredSearchWritesTest,MetricRepositoryTest,MetricGroupRepositoryTest \
    clean install
  ```
  The JaCoCo version override is local to verification for Java 21; repository build configuration
  is unchanged. The renamed retry suite uses real JDBI with only its JDBC boundary mocked.
- Transport regression first observed: both checked-`IOException` delivery tests failed against
  a runtime-only catch. The delivery boundary now handles checked transport failures explicitly.
- PostgreSQL/OpenSearch with Redis: 86 integration tests passed, one expected skip for the glossary
  deadlock test that requires `cacheProvider=none`. This includes real Fuseki live recovery, 39
  retry-queue tests, mixed transactions, hard deletion, subtree rollback and selected glossary/domain
  propagation scenarios.
- MySQL/Elasticsearch without Redis: the same selection passed 86 integration tests, with one expected
  skip for Redis-only read-your-write. The glossary deadlock replay case ran and passed here. Together
  the two runs exercised both conditional tests, real SQL transactions and Fuseki recovery.
- Java formatting: `mvn -B -pl openmetadata-service,openmetadata-integration-tests spotless:apply spotless:check`
  passed. `git diff --check` passed; relative links in both design documents resolve.

Combined unit/PostgreSQL integration coverage (JaCoCo):

| Component | Covered lines | Line coverage |
| --- | ---: | ---: |
| `RepositoryTransactionRunner` | 20/20 | 100% |
| `RepositoryTransactionContext` | 18/18 | 100% |
| `RepositorySideEffectScope` | 74/76 | 97.4% |
| `DeferredSearchWrites` | 31/31 | 100% |
| The two changed `EntityRepository` delegates | 3/3 | 100% |

The integration JVM appended coverage for these production classes to the service's
`target/jacoco.exec`; `mvn -B -pl openmetadata-service -Djacoco-plugin.version=0.8.12 jacoco:report`
generated the combined report. The coverage scope above is the extracted classes, transaction
context and changed delegation methods.

Integration selection used for both backend combinations:

```sh
projection_tests='OneTransactionFlushAtomicityIT,EntityTransactionBoundaryIT,EntityHardDeletionAtomicityIT,EntitySubtreeAtomicityIT,SearchIndexRetryQueueIT,RdfLiveProjectionIT,DataProductDomainMigrationIT,DomainRecreateSameNameIT,GlossaryTermResourceIT#test_deleteRecursive+test_renameGlossaryTermPrefixExtension_keepsAssetGlossaryTagInSearch+test_glossaryTermSearchIndexUpdatedWhenGlossaryOwnerChanges+test_glossaryTermSearchIndexUpdatedWhenGlossaryReviewerChanges'
mvn -B -pl openmetadata-integration-tests -DdatabaseType=postgres -DsearchType=opensearch -DcacheProvider=redis "-Dtest=$projection_tests" test
mvn -B -pl openmetadata-integration-tests -DdatabaseType=mysql -DsearchType=elasticsearch -DcacheProvider=none "-Dtest=$projection_tests" test
```

These checks validate the transaction extraction. End-to-end durable capture, multi-replica reindex
fencing, schedule removal and performance gates await the later stages.

## Stage 2 evidence

The SQL foundation is exercised through the real persistence interfaces on MySQL 8.0 and
PostgreSQL 15. Capture is registered only in its isolated integration fixture. Passing these
checks does not enable the manager, establish full mutation coverage or justify schedule removal.

- Selected service regression tests plus `ProjectionContractTest`: **113 passed**. The service
  was installed before running integration tests so they used the current production classes.
- `ProjectionJournalIT`: **20 passed**, covering transaction rollback, late commits with smaller
  allocated IDs, independent target acknowledgments, restart/lease loss, atomic expansion pages,
  retained retry work and bounded claim SQL.
- `EntityMutationCaptureIT`: **26 passed**, covering actual inherited
  DAO writes, attached/on-demand/root handles, old/new locators, compare-and-swap, identifier
  changes, batch rollback, capture failures, SQL statement bounds and a concurrent insert/delete
  after the empty preimage read. The final combined journal/capture/work-store run passed **62**
  integration cases without skips.
- `ProjectionWorkStoreIT`: **16 passed** in its final run, covering dirtying during delivery,
  coalescing, fresh revisions, stale claims, repeated unknown outcomes, target/generation
  independence and atomic page expansion.
- Existing `RdfLiveWriteRecoveryIT` and `RdfBlueGreenRebuildIT`: **48 passed** using both SQL
  databases and real Fuseki. Their duplicated clocks were consolidated into `it/util/MutableClock`.
- Full application startup with `EntityTransactionBoundaryIT,OneTransactionFlushAtomicityIT`:
  PostgreSQL/OpenSearch/Redis and MySQL/Elasticsearch/no-cache each ran **17 tests: 16 passed,
  one expected conditional skip**. Together they execute both the Redis-only test and the
  glossary replay test that requires no cache. This also checks native migrations during startup.
- The first application run failed before test execution because the unrelated S3Proxy fixture
  returned HTTP 401 to its readiness check. The successful runs use the existing Dropwizard
  override `-Ddw.objectStorage.enabled=false`; these transaction tests do not use object storage.
  No fixture, workflow or production configuration was changed to bypass the failure.

Regressions first reproduced and then corrected:

- A claim of 20 facts issued 41 statements. Claim selection now joins the facts and leases the
  selected page in one update: the real SQL test asserts **two statements**.
- MySQL JSON `null` was treated as the FQN instead of falling back to the stored name. The
  preimage expression now distinguishes a string from JSON null on both databases.
- MySQL's default collation merged distinct generation identities. A case-distinct generation
  test failed with zero pending obligations after completing the other generation; exact
  collation on generation/entity-type identity columns preserves independent work.
- A concurrent insert committed after the delete's empty preimage read, and its search/RDF
  expansion completed before the delete executed. Both databases then deleted the row without
  retaining any deletion work. Capture now retains all requested deletion IDs, including absent
  rows; the two-connection regression checks the remaining deletion obligation after commit.

New production-class line coverage from unit and SQL integration JVMs:

| Component | Covered lines | Line coverage |
| --- | ---: | ---: |
| `EntityMutation` | 8/8 | 100% |
| `EntityMutationCapture` | 86/87 | 98.9% |
| `ProjectionJournal` | 124/126 | 98.4% |
| `ProjectionWorkStore` | 87/88 | 98.9% |

Nested records/enums have 100% line coverage. Coverage is a complement to the transaction and
recovery assertions, not evidence of complete dependency or target semantics.
Final `spotless:apply`, `spotless:check`, combined `jacoco:report` and `git diff --check` pass;
all relative links in both design/implementation documents resolve.

### Performance measurements and limits

The capture fixture measures 100 local durable insert transactions after 30 warmups per path.
JSON serialization happens before timing. The baseline executes a raw insert on the same retained
handle; the captured path uses the decorated DAO. These are diagnostic measurements, not an API
benchmark or an acceptance threshold.

| Database | Baseline p50 | Baseline p95 | Captured p50 | Captured p95 |
| --- | ---: | ---: | ---: | ---: |
| PostgreSQL | 1.004 ms | 3.589 ms | 2.884 ms | 12.251 ms |
| MySQL | 1.770 ms | 6.147 ms | 4.191 ms | 10.750 ms |

The final run's measured median increase is about 1.9 ms / 2.4 ms; the preceding run measured
2.2 ms / 2.7 ms. This run-to-run variation is not evidence of a performance improvement.
Capture performs no target I/O or document
building. Multi-row SQL limits 205 entity inserts to at most nine JDBI statements in the fixture;
the journal producer does not contend on per-entity work-head rows. Those structural bounds do
not establish API p95/p99, throughput, WAL/storage cost or performance for destructive fan-out.
Concurrent API/load measurements and large-catalog dependency capture remain required.

### Reproduction

```sh
mvn -B -pl openmetadata-service -Pstatic-code-analysis \
  -Djacoco-plugin.version=0.8.12 -Dsonar.skip=true \
  -Dtest=ProjectionContractTest,RepositoryTransactionRunnerTest,RepositorySideEffectScopeTest,RepositoryTransactionContextTest,TransactionRollbackTrackerTest,DeadlockRetryTest,PostCommitActionQueueTest,DeferredCacheInvalidationTest,RdfUpdaterTest,LineageUtilTest,DeferredSearchWritesTest,MetricRepositoryTest,MetricGroupRepositoryTest install
mvn -B -pl openmetadata-integration-tests -Dskip.embedded.bootstrap=true -DenableRdf=true \
  -Dtest=ProjectionJournalIT,EntityMutationCaptureIT,ProjectionWorkStoreIT,RdfLiveWriteRecoveryIT,RdfBlueGreenRebuildIT test
mvn -B -pl openmetadata-integration-tests -Ddw.objectStorage.enabled=false \
  -DdatabaseType=postgres -DsearchType=opensearch -DcacheProvider=redis \
  -Dtest=EntityTransactionBoundaryIT,OneTransactionFlushAtomicityIT test
mvn -B -pl openmetadata-integration-tests -Ddw.objectStorage.enabled=false \
  -DdatabaseType=mysql -DsearchType=elasticsearch -DcacheProvider=none \
  -Dtest=EntityTransactionBoundaryIT,OneTransactionFlushAtomicityIT test
```

Append JaCoCo coverage from the SQL integration JVM to `openmetadata-service/target/jacoco.exec`
with the locally installed `org.jacoco.agent:0.8.12:runtime` agent and
`includes=org.openmetadata.service.projection.*`, then regenerate `jacoco:report` as above.

## Stage 2 relationship-capture evidence

`RelationshipMutationCapture` now handles the SQL writes declared on `EntityRelationshipDAO`:
point and ontology upserts; list/catalog inserts; point, typed, list, source-filtered and joined
deletes; and bulk/inherited repoints. The adapter retains SQL membership and reuses the DAO's
existing filters and binders. No additional orchestration was added to `EntityRepository`.

The relational protocol now uses `MutationFacts` with entity and relationship variants.
`RelationshipSnapshotStore` owns immutable membership, `RetainedRelationshipWriter` owns bounded
source mutations, `RelationshipUpsertCapture` serializes upserts, and `CaptureTransaction` owns
statement-level atomicity within an enclosing transaction. They have no search/Jena dependencies.
Registration remains limited to integration fixtures. The production manager, delivery and
complete persistence-family coverage are still pending.

Verification on the final production code:

- Service regressions and projection contract tests: **125 passed**. Four additional JDBC and
  annotation-factory failure cases passed in `CaptureBoundaryFailureTest`: **129 unit passes**
  across the two selections, with no skips.
- The complete SQL foundation selection passed **113 integration cases**, with no skips:
  `EntityMutationCaptureIT` (26), `ProjectionJournalIT` (22), `ProjectionWorkStoreIT` (16),
  `RelationshipMutationCaptureIT` (16), `RelationshipBulkCaptureIT` (16),
  `RelationshipCaptureRecoveryIT` (9), and `RelationshipMetadataCaptureIT` (8).
- Full application startup and transaction regressions passed on MySQL/Elasticsearch without
  caching and PostgreSQL/OpenSearch with Redis: **16 passed and one expected conditional skip
  per run**. Together with the SQL selection, this slice has **145 integration passes and two
  conditional skips**. These application runs exercise the existing production delivery paths;
  they do not enable the new capture adapter or qualify its API performance. They use the existing
  `-Ddw.objectStorage.enabled=false` override described above.
- Relationship cases use MySQL 8.0 and PostgreSQL 15 through the real DAO. They cover 6,005-member
  detachment, multi-page repoints, explicit versus inherited assignments, source/exclusion filters,
  ontology replacement and typed deletion, pipeline changes, concurrent insert/delete and
  insert/repoint races, caught capture/page failures and real database deadlock replay.
- Both consumers retain the same dependency membership independently. Search acknowledgment does
  not remove RDF input. These are durable-capture tests, not end-to-end search/SPARQL delivery tests.
- Historical checkpoint, superseded by the 2026-10-07 consolidation: `ProjectionJournalIT` applied the actual `2.1.1` migration, inserts a legacy entity fact, then
  applies `2.1.2` twice and reads old and mixed new fact types without losing pending work.
- Shared `RelationshipCaptureFixture` supplies DAO configuration and real SQL setup across the
  relationship suites. Existing projection journal/capture/work tests use the same migration helper.

Regressions reproduced before their fixes:

1. Relationship deletes and lineage upserts changed the source without any journal work on either
   database. Capture now persists membership and independent consumer obligations in that transaction.
2. A retained-row join failed when MySQL's existing source collation differed from the new table.
   Source deletes/repoints now bind retained primary keys in bounded batches.
3. Closing the handle after a MySQL deadlock let JDBI's isolation-reset exception mask the source
   error. Savepoint cleanup preserves the connection and original failure; the transaction owner
   successfully retries the whole operation. The rollback tracker preserves its first cause.
4. A guard containing only endpoint keys changed MySQL ontology upserts into duplicate-ID errors.
   Guards now derive all inserted columns from the original DAO SQL and retain the actual row
   selected by a secondary unique key. PostgreSQL still rejects conflicts outside its declared
   conflict target, as before capture.

Combined service/SQL integration line coverage:

| Component | Covered lines | Line coverage |
| --- | ---: | ---: |
| `RelationshipMutationCapture` | 66/66 | 100% |
| `RelationshipSnapshotStore` | 60/60 | 100% |
| `RetainedRelationshipWriter` | 56/56 | 100% |
| `RelationshipMutationSql` | 35/35 | 100% |
| `RelationshipUpsertCapture` | 23/24 | 95.8% |
| `CaptureTransaction` | 25/26 | 96.2% |
| `SqlObjectBindings` | 27/29 | 93.1% |
| `ProjectionJournal` | 133/136 | 97.8% |
| `TransactionRollbackTracker` | 13/13 | 100% |

New/changed fact models and nested records have 100% line coverage. The production components
in this slice exceed the 90% requirement. Spotless apply/check, combined JaCoCo report and whitespace
validation pass.

### Relationship capture performance and activation limits

The diagnostic compares the same real DAO on separate isolated databases, with and without capture.
Each path reuses one handle, performs 20 warmups, then measures 100 durable transactions. SQL count
is asserted: a normal point upsert has six JDBI statements with capture versus one without; JDBC
transaction/savepoint control is additional and is included in elapsed time. The tests assert
structural bounds, not a machine-dependent timing threshold.

| Database | Baseline p50 | Baseline p95 | Captured p50 | Captured p95 |
| --- | ---: | ---: | ---: | ---: |
| PostgreSQL | 0.599 ms | 1.565 ms | 1.873 ms | 4.454 ms |
| MySQL | 1.124 ms | 1.541 ms | 5.553 ms | 7.888 ms |

The preceding run measured 0.578/3.250 ms p50 on PostgreSQL and 1.181/5.884 ms on MySQL
(baseline/captured). JVM/database warmup changes these local numbers substantially. They establish
neither zero API overhead nor API p95/p99, throughput or a release performance budget.

Retained source mutations use 100-key pages; consumer reads are capped at 1,000 rows. Candidate
insertion and before/after retention stay in SQL. Large destructive changes still perform O(affected
rows) database work and hold their source locks until commit. Measure high-fan-out request latency,
lock contention and WAL/storage growth before activation. No target calls or document construction
were added to these request paths.

Reproduce the SQL selection after installing the service:

```sh
mvn -B -pl openmetadata-service -Pstatic-code-analysis \
  -Djacoco-plugin.version=0.8.12 -Dsonar.skip=true \
  -Dtest=ProjectionContractTest,RelationshipCaptureContractTest,CaptureBoundaryFailureTest,RepositoryTransactionRunnerTest,RepositorySideEffectScopeTest,RepositoryTransactionContextTest,TransactionRollbackTrackerTest,DeadlockRetryTest,PostCommitActionQueueTest,DeferredCacheInvalidationTest,RdfUpdaterTest,LineageUtilTest,DeferredSearchWritesTest,MetricRepositoryTest,MetricGroupRepositoryTest install
mvn -B -pl openmetadata-integration-tests -Dskip.embedded.bootstrap=true \
  -Dtest=EntityMutationCaptureIT,ProjectionJournalIT,ProjectionWorkStoreIT,RelationshipMutationCaptureIT,RelationshipBulkCaptureIT,RelationshipCaptureRecoveryIT,RelationshipMetadataCaptureIT test
```

The two application regression commands in the preceding reproduction section remain applicable.

The tag-usage and owner-lookup slice below follows this relationship checkpoint. Field relationships,
extension/time-series and specialized/raw writers remain open.
Dependency expansion, delivery receipts, the shared search/RDF manager, remote fencing and
multi-replica generation promotion must pass their own tests before app delegation and schedule
removal. Passing this slice does not close those gates.

## Stage 2 tag capture and owner-lookup evidence

The tag adapter, SQL selection/key helpers and retained snapshot store are focused classes under
`service/projection`. They reuse `CaptureTransaction`, `SqlObjectBindings` and `ProjectionJournal`.
`ClassificationTagDAOs.TagUsageDAO` retains its selection rules and now binds rename parameters
instead of accepting a generated SQL string. Its root/child rename is one transaction even for
standalone callers. No additional code was added to `EntityRepository` in this slice.

Historical checkpoint, superseded by the 2026-10-07 consolidation and removal of backfill: the `2.1.3` migration retained association locators; `2.1.4` adds indexed historical entity hashes
and a readiness marker. `ProjectionOwnerLookup.Source` declares the repository's table, hash column,
entity type and whether nested fields belong to that entity. Candidate lookup uses current catalog
rows plus entity mutation history, pages by UUID and preserves name-reuse candidates. Historical
lookup requires the retained journal; its retention policy must account for all dependent work.
Bounded backfill revisits unfinished rows rather than advancing an allocation-ID watermark.

### Behavior and recovery

- Glossary deletion retains asset and nested-column target hashes independently for search and
  RDF. Completing search expansion leaves RDF's retained membership available.
- Point and batch application preserve insert-ignore/upsert semantics, source, label state,
  metadata and multi-target derived-label filtering. Deletes preserve unrelated classifications,
  certifications and sources. Nullable legacy cleanup rows remain represented; a null or malformed
  locator is not accepted as resolved ownership.
- Exact and prefix renames retain before/after hashes, including quoted dots and apostrophes.
  A child-key conflict rolls back the complete root/child rename. The bound SQL also passes with
  capture disabled, as it will initially run in production.
- Caught capture failures and failures on a later destructive page restore source rows and discard
  partial journal work. A concurrent association inserted after membership selection survives.
- A 6,005-association deletion retained every target. Source writes use 61 pages of at most 100
  keys/300 bound parameters; retained consumers read at most 1,000 rows per page.
- An association retained before table rename/deletion still resolves to that table's UUID.
  Exact-only ownership excludes fields; nested ownership handles quoted name segments. Name reuse
  retains old and replacement IDs without duplicating repeated history. Type boundaries are retained.
- Older unhashed facts block owner resolution until backfilled. Tests cover late commits and an
  older writer deleting a table between readiness checking and lookup; repeatable-read protects
  that lookup's view. Both native migrations are exercised repeatedly on both databases.

### Verification

- **148 unit tests passed**, including 17 new tag/owner contract cases and the existing transaction,
  capture, search/RDF helper and DAO composition regressions.
- **187 distinct SQL integration tests passed** on real MySQL/PostgreSQL. The broad selection passed
  all 171 cases outside `ProjectionOwnerLookupIT`; four owner cases initially exposed a test DAO
  that had not declared its `fqnHash` column. After correcting that fixture, all 14 owner cases and
  both new performance diagnostics passed. No SQL tests were skipped.
- Combined unit/SQL JaCoCo coverage: all new tag and owner-lookup classes **100% line coverage**;
  `ProjectionJournal` **139/142 lines (97.9%)**; all six changed executable DAO lines covered.
  This is not a claim of 100% coverage for the pre-existing DAO interface.
- **52 application regression tests passed**, 26 each on MySQL/Elasticsearch without cache and
  PostgreSQL/OpenSearch with Redis. Each run has one expected cache-configuration skip. Coverage
  includes glossary/tag/classification rename propagation, certification rename, column glossary
  removal, recursive glossary deletion and the existing transaction boundary suites.
- **12 real Fuseki integration tests passed** for canonical tag/glossary links, tier/certification
  triples, column tag removal and bulk tag/glossary add/remove. Across the SQL, application and
  RDF selections, **251 distinct integration executions passed with two conditional skips**.
- Java `spotless:apply`, `spotless:check` and whitespace checks passed.

The direct SQL suites use `TagUsageCaptureFixture` and the existing real migration fixture.
Existing entity/journal tests were extended rather than introducing a second entity test harness.
The app suites exercise the production indexing paths; new capture is still explicitly installed
only in SQL fixtures.

### Performance limits

The point-application diagnostic compares the same attached DAO inside durable transactions,
20 warmups and 100 measured samples per path, with the coverage agent enabled. Point capture adds
three JDBI statements (four versus one), with JDBC transaction/savepoint work included in elapsed
time. Historical hashes use the existing journal insert and add no SQL round trip, but their
hashing and indexes still add work.

| Database | Baseline p50 | Baseline p95 | Captured p50 | Captured p95 |
| --- | ---: | ---: | ---: | ---: |
| PostgreSQL | 2.419 ms | 7.254 ms | 2.770 ms | 9.304 ms |
| MySQL | 2.159 ms | 5.185 ms | 4.442 ms | 6.848 ms |

These local measurements and statement bounds do not establish API p95/p99, throughput or a
zero-overhead guarantee. Large destructive fan-out, lock contention, journal/index growth and
background owner-lookup cost still require representative load tests before activation.

### Reproduction and remaining work

Install the service and run the SQL selection:

```sh
mvn -B -pl openmetadata-service -Pstatic-code-analysis \
  -Djacoco-plugin.version=0.8.12 -Dsonar.skip=true \
  -Dtest=TagUsageCaptureContractTest,ProjectionOwnerLookupContractTest,ProjectionContractTest,RelationshipCaptureContractTest,CaptureBoundaryFailureTest,RepositoryTransactionRunnerTest,RepositorySideEffectScopeTest,RepositoryTransactionContextTest,TransactionRollbackTrackerTest,DeadlockRetryTest,PostCommitActionQueueTest,DeferredCacheInvalidationTest,RdfUpdaterTest,LineageUtilTest,DeferredSearchWritesTest,MetricRepositoryTest,MetricGroupRepositoryTest,CollectionDAOCompositionTest install
mvn -B -pl openmetadata-integration-tests -Dskip.embedded.bootstrap=true \
  -Dtest=TagUsageMutationCaptureIT,TagUsageRenameCaptureIT,TagUsageDeletionCaptureIT,TagUsageCaptureRecoveryIT,TagUsageCapturePerformanceIT,ProjectionOwnerLookupIT,EntityMutationCaptureIT,ProjectionJournalIT,ProjectionWorkStoreIT,RelationshipMutationCaptureIT,RelationshipBulkCaptureIT,RelationshipCaptureRecoveryIT,RelationshipMetadataCaptureIT test
```

Application regression selection and RDF verification:

```sh
projection_api_tests='EntityTransactionBoundaryIT,OneTransactionFlushAtomicityIT,TagResourceIT#test_renameTagPrefixExtension_rewritesAssetTagButNotSibling+test_certificationTagRenamePropagatesToEntityAndSearch+test_bulkRemoveTagFromAssets_dryRunFalse_removes,ClassificationResourceIT#test_renameClassificationPrefixExtension_rewritesChildTagsButNotSibling+test_classificationRename_tagAssetsPreservedInSearch,GlossaryResourceIT#test_renameGlossaryPropagatesToChildTermSearchIndex,GlossaryTermResourceIT#test_renameGlossaryTermPrefixExtension_keepsAssetGlossaryTagInSearch+test_bulkRemoveGlossaryFromAssets_columnAsset_authorizedUser_succeeds+test_moveTermToSameGlossary+test_deleteRecursive'
mvn -B -pl openmetadata-integration-tests -Ddw.objectStorage.enabled=false \
  -DdatabaseType=mysql -DsearchType=elasticsearch -DcacheProvider=none \
  "-Dtest=$projection_api_tests" test
mvn -B -pl openmetadata-integration-tests -Ddw.objectStorage.enabled=false \
  -DdatabaseType=postgres -DsearchType=opensearch -DcacheProvider=redis \
  "-Dtest=$projection_api_tests" test
mvn -B -pl openmetadata-integration-tests -Ddw.objectStorage.enabled=false -DenableRdf=true \
  -DdatabaseType=postgres -DsearchType=opensearch -DcacheProvider=redis \
  -Dtest=RdfTagsTierCertificationIT test
```

At this checkpoint the next persistence family was `FieldRelationshipDAO`; its subsequent capture
work is recorded below. Repository-owned source declarations and complete dependency expansion still need to
connect these primitives to delivery. Entity prefix rewrites, extension/time-series capture and
specialized/raw writers remain open. The raw-write audit also found tag backfills in migration
utilities `v1125`, `v11210` and `v1130`, and field rewrites in `v110`/`v160`; migration/bootstrap
enrollment must account for them. The shared manager, target fencing, multi-replica rebuild
protection, app delegation and schedule removal remain subsequent gates.

## Stage 3 shared production preparation

The extraction moves preparation out of the app helpers and large repositories. It is a production
change, while the durable capture decorators remain inactive. It does not yet make dependency
expansion, remote delivery or rebuild promotion one workflow.

| Responsibility | Shared implementation and callers |
| --- | --- |
| Required search fields | `SearchProjectionFields` uses the configured factory's declarations and repository-supported fields for reference refreshes, retries and app scans. |
| Batched lineage, service style and relationship revision context | `SearchDocumentContextLoader`; `ReindexingUtil` is an adapter. Missing prefetches preserve per-entity fallback; a successful empty prefetch suppresses redundant reads. Supplied revisions are retained. |
| Entity and time-series document construction | `SearchDocumentBuilder` delegates to the existing extensible index factory. Live writes, both engines' bulk/index sinks and processors, retries and manual repair use it. Column and pipeline-execution construction also goes through this builder. |
| Update policy | `SearchDocumentUpdates`, `SearchPartialUpdate` and `SearchDocumentUpdate` own partial eligibility, relationship revision guards, field removal and scripted-upsert parameters. Both engines use one bulk policy selector. Unrecognized field/operation combinations require a complete document. |
| Derived common values | `SearchDocumentFields` supplies vote counts/ranking and description metadata to full builders and partial updates. |
| RDF entity translation and transport batching | `RdfEntityProjection` is shared by `RdfRepository` live, recovery, combined-batch and pretranslated app paths. Count and byte budgets, write modes and per-entity translation attribution remain supported. Combined delivery throws if any entity failed translation. |

Observed drift fixed by regression tests:

- Non-versioned description changes refresh `descriptionStatus` and `descriptionSources`.
- Vote changes refresh `totalVotes` and use the same reduced vote counts as complete documents.
- Follower deletions retain every removed identity. Additions are idempotent, and simultaneous
  additions/removals use separate parameter lists.
- Partial updates reject creation of an incomplete search document. The existing durable retry
  path can then hydrate and deliver the complete database state instead of acknowledging a
  partial upsert as a successful projection. This does not require a second API-side search read.
- Removing custom properties clears the extension and its typed search representation.
- Complete versioned updates explicitly remove deleted fields absent from the new document.
  Deleting one member of a collection does not remove a freshly rebuilt collection. Normalize all
  null parameters before delivery so engine-specific null handling cannot overwrite that removal
  list; this second defect was exposed by the real API deletion test.
- Combined RDF delivery no longer reports success after silently skipping an untranslatable entity.

The extraction does not add target round trips or database reads to the search update path.
Ordinary bulk replacement also avoids deserializing its completed JSON solely to decide whether a
relationship script is necessary. RDF uses one current transport chunk instead of building a list
of all chunks, retaining its existing count/byte limits. These are structural bounds, not evidence
of unchanged API p95/p99 under representative load.

Remaining scope is explicit: dependency propagation still uses existing repository hooks and
search scripts; RDF relationships/lineage and vector generation retain their current ownership
handlers. Legacy document-merge transports also remain to be adapted. Coherent
snapshot hydration, all persistence families, durable dependency expansion, the shared manager,
remote revision fencing, multi-replica promotion, app lifecycle delegation and schedule removal
remain open. A common document builder is not the completed single-path indexing system.

### Shared preparation verification

All counts below are completed test executions with no failed or skipped assertions. The repeated
API selection overlaps the broader selection; these are not counts of unique scenarios.

| Selection | Environment | Result |
| --- | --- | --- |
| Shared preparation, repository, both-engine sinks/processors, retry and RDF unit tests | Java 21; service module | 420 passed |
| API parity, nested columns, domain inheritance, glossary/tag changes, pipeline status, retry and app rebuilds | MySQL 8.3 / Elasticsearch 9.3; cache disabled | 69 passed |
| Final API consistency selection, including missing-document recovery | MySQL 8.3 / Elasticsearch 9.3; cache disabled | 7 passed |
| Same search selection plus RDF batch fields, tags/tier/certification and live restart/recovery | PostgreSQL 15 / OpenSearch 3.4 / Redis 7 / Jena Fuseki | 88 passed |
| API consistency and RDF batch/tag/tier/certification stability rerun with four test workers | PostgreSQL 15 / OpenSearch 3.4 / Redis 7 / Jena Fuseki | 22 passed |

The first PostgreSQL run briefly marked Redis unavailable after command timeouts and recovered
after three successful operations. Its assertions passed, but a fixture-user cleanup was rejected
during that interval. The 22-case rerun with the repository's four-worker test setting had no Redis
availability failures or rejected user deletions. An already-cascaded team returned an expected
404 during cleanup. This is a successful functional/stability rerun, not a passed load gate.

The existing `AsyncSearchIndexConsistencyIT` owns the new API regressions. Pure field/update policy
cases moved out of the large `SearchRepositoryTest` and `SearchRepositoryBehaviorTest`; the old
mock-heavy `ReindexingUtilDocBuildContextTest` is replaced by injected-reader behavior tests in
`SearchDocumentContextLoaderTest`. RDF chunking and live-write fixtures exercise the shared entity
delivery path. No duplicate integration harness was introduced.

New preparation components each have more than 90% line coverage in the combined service/IT
JaCoCo report. This is scoped to the extracted components, not a claim of 90% coverage for every
large legacy repository touched by a delegation change. API p95/p99, sustained throughput, older
supported engine versions and multi-replica promotion still require their own release checks.

| Component | Covered lines |
| --- | --- |
| `SearchDocumentBuilder` | 39/39 (100%) |
| `SearchDocumentContextLoader` | 45/46 (97.8%) |
| `SearchDocumentUpdates` | 103/105 (98.1%) |
| `SearchDocumentUpdate` | 23/23 (100%) |
| `SearchPartialUpdate` | 75/77 (97.4%) |
| `SearchDocumentFields` | 9/9 (100%) |
| `SearchProjectionFields` | 12/12 (100%) |
| `RdfEntityProjection` | 47/48 (97.9%) |

The accumulated coverage file also contains older, mismatched execution data for
`ProjectionJournal$Claim`; that unrelated entry is excluded from these figures. Every component
listed above matches its execution data. `spotless:apply`, `spotless:check` for both changed Java
modules and `git diff --check` passed.

Reproduction, after installing the service and its test JAR:

```sh
shared_unit_tests='SearchDocument*Test,SearchPartialUpdateTest,SearchProjectionFieldsTest,SearchRepository*Test,ReindexingUtil*Test,*EntitiesProcessorTest,*IndexSinkTest,ElasticSearchBulkSinkBehaviorTest,OpenSearchBulkSinkBehaviorTest,RdfRepository*Test,RdfLiveWriteTest,SearchIndexRetry*Test,SearchDocFieldValidationTest,SearchIndexTest'
mvn -B -pl openmetadata-service -Pstatic-code-analysis \
  -Djacoco-plugin.version=0.8.12 -Dsonar.skip=true \
  "-Dtest=$shared_unit_tests" spotless:apply install

shared_search_tests='AsyncSearchIndexConsistencyIT,ColumnSearchIndexIT*,SearchIndexRetryQueueIT,TestSuiteReindexIT,SearchIndexingFieldsParityIT,DomainResourceIT#test_domainAssetAdd_propagatesInheritedDomainToChildTablesInSearch+test_domainAssetRemove_descendantReinheritsFromAncestryInSearch+test_entityDomainChange_doesNotOverAppendToExplicitDescendantInSearch,GlossaryTermResourceIT#test_renameGlossaryTermPrefixExtension_keepsAssetGlossaryTagInSearch+test_bulkRemoveGlossaryFromAssets_columnAsset_authorizedUser_succeeds+test_moveTermToSameGlossary+test_deleteRecursive,TagResourceIT#test_renameTagPrefixExtension_rewritesAssetTagButNotSibling+test_certificationTagRenamePropagatesToEntityAndSearch,PipelineResourceIT#test_pipelineMultipleStatusUpdates+test_pipelineStatusWithTaskTiming_200_OK'
mvn -B -pl openmetadata-integration-tests -Ddw.objectStorage.enabled=false \
  -DdatabaseType=mysql -DsearchType=elasticsearch -DcacheProvider=none \
  "-Dtest=$shared_search_tests" test
mvn -B -pl openmetadata-integration-tests -Ddw.objectStorage.enabled=false -DenableRdf=true \
  -DdatabaseType=postgres -DsearchType=opensearch -DcacheProvider=redis \
  -Djunit.jupiter.execution.parallel.config.strategy=fixed \
  -Djunit.jupiter.execution.parallel.config.fixed.parallelism=4 \
  -Djunit.jupiter.execution.parallel.config.fixed.max-pool-size=4 \
  "-Dtest=$shared_search_tests,RdfBatchFieldsIT,RdfTagsTierCertificationIT,RdfLiveProjectionIT" test
mvn -B -pl openmetadata-service,openmetadata-integration-tests spotless:apply spotless:check
```

Use `ColumnSearchIndexIT*`, including the wildcard, to include its nested test classes. The final
search selection now has 70 cases; the 69-case MySQL run preceded the additional missing-document
regression, which was subsequently verified in the seven-case run. The PostgreSQL run includes all
70 search cases and 18 RDF cases. For combined coverage, pass the same JaCoCo 0.8.12 agent to the
integration JVM with `append=true` and the service module's `target/jacoco.exec` destination.

## Stage 2 field-relationship capture

The next capture slice covers every current write declared by `CoreRelationshipDAOs.FieldRelationshipDAO`.
The audited callers store table/column joins, pipeline-task owners, custom-property definitions,
task mentions and legacy thread links. Canonical lineage remains in `entity_relationship`; field
capture does not replace its dependency rules. The new adapter is still explicitly installed only
by integration fixtures.

`FieldRelationshipMutationCapture` decorates the SQL object's actual handle and reuses
`CaptureTransaction` and `SqlObjectBindings`. `FieldRelationshipSnapshotStore` retains typed
endpoints and metadata in SQL; `RetainedFieldRelationshipWriter` applies destructive changes in
100-key pages. `FieldRelationshipMutationSql` derives selection and rename expressions from the
declared DAO statements, with explicit supported shapes. It does not parse arbitrary caller SQL.
The existing `deleteAllByPrefixInternal` selector still uses its declared `Define`/`BindMap` contract.
No orchestration was added to `EntityRepository`.

The field snapshot table (now consolidated into `2.2.0` for both databases) adds retained membership with a `(mutationId, id)`
page index. A versioned `FIELD_RELATIONSHIPS` fact has independent SEARCH and RDF consumers.
Retention preserves both FQN/hash/type endpoints, relation code, JSON schema and relationship JSON.
These rows are dependency evidence; eventual target adapters must hydrate current database state.
Deletion or acknowledgment by one consumer cannot discard the other consumer's input.

| Write | Capture behavior |
| --- | --- |
| `insert` | Retains the persisted row after the ignore/conflict behavior. An ignored duplicate records existing types/metadata, not rejected input. |
| `upsert` | A no-op conflict update serializes even an initially absent key before reading the preimage. Before/after metadata remain available; the existing DAO still updates only JSON on conflict. |
| `insertMany` | Uses the supplied pre-hashed primary keys, retaining at most 100 keys per statement. Empty input creates no journal rows. |
| Typed `delete` | Retains only rows matching both types and the exact relation; the source primary key remains `(fromFQNHash, toFQNHash, relation)`. |
| Prefix/internal cleanup | Copies and locks the matching rows in SQL, then deletes only retained keys. A matching insert that arrives after selection at `READ COMMITTED` survives for its own capture. |
| Exact/prefix rename | Retains original and final endpoints using the same SQL expressions as the DAO, with bounded source-write pages. Any page or capture failure rolls back the whole intercepted mutation. |

Point and batch inserts also verify the number of retained distinct keys. MySQL `INSERT IGNORE`
can coerce an invalid key into a different stored value; capture must roll that statement back
instead of committing a row missing from the retained set. The regression failed on MySQL before
the guard for both a point insert and a mixed valid/invalid batch. PostgreSQL rejects the same
inputs through its source-table constraint. Duplicate valid keys remain supported.

The initial regression run failed six assertions across MySQL and PostgreSQL: deletion had no
durable obligation, a prefix extension renamed the root twice, and `REPLACE` modified repeated
prefix text inside a suffix. Exact-plus-prefix rename now uses one bound update. It replaces only
the leading segment, respects quoted/Unicode names, and keeps the existing THREAD/IS_ABOUT scope.
The rename fix also applies before capture activation. It changes no REST request/response shape.

Verification uses the existing `RdfTestDatabase` migration runner and real databases. The new
field suites share `FieldRelationshipCaptureTestBase` and one fixture; existing API tests continue
to own joins, task ownership, custom-property and glossary/search regression coverage.

### Field capture verification

| Selection | Environment | Result |
| --- | --- | --- |
| Projection contracts and transaction/deferred-side-effect unit tests | Java 21 | 79 passed |
| All four new field suites plus existing entity/relationship/tag capture, journal and owner lookup | Isolated PostgreSQL 15 and MySQL 8.0 databases | 142 passed, including 50 field cases |
| Existing join, task-owner, custom-property, glossary rename/deletion and search-consistency API cases | MySQL 8.3 / Elasticsearch 9.3; cache disabled | Passed during the broader database/API run |
| API/search consistency, RDF tags/tier/certification and live writer restart, plus field performance cases | PostgreSQL 15 / OpenSearch 3.4 / Redis 7 / Jena Fuseki; four test workers | 36 passed |

The first broad run had two test errors because the new retry test supplied a zero delay, rejected
by the journal's existing contract. The test now uses the shared `MutableClock`, asserts backoff,
advances time without sleeping, and verifies independent retry. Both subsequent SQL and
PostgreSQL/API/RDF selections passed. The final invalid-key guard was then verified in all 142 SQL
cases. Capture remains inactive in the application suites; those verify current API compatibility,
not new end-to-end journal delivery. No Redis availability transition occurred in this run.

The large-fan-out case retains all 6,005 relationships, limits destructive statements to 100 keys
(300 bind parameters), resumes a persisted 1,000-row cursor through a fresh journal instance and
lets RDF continue after SEARCH completes. A 205-row insertion uses six JDBI statements, including
three bounded retention statements. Point insertion uses four statements versus one without
capture; metadata upsert uses six versus one. JDBC transaction/savepoint control is excluded from
these statement counts. Migrations are applied twice by the fixtures to check idempotency.

Final isolated SQL diagnostic, 20 warmups and 100 samples per path with the coverage agent:

| Database / operation | Baseline p50 / p95 (ms) | Captured p50 / p95 (ms) |
| --- | --- | --- |
| PostgreSQL insert | 0.617 / 2.328 | 2.522 / 5.718 |
| PostgreSQL upsert | 0.618 / 1.495 | 2.979 / 6.164 |
| MySQL insert | 1.637 / 2.682 | 4.515 / 8.105 |
| MySQL upsert | 1.836 / 4.764 | 5.829 / 9.703 |

These establish local overhead and structural bounds, not production API p95/p99 or sustainable
throughput. Representative mixed-workload testing and capture batching/optimization still gate
activation. The production rename fix uses one statement in place of the former two statements;
all other new field-capture database work remains disabled in server startup.

Final combined JaCoCo coverage matches the compiled classes, without execution-data mismatch
warnings. Every new field-capture component has 100% line coverage. The changed field DAO defaults
have 18/18 covered lines, and `ProjectionJournal` has 141/144 (97.9%).

| Component | Covered lines |
| --- | --- |
| `FieldRelationshipMutationCapture` | 76/76 |
| `FieldRelationshipSnapshotStore` | 35/35 |
| `FieldRelationshipMutationSql` | 34/34 |
| `RetainedFieldRelationshipWriter` | 13/13 |
| `FieldRelationshipKeys` | 12/12 |
| `FieldRelationshipMutation` | 5/5 |
| Snapshot, endpoint, metadata, key and selection records | 1/1 each |

`spotless:apply`, `spotless:check` on both Java modules and `git diff --check` passed.

Reproduction, with the service and its test JAR installed:

```sh
field_unit_tests='org.openmetadata.service.projection.*Test,RepositoryTransactionRunnerTest,RepositorySideEffectScopeTest,TransactionRollbackTrackerTest,DeferredSearchWritesTest'
mvn -B -pl openmetadata-service -Pstatic-code-analysis \
  -Djacoco-plugin.version=0.8.12 -Dsonar.skip=true \
  "-Dtest=$field_unit_tests" spotless:apply install

field_sql_tests='FieldRelationshipMutationCaptureIT,FieldRelationshipCaptureRecoveryIT,FieldRelationshipRenameCaptureIT,FieldRelationshipCapturePerformanceIT,ProjectionJournalIT,EntityMutationCaptureIT,RelationshipMutationCaptureIT,TagUsageMutationCaptureIT,ProjectionOwnerLookupIT'
mvn -B -pl openmetadata-integration-tests -Dskip.embedded.bootstrap=true \
  -Djunit.jupiter.execution.parallel.config.strategy=fixed \
  -Djunit.jupiter.execution.parallel.config.fixed.parallelism=4 \
  -Djunit.jupiter.execution.parallel.config.fixed.max-pool-size=4 \
  "-Dtest=$field_sql_tests" test

field_api_tests='PipelineResourceIT#test_pipelineTaskWithOwner,TableResourceIT#put_tableJoins_200+put_tableJoinsInvalidColumnName_4xx,TypeResourceIT#test_addCustomPropertyToEntityType+test_updateCustomPropertyDescription+test_addCustomPropertyToTableColumn,GlossaryTermResourceIT#test_renameGlossaryTermPrefixExtension_keepsAssetGlossaryTagInSearch+test_renameGlossaryTermUpdatesConversationEntityLink,AsyncSearchIndexConsistencyIT'
mvn -B -pl openmetadata-integration-tests -Ddw.objectStorage.enabled=false \
  -DdatabaseType=mysql -DsearchType=elasticsearch -DcacheProvider=none \
  "-Dtest=$field_api_tests,GlossaryTermResourceIT#test_deleteRecursive" test
mvn -B -pl openmetadata-integration-tests -Ddw.objectStorage.enabled=false -DenableRdf=true \
  -DdatabaseType=postgres -DsearchType=opensearch -DcacheProvider=redis \
  -Djunit.jupiter.execution.parallel.config.strategy=fixed \
  -Djunit.jupiter.execution.parallel.config.fixed.parallelism=4 \
  -Djunit.jupiter.execution.parallel.config.fixed.max-pool-size=4 \
  "-Dtest=$field_api_tests,FieldRelationshipCapturePerformanceIT,RdfTagsTierCertificationIT,RdfLiveProjectionIT" test
```

`skip.embedded.bootstrap=true` is used only for the SQL fixtures, which start their own databases.
It must be omitted for API/RDF selections. Combined coverage uses a single JaCoCo 0.8.12 execution
file for the service unit JVM and integration JVM, then reports against the matching service classes.

Next capture work: extension and time-series records, entity-prefix changes, specialized DAO
overrides and raw writers. Repository-owned dependency expansion, coherent hydration, the shared
manager, target revision fencing, multi-replica index promotion, retention, app delegation and
representative API load checks still gate startup activation and removal of recurring schedules.
