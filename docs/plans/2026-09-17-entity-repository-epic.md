# EntityRepository Epic — Salvage #33248, Then Decompose Incrementally

**Status:** Proposed
**Date:** 2026-09-17
**Epic issue:** #32946 *Decompose the `EntityRepository` god class* (sub-issue of #32043 *EPIC — Platform stability and performance*)
**Replaces:** PR #33248 (`harshach/split-entity-repo`) and its Collate companion open-metadata/openmetadata-collate#6639 — both closed, branches kept for reference
**Related code:** `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/EntityRepository.java`, `ChartRepository`, `DashboardRepository`, `TableRepository`, `EntityDAO`, `cache/CachedEntityDao`, `util/RequestEntityCache`, `search/SearchClient`, `rdf/RdfIndexingFields`, `openmetadata-integration-tests/src/test/java/org/openmetadata/it/**`

## Overview

`EntityRepository` is a 13,731-line template-method base class that every entity type inherits. PR
#33248 attempted to replace it in one step with 209 composed components across 911 files
(+86k/−33k), with a 161-file Collate companion. The platform review concluded — and this document
adopts — that the restructure **mostly reorganises**: the god class becomes 9 interfaces supplying
207 default methods, total lines go 13.7k → 23k, one-line reads become 7–9 line calls (99 hunks in
`service/resources/**`, 113 more in Collate), 69 updater subclasses gain boilerplate, and the
structural pains that motivated #32946 (diff fused with writes, duplicated import/bulk write paths,
"add a capability = edit 8 places") all survive the move. The PR's own
`docs/entity-repository-unified-design.md` records the same verdict.

**Decision:** close both PRs. Re-land the parts that are unambiguous wins as small, standalone,
backport-friendly PRs off `main`, and run the decomposition itself as an epic — one pain per
sub-issue, one RFC per pain reviewed with the platform team, and every refactor PR checked against a
behaviour recording that does not exist yet.

This plan does not invent a new decomposition. #32946 already carries a six-step incremental plan
(ratchet + golden master → `EntityDiff`/`UpdatePolicy` → `RepositoryDependencies` → aspects →
`WriteContext` pipeline → `UnitOfWork`); this document is the execution wrapper around it.

### Why a big-bang landing was rejected

| Risk | Evidence |
|---|---|
| Nothing pins today's behaviour | No recording of stored JSON, versions, `ChangeDescription`, or `change_event` exists to diff a 1,000-file change against. The PR's own latency gate never closed — its runner failed its own calibration. |
| Cherry-picks to 2.0/1.13 would stop applying | 18 of the last 30 days' commits on `main` touched `EntityRepository.java` itself (out of 700 commits in the window). |
| Two repos must move in lockstep | Collate and every Java extension would have to land the same day; `storeEntity` and `prepare` become public in the process. |
| The diff is not reviewable as one unit | 911 + 161 files, including a repo-wide automated comment reflow (below). |

### The comment reflow — why every salvage port is hunk-level

The branch carries an automated repo-wide comment reflow that **damaged** comments in at least
`PatchEntityTool.java`, `FieldPathUtils.java`, and `EntityUtil.java`, and stripped roughly 800
comment lines from `BaseEntityIT`. Salvage PRs must therefore apply **hunks** taken from
`git diff origin/main...harshach/split-entity-repo -- <file>` by hand. Never `git checkout` a whole
file from the branch, and never cherry-pick a whole commit.

## Baseline measured on `main` (2026-09-17, `03be0fc2555`)

Every number below was measured, not estimated; the command is the definition. These are the
starting constants for the Step-0 ratchet (RFC-0) and the yardstick for each refactor PR.

| Metric | Value | How it was measured |
|---|---|---|
| `EntityRepository.java` physical lines | **13,731** | `wc -l` |
| Distinct `protected` method names (incl. nested `EntityUpdater`) | **140** | the coupling surface subclasses may reach |
| Abstract methods (the declared contract) | **5** | contrast with the 140 above |
| Methods named `*ForImport` | **13** | `grep -oE '[A-Za-z0-9_]+ForImport\('` |
| `ThreadLocal`-typed fields | **3** | `parentCacheForPrepare` (L602), `storedEntityJson` (L604), `DEFERRED_CACHE_INVALIDATIONS` (L3405) |
| `boolean supports*` capability flags | **17** | L536–551 plus `supportsSearch` (L566) |
| `Entity.getCollectionDAO()` call sites in `openmetadata-service/src/main` | **303** | the global service-locator surface |
| Files spelling `EntityRepository<…>.EntityUpdater` | **56** | the cost of `EntityUpdater` being a non-static inner class |
| Test files calling `mockStatic(Entity.class)` | **146** | construction is a service-locator call, so tests must stub the locator |
| Commits touching `EntityRepository.java` in the last 30 days | **18 of 700** | the class is edited roughly every other day |

Anchors used repeatedly below (all verified at `03be0fc2555`): `executeInTransaction(Supplier)`
L5239 (public; `DeadlockRetry` + `DeferralScope`; a nested call joins the enclosing SQL-object
transaction), `flushInOneTransaction(Runnable)` L5215, `fillReadBundle` L1883, `patchChangeSummary`
L4549, `updateOwners` L9607 / `updateOwnersForImport` L9642, `enrichEntitiesForAuth` L11877, and the
delete-all-then-reinsert hazard documented in-line at L6746–6758.

## Salvage inventory

Each row is one PR off `origin/main`. **AS-IS** = apply the branch hunks unchanged; **PORT** =
re-implement the idea against main's classes. Sizes are production lines unless noted. **T1 is a
prerequisite for every SQL-count or commit-count assertion in Groups 2, 3 and 5.**

### Group 1 — real bugs on `main` today (one PR each; 2.0 backport candidates)

| PR | Bug | Target on `main` | Size | Mode |
|---|---|---|---|---|
| **B1** | The Painless tag re-separation script redeclares `def newTags/tier/classTags/glossTags`. When the removal and addition scripts are concatenated the shard fails with "Variable already defined". | `search/SearchClient.java` `TAG_RESEPARATION_SCRIPT` (L109+) | ~11 | AS-IS |
| **B2** | `description.index_options` is `docs`/`freqs` in 5 index mappings, so phrase and Contains queries can never match a description. | `openmetadata-spec/.../elasticsearch/{en,ru}/glossary_term_index_mapping.json`, `{jp,zh}/metric_index_mapping.json`, `zh/api_endpoint_index_mapping.json` + `IndexAnalyzerMappingTest#dataAssetDescriptionsSupportPhraseQueries` | 5 + 25 test | AS-IS — the PR must state the reindex requirement |
| **B3** | RDF indexing silently dropped `tableConstraints`, `profile`, `pipelineStatus`, `usageSummary` (fields owned by dedicated mappers). | `rdf/RdfIndexingFields.java` `DEDICATED_MAPPER_FIELDS` + `RdfIndexingFieldsTest#retainsInputsOfDedicatedRdfMappers`; keep main's `getAllowedFieldsCopy()` | 7 + 17 test | AS-IS |
| **B4** | Chart and Dashboard updaters `deleteTo(...)` every `HAS` relationship and re-insert it **before** checking whether anything changed — so an unrelated description PATCH rewrites every relationship row. `EntityRepository` documents the same hazard in-line at L6746–6758. | `jdbi3/ChartRepository.java` L257–276 and `jdbi3/DashboardRepository.java` L693–711: call `recordListChange` first and return when it reports no change | ~30 + IT | PORT |
| **B5** | `SearchSettingsMergeUtil` resolves `SystemRepository` at class-load time; `CachedEntityDao` evicts the id and name aliases with two separate `DEL`s. | `migration/utils/SearchSettingsMergeUtil.java`, `cache/CachedEntityDao.java` | 7 + 4 (+ `SearchSettingsMigrationIT`, 68) | AS-IS |

#### Already filed — three bugs found by porting #33248's atomicity tests onto `main`

Filed 2026-09-15 against `500d929694` while checking which of the branch's transaction tests pass
unchanged on `main`. These are **not** hunk ports: they are defects in `main` that the ported tests
expose, and each issue carries the reproducer method that was removed from the pinned class because
it fails today. They belong to the same salvage effort and are tracked as sub-issues of #32946.

| Issue | Bug on `main` |
|---|---|
| **#33359** | `bulkSoftDeleteSubtree`/`bulkRestoreSubtree` commit **twice per level** — the version-history batch, then the row-update batch (`persistBulkUpdaters` L7383–7401). A failure after the row `UPDATE` leaves an orphaned version-history row, and neither path has deadlock replay. |
| **#33360** | Hard delete cancels Flowable process instances **before** the enclosing transaction commits (`cleanup` L4988–5044; bulk path `bulkDeleteReferencesAndRows` L7130–7145), so a rollback leaves the entity row alive with its workflow already gone. |
| **#33361** | `DeadlockRetry` covers only the create/update flush (L5161) and `executeInTransaction` (L5244) — a deadlock on the hard-delete `DELETE` propagates as a 500. Separately, a nested `executeInTransaction` replays only the **inner** unit, because with Jdbi 3.37.1 a nested `Handle.inTransaction` just runs the callback. |

#33358 is the companion pin: the subset of `EntityTransactionBoundaryIT`,
`EntityHardDeletionAtomicityIT` and `EntitySubtreeAtomicityIT` that **passes** on `main` today, to be
committed as a regression guard. It is the already-started form of T2/T3 below — **T2/T3 must be
reconciled against #33358 rather than duplicating it.**

### Group 2 — performance (the headline wins)

| PR | What | Target on `main` | Size | Mode |
|---|---|---|---|---|
| **P1** (#33353) | Table + column custom metrics and column extensions: **505 → 5 SQL statements**. `TableRepository.setFields` L212–226 runs two per-column loops and `batchFetchCustomMetrics` L3180–3198 runs a third. | Drop in `entity/types/table/TableMetadataLoader.java` (147 lines; its only dependency is `Supplier<EntityExtensionDAO>`), add `EntityExtensionDAO.getExtensionsByKeys` (+12 in `jdbi3/CoreRelationshipDAOs.java`), rewrite the 3 call sites with `() -> daoCollection.entityExtensionDAO()` | ~160/−45 + 340 test | drop-in class + 3 call-site rewrites |
| **P2** | Column pages resolve owners even when nobody asked for `profile`: a basic column page goes **20 → 0** statements. | `resources/databases/TableResource.java` `getColumnProfileOwners` + both handlers | 13 + 149 test | AS-IS (skip the `lookup().byId` rename hunk) |
| **P3** | `patchChangeSummary` rewrites the entire entity JSON per accepted suggestion — a lost-update window on wide tables. | `EntityRepository.patchChangeSummary` L4549 → `EntityDAO.findSummaryForUpdate` (`JSON_OBJECT`/`jsonb_build_object … FOR UPDATE`) + `updateChangeDescription` (`JSON_SET`/`jsonb_set`) | ~70/−25 | PORT (skip the `EntitySummaryWriter` indirection) |
| **P4** | Auth enrichment fetches owners and domains as two round trips. | `EntityRepository.enrichEntitiesForAuth` L11877 → one `UNION ALL` in `EntityRelationshipDAO.findOwnersAndDomainsBatch` | ~58 | PORT — ids bind twice; the existing 30k chunking stays under the 65,535-parameter limit |
| **P5** | Redis read-bundle is all-or-nothing with a blind `put`, so a concurrent invalidation is clobbered. Adds partial fill, compare-and-swap publish, TTL refresh. | `EntityRepository.getReadBundle`/`fillReadBundle` L1875–1990 against main's `ReadBundle`/`ReadPlan`/`ReadPlanner` | ~160 + 60 rework + 127 test | PORT — **land last**, medium risk |
| **P6** | Bulk cache publication writes one key at a time. Adds `putMany` in 100-key batches. | `cache/CachedEntityDao.java`; caller is the `createManyEntities` write-through | ~58 + 170 test | PORT |
| **P7** | The request-scoped cache serialises the same entity twice — once per alias. One serialization now feeds both the id and name aliases. | `util/RequestEntityCache.java` (`Projection` record) | 57 + 260 test | AS-IS |

### Group 3 — test infrastructure and the transaction tests

The transaction tests are the second headline win: they already caught a real Collate bug (C1)
before this plan existed.

| PR | What | Size | Mode |
|---|---|---|---|
| **T1** | JDBI decorators in `it/util/`: `SqlQueryCounter` (SqlLogger, substring match, calling-thread or `forRequests` scoping), `SqlFailureProbe` (throws once after a matching statement; **add** a `forRequests(jdbi, fragment, failure)` variant scoped on `RequestLatencyContext` so REST-driven tests can use it), `TransactionCounter` (commit/rollback counter, promoted out of an IT inner class) | ~190 | AS-IS + one small extension |
| **T2** (reconcile with #33358) | The transaction tests: `EntityTransactionBoundaryIT` (3 of 5 methods unchanged; the 2 extension methods rewritten via `entityExtensionDAO`), `EntityAssetMembershipIT` (0 edits), `EntityCreateManyIT` (0 edits), `EntityPostCommitRecoveryIT` (1 line → `CacheBundle.invalidateEntity`), `EntityHardDeletionAtomicityIT` (3 call sites → `createInternal`/`deleteInternal`/`bulkHardDeleteSubtree`), `EntityVersionHistoryIT#deletedRemainingRows…` (regression guard for #33016) | ~1,300 test | AS-IS / light rewrite; `@Isolated` wherever a decorator mutates global Jdbi state |
| **T3** (reconcile with #33358) | Second wave, rewritten against main's API: `EntitySubtreeAtomicityIT`, `EntityCsvChangeLogIT`, `KnowledgePageTransactionIT`, `EntityTimeSeriesIT`, `EntityColumnMutationIT`, `EntityBulkUpdateAtomicityIT`, `EntityCacheCommitIT` | ~1,400 test | PORT — use the branch's `OneTransactionFlushAtomicityIT` diff as the API mapping table. **Assertions that encode refactor-only behaviour (e.g. commit counts on unchanged bulk updates) become pains, not tests.** |
| **T4** | Multi-node IT isolation: secondary cluster nodes run in a forked JVM — `it/bootstrap/ForkedTestNode.java` (130), `SessionMultiNodeCluster`, `TestSuiteBootstrap` (`registerAdditionalNode`, `-DdbDurable`), `SessionMultiNodeIsolationIT` | ~200/−40 | AS-IS (drop the `EntityHardDeletionAtomicityIT` hunk and the h2 pom dependency) |
| **T5** | Zero-edit guards worth keeping: `LineageHydratorTest` (100), `DefaultTemplateProvider` decoupling (`Function<String,EmailTemplate>`; callers `EmailUtil:91`, `DocumentRepository:76`) + test (59), `TestCaseResourceIT#test_testCaseSearchIndexUpdatedWhenTableTagIsReplaced` (47), `EntityDeleteTaskCleanupIT#hardDelete_removesOpenTasksAboutContainedEntities` (22), `McpServiceResourceIT#connectionResultInvalidatesBothCachedAliases…` (20), `KnowledgePageResourceIT` (271) | ~520 test | AS-IS |
| **T6** | `scripts/jacoco_class_coverage.py` + its test — a generic per-class 90% coverage gate, not wired into CI | 390 | AS-IS, optional |

### Group 4 — UI / Playwright / ingestion / MCP (independent lanes)

| PR | What | Size |
|---|---|---|
| **U1** | Guided tour skips the real permission fetch for the tour dataset: `useEntityPermissions({enabled: !isTourDataset})`, `mockTablePermission`, `ViewDataProfile: true`, plus the `Tour.spec.ts` step-13 assertion | ~30 |
| **U2** | Playwright flake fixes: `entity-data.setup.ts` (disable the weekly reindex schedule), `KnowledgeGraph.spec.ts` (poll a SPARQL `ASK` before the suite, `try/finally`), `GlobalPageSize.spec.ts`, `LineageFilters.spec.ts` | ~60 |
| **U3** | CI shard capacity `COMMON_MAX_SHARDS` 28 → 32 in `.github/scripts/build_playwright_shards.py` + `.github/scripts/tests/test_playwright_ci_planning.py`. These are scripts, **not** workflow files. | 34 |
| **I1** | `test_validations_datalake.py`: fixture dates relative to `EXECUTION_DATE` + `freeze_time`, so 57 cases stop breaking across midnight UTC. Confirm `freezegun` is in the ingestion test extras. | 18 |
| **M1** | MCP: drop the unused `okhttp3:mockwebserver` dependency; run `IdTokenValidatorTest` on the JDK `HttpServer` | 53 |

### Group 5 — Collate (`open-metadata/openmetadata-collate`, off its `main`)

`collate-integration-tests/pom.xml` already depends on the `openmetadata-integration-tests` test-jar
and `org/openmetadata/it/util/**` is packaged, so the T1 decorators are importable from Collate ITs
as soon as T1 lands on OM `main`. No copies.

| PR | What | Fix against main's API | Tests |
|---|---|---|---|
| **C1** | **The bug the review cites.** Dashboard-chart delete runs `deleteByName` and the dashboard `update` as two autocommits, so a failure between them leaves the dashboard pointing at a deleted chart. | Wrap the body of `DataInsightDashboardRepository.deleteDashboardChart` in `executeInTransaction(...)` | `dashboardChartDeletionSharesTheEnclosingRollback` + `dashboardChartDeletionCommitsOnce`, lifted from the branch's `EntityModuleCompatibilityIT` with the `Entity.getEntityModule(..).lookup()` asserts rewritten to `getEntityRepository(..).get/find`; `TransactionCounter` from T1 |
| **C2** | The Slack "Test details" modal lists every test case with `fields=*` — 57 SQL statements per click. | `SlackComponents.buildTestDetailsModal`: `getEntityByName(type, fqn, getFilteredFields(type,"testSuite"), ALL)` + `listAfter(null, getFields("testCaseResult"), new ListFilter(ALL).addQueryParam("testSuiteId", id), 10, null)`; keep `paging.total` for the count | `SlackComponentsIT` (278; SDK + `SqlQueryCounter`) |
| **C3** | Argo/MinIO dev stack is broken: images pinned to `quay.io/minio/{minio,mc}` by digest, `mc anonymous set` replaces the removed `mc policy set`, `set -Eeuo pipefail` + a diagnostics trap in `setup-argo.sh` | `development/argo-workflows/resources/{init-minio-bucket,minio-deployment}.yaml`, `setup-argo.sh` | `development/argo-workflows/tests/setup-argo.test.sh` (54) |

### Explicitly **not** salvaged

These die with #33248. Listed so nobody re-mines the branch for them later:

- 147 unit-test files (24.4k lines) that test only the new components.
- The 27-file `it/perf/**` latency harness and `scripts/entity_api_{acceptance,benchmark}.py` — the
  runner never passed its own calibration.
- `scripts/entity_repository_size.py` — a net-LOC gate, superseded by the Step-0 ratchet.
- The six `docs/entity-repository-*.md` — mined for the pain list below, not merged.
- `EntityDependentCleanupIT`; every API rename in resources/migrations/MCP tools; the h2 test
  dependency.

Already on `main`, nothing to port: `searchForCompleteExportResponse` (#33079), the version-history
empty-terminal-page cursor fix (#33016), and `LineageHydrator` itself.

## Pain list

Sources: #32946 pains 1–6, the platform review's additions (caching, deletion, bulk), and what
#33248's measurements exposed about `main`. Each row becomes one GitHub sub-issue opening with
`Sub-issue of #32946.` and carrying three sections: **what hurts / root cause / how we know it is
fixed**. Pains 7–9 are largely discharged by the salvage PRs above; the rest are the epic.

Five sub-issues already existed when this plan was written (filed 2026-09-15): #33353 for the P1
read-path N+1, #33358 for the atomicity pin, and #33359/#33360/#33361 for the three `main` bugs its
port uncovered. The rest were opened on 2026-09-17 as #33517–#33527, with #33528 tracking the salvage
PRs. The **Issue** column below is the map.

| # | Pain | Root cause on `main` | Done when | Issue |
|---|---|---|---|---|
| **0** | No behaviour recording — and the base class grows ~110 lines/week | Nothing pins stored JSON, versions, `ChangeDescription`, or `change_event` | Ratchet test + golden master merged (Step 0 / RFC-0) | #33517 · partly #33358 |
| **1** | Diff and apply are fused; versioning and consolidation cannot be tested without a database | `EntityUpdater.updateX` records the change and writes it in one breath; consolidation runs three write passes (~L9017–9500, `updateOwners` L9607, `updateDomains` L9902) | A pure `EntityDiff` + `UpdatePolicy`; `EntityDiffTest` with no mocks; the 13 `*ForImport` names gone (Step 1) | #33518 |
| **2** | The write lifecycle is implicit, so the import and bulk copies drifted | `createManyEntities` skips column extensions and the write-through cache; `updateManyEntitiesForImport` bypasses the updater entirely; Table CSV import is a PATCH path while glossary/testCase import use `*ForImport`. Ten methods, three modes expressed as booleans. | `WriteContext` + ordered `WriteStage` lists; bulk create writes exactly what single create writes (Step 4) | #33519 |
| **3** | Adding one capability touches ~8 places | 17 `supports*` flags plus a hand-wired `fieldSupportMap` | Aspects, Owners first (Step 3) | #33520 |
| **4** | The declared contract is 5 abstract methods; the real coupling surface is 140 protected method names | Template-method base with everything `protected`; `EntityUpdater` is a non-static inner class, so 56 files spell `EntityRepository<X>.EntityUpdater` | Hook budget ratcheted down per PR; the static-updater decision recorded (Step 6) | #33521 |
| **5** | ThreadLocals used as parameters; five post-commit collectors in four classes juggled by `DeferralScope` | `storedEntityJson`, `parentCacheForPrepare`, `DEFERRED_CACHE_INVALIDATIONS`, plus RDF/lineage/search/cache/post-commit collectors | One `UnitOfWork` and one outbox; `RdfIndexHandler` (Step 5) | #33522 |
| **6** | Construction is a service-locator call **with a side effect** | `Entity.registerEntity` runs in the constructor and `Entity.getX()` is called from constructors, so 146 test files `mockStatic(Entity.class)`; constructor failures are swallowed as `LOG.warn` | `RepositoryDependencies` injected through `Entity.initializeRepositories`; registration after construction; constructor failures propagate (Step 2) | #33523 |
| **7** | Transaction ownership gaps | Callers open their own transactions and there is no written "join the enclosing transaction" rule for extensions: metadata cleanup ran outside the owning transaction on unchanged bulk updates; Collate's dashboard-chart delete is two autocommits; per-chunk bulk hard delete is not atomic (#29378) | T2/T3 ITs green on `main`; #29378 closed; the rule written into the extension contract | #33358 (pin) · #33359 · #33360 · #33361 · #29378 |
| **8** | Read-path N+1s | Per-column loops in `TableRepository`; `enrichEntitiesForAuth` as two round trips; per-descendant deletes. Measured: per-column metrics/extensions 505 → 5, column pages 20 → 0, an expanded 100-column read = 207 queries, a 100-column hard delete = 470. | P1/P2/P4 merged **with the SQL-count ITs as permanent guards**; delete counts measured and budgeted | #33353 (P1) · #33524 (P2/P4) |
| **9** | Caching | `fillReadBundle` is all-or-nothing with a blind `put`; `CachedEntityDao` publishes one key at a time; `RequestEntityCache` serialises twice per alias | P5/P6/P7 merged with their ITs | #33525 |
| **10** | Deletion | Cascade loads the entity twice; the lock gate is dormant (`LockManagerInitializer` is never called); no stale-lock reaper; deletion races ingestion (#20891). See `docs/plans/2026-06-22-bulk-deletion-redesign.md` gaps 2–3. | Per-chunk transaction (#29378), lock gate wired, race IT | #29378 · #20891 |
| **11** | Bulk / import | The `sourceHash` fast path has no benchmark baseline; 13 `*ForImport` shadows | Folded into pains 1–2 **after** a benchmark baseline exists | #33526 |
| **12** | The extension API surface leaks internals | No declared extension contract — Collate subclasses reach protected hooks, and #33248 would have made `storeEntity`/`prepare` public | A written extension contract plus a compile check in Collate CI | #33527 |

### Sub-issue drafts

Each sub-issue is opened with `gh issue create`, body starting `Sub-issue of #32946.`, and these
three headings. Pain 7 was **not re-filed** — #33358, #33359, #33360, #33361 and #29378 already
cover it, and #33358's scope is the T2/T3 pin; pain 10 is carried by #29378 and #20891. All the
others are open as of 2026-09-17. Drafts condensed — each issue body expands these with the line
references above:

- **Pain 0 (#33517) — Pin today's behaviour before changing it.** *What hurts:* every refactor PR is reviewed
  by reading, because nothing fails when stored JSON, a version bump, a `ChangeDescription` or a
  `change_event` changes shape. *Root cause:* no golden master, no size/coupling ratchet. *Fixed
  when:* `EntityRepositorySizeBudgetTest` and `EntityRepositoryGoldenMaster*IT` are merged and green
  on both dialects and both search engines.
- **Pain 1 (#33518) — Separate deciding from writing.** *Fixed when:* `EntityDiff` + `UpdatePolicy` are pure
  and `EntityDiffTest` runs with no mocks and no database; consolidation is one decision, not three
  write passes.
- **Pain 2 (#33519) — One write lifecycle.** *Fixed when:* bulk create and single create run the same ordered
  stage list, proven by a golden-master cell that compares a bulk-created table to a
  singly-created one.
- **Pain 3 (#33520) — Capabilities as aspects.** *Fixed when:* adding an Owners-like capability is one
  registration, and the `supports*` flag count in the ratchet has dropped.
- **Pain 4 (#33521) — Shrink the coupling surface.** *Fixed when:* the protected-name budget ratchets down
  every PR and the static-`EntityUpdater` decision is recorded with its Collate cost.
- **Pain 5 (#33522) — One unit of work.** *Fixed when:* the `ThreadLocal` budget is 0 and post-commit work
  goes through a single outbox.
- **Pain 6 (#33523) — Inject dependencies, register afterwards.** *Fixed when:* a repository can be
  constructed in a unit test without `mockStatic(Entity.class)`, and a constructor failure fails
  startup instead of logging a warning.
- **Pain 7 (#33358, #33359, #33360, #33361) — Write the transaction rule down.** *Fixed when:* T2/T3 are green, #29378 is closed, and
  the extension contract states that an extension joins the enclosing transaction.
- **Pain 8 (#33353, #33524) — Read-path N+1s.** *Fixed when:* P1/P2/P4 are merged and their SQL-count ITs guard the
  counts; delete-path counts are measured and budgeted.
- **Pain 9 (#33525) — Caching correctness and batching.** *Fixed when:* P5/P6/P7 are merged with their ITs,
  including the concurrent-invalidation case.
- **Pain 10 (#29378, #20891) — Deletion.** *Fixed when:* #29378 is closed, the lock gate is wired, and a
  deletion-vs-ingestion race IT exists (#20891).
- **Pain 11 (#33526) — Bulk/import baseline.** *Fixed when:* a `sourceHash` benchmark baseline exists; then
  this folds into pains 1–2.
- **Pain 12 (#33527) — Declare the extension contract.** *Fixed when:* the contract is written and Collate CI
  fails on a reach into a non-contract hook.

## Step 0 — the behaviour recording (RFC-0)

Step 0 gates every refactor PR in Wave D and ships as its own document,
`docs/plans/2026-09-17-entity-repository-behaviour-recording.md`, plus one PR carrying both
artifacts. No pom change is required. Summary of the shape:

**Ratchet** — `openmetadata-service/src/test/java/org/openmetadata/service/jdbi3/EntityRepositorySizeBudgetTest.java`,
parsing the source with the JDK `com.sun.source` `JavacTask.parse()` (precedent and module-root
resolution: `openmetadata-service/src/test/java/org/openmetadata/service/rdf/RdfWriterPredicates.java:27-66`).
One `TreeScanner`; five rules, each stated in the Javadoc together with the shell command that
cross-checks it: physical lines, distinct `protected` method names over every class in the
compilation unit (constructors excluded, nested `EntityUpdater`/`ColumnEntityUpdater` included),
distinct `*ForImport` method names, `ThreadLocal`-typed fields, and `boolean supports[A-Z]*` fields.
Budgets on `main` today: **13_731 / 140 / 13 / 3 / 17**. Every metric asserts `actual <= budget`
**and** a shrink lock `actual >= budget - slack` (slack 50 for lines, 0 for the rest) so any PR that
shrinks the class must lower the constant in the same diff. The public-method count is logged as
information, not asserted.

**Golden master** — `it/tests/EntityRepositoryGoldenMasterIT.java` (CONCURRENT, `TestNamespace`,
`assumeFalse(OssTestServer.isExternalMode())`) plus `EntityRepositoryGoldenMasterIsolatedIT.java`
(`@Isolated`, for anything touching `jdbi.setSqlLogger` or `EntityUpdater.setSessionTimeout`).
Support code lives in `it/util/golden/` so it ships in the harness test-jar: `GoldenMaster`
(run/verify/update), `GoldenNormalizer`, `JsonDiff` (path-level — `jsonassert` is not on the IT
module's classpath), `Aliases`, `ChangeEventTap`, `StoredRowTap`, `SearchTap`, and `EntityScript`
with `TableScript`/`GlossaryTermScript`/`UserScript`/`TestCaseScript`. It must **not** extend
`BaseEntityIT` (200 inherited tests, protected helpers); it reuses `SdkClients`, the SDK
`EntityServiceBase`, `BulkApi.upsert`, `CsvJobClient`, the `*TestFactory` classes, and
`TestNamespace.trackRoot`.

Per step, per tracked entity it captures: the input sent; `version`, `changeDescription`,
`incrementalChangeDescription` and `deleted` from the response (not the whole body); the stored row
(`SELECT json FROM <dao.getTableName()> WHERE id`); `/versions` (each carries its own
`changeDescription`); `change_event` rows via `Entity.getChangeEventRepository().list(...)` filtered
by `entityId` and awaited with Awaitility to the step's expected count (the handler is async on a
ForkJoinPool); and a 6-field search projection. Normalisation drops `href`, parses string-encoded
JSON (`entity`, `versions[]`, `oldValue`/`newValue`), sorts object keys but **never** arrays, aliases
every generated name (`${svc}`, `${table}`, … using `ns.shortPrefix` for the service chain to stay
under the 256-character FQN limit), uses named placeholders for shared entities (admin user,
Organization, `PII.Sensitive`, `tableRowCountToEqual`), maps remaining UUIDs to `<uuid-N>` by first
appearance, and maps timestamp keys to `<ts>` including inside escaped JSON — while keeping
`version`, `previousVersion`, `changeSource` and `changedBy`.

Fixtures live at `src/test/resources/golden/entityRepository/<entityType>/<script>.json`, one set for
both dialects and both search engines; a `<script>.<databaseType>.json` override is added only when a
real dialect difference is proven. `-Dgolden.update=true` records; verify writes the actual to
`target/golden-actual/` and fails with the first 40 path diffs plus the re-record command.

Scenario matrix, with the honest cells called out: create / PUT / first PATCH (**never**
consolidates — consolidation requires `original.version > 0.1`) / second PATCH by the same user
(consolidates) / soft delete / restore / hard delete, for Table, GlossaryTerm, User and TestCase;
rename-then-PATCH only for GlossaryTerm (`renameAllowed` is false for Table, User and TestCase);
cascade hard delete for Table (→ TestCase) and GlossaryTerm (→ child); bulk create only for Table
(`PUT /v1/tables/bulk`); CSV import for all four (table name import is a PATCH path, glossary import,
team-scoped `/v1/users/import`, test-suite import). The isolated class adds a REST-driven deadlock
replay (`SqlFailureProbe.forRequests(jdbi, "insert into <table>", 40001/1213)` + `SqlQueryCounter`
asserting two attempts, one version, one event), a consolidating PATCH under an injected deadlock
(the version must not double-bump), and session-window expiry via
`EntityUpdater.setSessionTimeout(-1L)` in `try/finally`. Search invariants are asserted with no
polling immediately after create and after the FQN/displayName-changing step, because indexing is
synchronous post-commit with `refresh=true` today (`SearchIndexHandler.isAsync()` is false).

Size: ~1,900 Java lines plus 17 fixture files (10–15k JSON lines). Record on MySQL/ES; verify on
Postgres/OpenSearch and the Redis lane; record twice and diff to prove determinism.

## Execution order

Salvage branches are cut from `origin/main` in throwaway worktrees
(`git worktree add /tmp/om-salvage/<slug> -b <branch> origin/main`), hunks applied by hand from
`git diff origin/main...harshach/split-entity-repo -- <file>`, then `gh pr create --base main`.
Collate branches likewise off Collate `main`. Collate's `.gitmodules` is untouched throughout.

| Wave | Contents | Gate |
|---|---|---|
| **A** | Epic docs PR (this document) → close #33248 and #6639 → sub-issues + the "Salvage from #33248" tracking issue → **B1, B2, B3, B5, T1, U1, U2, U3, I1, M1** | none — all independent |
| **B** | **P1, P2, B4, T2, T4, T5, C1, C2, C3** | T1 merged (every SQL/commit-count assertion needs it) |
| **C** | **P3, P4, P7, P6, T3, T6**, then **P5 last** | Wave B merged |
| **D** | The epic itself, each step behind its RFC: Step 0 (RFC-0 + ratchet + golden master) → Step 1 spike on owners/domains → Step 2 → Step 3 (Owners aspect first) → Step 4 → Step 5 → Step 6 decision | RFC-0 merged |

Every Wave-D PR: ≤ 1 week of work, exactly one sub-issue, the ratchet budget lowered in the same
diff, the golden master byte-equal, and Collate still compiles — additive changes only until the
static-`EntityUpdater` decision (Step 6) is taken.

## Verification

- **Java:** `mvn spotless:apply -pl <module>`; `mvn -pl openmetadata-service test -Dtest=<UnitTest>`;
  `mvn -pl openmetadata-integration-tests verify -DintegrationTests.lane=parallel -Dit.test=<IT>` on
  the default MySQL/ES profile **and** `-Ppostgres-opensearch`. Run
  `mvn -pl openmetadata-integration-tests test-compile` before every push — a Lombok cascade hides
  real compile errors behind unrelated ones.
- **SQL-count ITs:** re-measure the expected counts on `main` before asserting, and prefer `<=`
  budgets over equality.
- **UI:** `yarn test <file>`, plus a run of each touched Playwright spec.
  **Ingestion:** `pytest` on the touched file.
- **Collate:** build against OM `main`; run the two dashboard-chart tests and `SlackComponentsIT` on
  both databases.
- **Step 0:** `mvn -pl openmetadata-service test -Dtest=EntityRepositorySizeBudgetTest`; then
  `-Dit.test='EntityRepositoryGoldenMaster*IT' -Dgolden.update=true` to record on MySQL/ES, and
  verify on `-Ppostgres-opensearch` and `-Pcache-tests`. Record twice and diff `target/golden-actual`
  to prove the recording is deterministic.

## Process

1. **This document** ships as the first docs-only PR, with one row in `docs/index.md`. The pain list
   is mirrored to the Notion platform folder by hand.
2. **One GitHub sub-issue per pain** under #32946 (`Sub-issue of #32946.` + the three sections) for
   the pains that do not have one yet. **Done 2026-09-17:** #33517–#33527, plus #33528 *"Salvage
   from #33248"* holding the PR checklist above. #33353 and #33358–#33361 are reused as they are, and
   a comment on #32946 links the whole set.
3. **One RFC per pain before its code**, in `docs/plans/`, following the
   `2026-06-22-bulk-deletion-redesign.md` format: Context / Problem on `main` with line references /
   Proposal / Alternatives considered / Migration + Collate impact / Verification naming the
   golden-master cells that must stay byte-equal / Rollout. Mirrored to Notion for the platform
   review. **RFC-0 comes first and gates every refactor PR.**
4. **#33248 and #6639 are closed** (2026-09-17) with one comment each: the verdict, a link to this
   document, the sub-issues, and the salvage PR list. Both branches are kept for reference — they
   are the source of every hunk in the inventory above.
