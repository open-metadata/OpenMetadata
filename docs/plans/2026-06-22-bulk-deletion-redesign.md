# Bulk Recursive Deletion Redesign (Service-Level, At Scale)

**Status:** Proposed
**Date:** 2026-06-22
**Supersedes / replaces:** the FQN-prefix approach on branch `mohit/35dc-improve-deletion`
**Related code:** `EntityRepository`, `PrefixDeletionService`, `CollectionDAO.RelationshipDAO`, `HierarchicalLockManager`, `DeletionLockDAO`, `SearchRepository`

## Overview

Hard-deleting a service (e.g. a `databaseService` with 100k–1M descendant tables/columns) currently takes **2–6 hours** and frequently leaves **orphaned `entity_relationship` rows** behind. This document specifies a deletion subsystem that is **fast** (set-based, not per-entity), **orphan-free by construction** (deletes by entity **id-set**, immune to NULL hashes and renames), **atomic and resumable** (chunked transactions with a durable job/tombstone), and **safe under concurrent ingestion** (creates under a deleting subtree are rejected).

The design deliberately reuses primitives that **already exist** in the codebase rather than inventing new SQL.

## Implementation status against current `main` (2026-06-22)

This doc was first written against an April snapshot + the `mohit/35dc-improve-deletion`
prefix-deletion branch. **Latest `main` has since converged on most of this design's core**, which
materially narrows the remaining work. Verified against `EntityRepository` on `main`:

- ✅ **Per-level, per-type batched deletion** (`bulkHardDeleteSubtree` / `bulkSoftDeleteSubtree` /
  `bulkRestoreSubtree`, dispatched from `deleteChildren`). Replaces the old per-entity
  `cleanup()`-per-descendant transaction loop — the comments cite ~120k round-trips collapsed for a
  12k-table DB.
- ✅ **Relationships deleted by entity id-set** via `RelationshipDAO.batchDeleteRelationships(ids,
  type)` (`DELETE … WHERE fromId IN(…) … OR toId IN(…)`), i.e. the NULL-immune key this design
  argued for — **not** fqnHash prefixes. The prefix-branch approach is obsolete.
- ✅ Entity-row deletes chunked at `MAX_IN_LIST_CHUNK_SIZE = 30_000` (`EntityDAO.deleteByIds`).
- ✅ Both `tag_usage` sides cleaned (`deleteTagLabelsByTargetPrefix` + `deleteTagLabelsByFqn`),
  cache invalidation + NotFoundCache markers for every deleted descendant, per-entity `postDelete`
  + `deleteFromSearch`.

**Remaining gaps (what this design still drives):**

1. **Bounded memory — DONE in this change.** `bulkHardDeleteSubtree` loaded an entire tree level
   (`loadForBulk(ids, ALL)`) before deleting — a 1M-table service OOMs on the load. Now the level is
   processed in `BULK_HARD_DELETE_TXN_CHUNK_SIZE`-sized chunks (load → recurse children → purge),
   bounding peak heap to ~chunk × tree-depth hydrated entities. (Soft-delete / restore share the same
   ceiling and remain a follow-up.)
2. **Per-chunk transaction — follow-up.** The chunk purge is still per-DAO-call autocommit (matching
   prior behavior). Wrapping each chunk in one `flushInOneTransaction` (from PR #28675) gives
   per-chunk atomicity + deadlock-retry; the deletes are idempotent so it is safe to add.
3. **Concurrency race — deferred (separate "accuracy" PR).** The lock gate is **dormant on main**:
   `LockManagerInitializer.initialize()` has no caller, so `lockManager` is null and
   `checkModificationAllowed` is a no-op; even if enabled, `loadLockedFqnPrefixes()` is still a stub
   and there is no stale-lock reaper (`cleanupStaleLocks()` has no caller). Closing the race safely
   requires: wire startup init, implement `loadLockedFqnPrefixes` via `DeletionLockDAO` (cached),
   and schedule the reaper — otherwise a crashed delete blocks ingestion under the prefix forever.
4. **Per-entity satellite + search loops — DONE in this change (the headline speedup).** The bulk
   recursion still ran, *per descendant*: `field_relationship.deleteAllByPrefix`,
   `tagUsageDAO.deleteTagLabelsByTargetPrefix` + `deleteTagLabelsByFqn`, `usageDAO.delete(id)`, and
   `deleteFromSearch(entity)` (which serializes a snapshot + submits a lane task each). For an
   N-entity subtree that is ~3N satellite round-trips + N search dispatches — which a local 100k
   benchmark showed dominated the wall-clock (see below). Fixed via a capability field
   `descendantsCoveredByAncestorCascade` (declared on `EntityRepository`, default `false`, set in
   the constructor like `supportsSearch`; enabled for `Database`/`DatabaseSchema`/`Table`/
   `StoredProcedure`). When set, the bulk path:
   - **skips per-entity `deleteFromSearch`** — the root's own `deleteFromSearch` already fires
     `SearchRepository.deleteOrUpdateChildren`, which deletes *all* descendant docs in one
     delete-by-query by `service.id` / parent-id;
   - **skips per-entity `field_relationship` + `tag_usage`** — the root's `cleanup()` already
     prefix-deletes the whole FQN subtree in one statement each;
   - **batches `usage`** by id-set (`deleteByIds` IN-list per chunk; usage is id-keyed so the root's
     FQN-prefix cleanup doesn't cover descendants).

   Default `false` keeps flat-FQN / non-cascade-covered types (Team, User, Role, Policy, …) on the
   safe per-entity path. Other service-rooted asset trees (dashboard/pipeline/topic/mlmodel/storage/
   search/api/drive) are the identical pattern and can opt in the same one-line way after confirming
   their child docs carry `service.id`.

### Measured result (local Docker, 1 GB heap, MySQL + Elasticsearch)

100k tables under one schema (one service → db → schema), recursive hard-delete via
`DELETE /v1/services/databaseServices/{id}?hardDelete=true&recursive=true`:

| | baseline (per-level batched, current `main` + bounded-memory) | + per-entity satellite/search batching |
|---|---|---|
| **wall-clock** | **1643 s (~27 min)** | **59 s** (~28× faster, ~1700 tbl/s) |
| **peak heap** | 546 MB (median 394) | 493 MB (mean 384) — no OOM at 1 GB |
| **correctness** | subtree gone | subtree gone; `entity_relationship` 100088 → 86 (all 100,002 subtree edges removed, no orphans); ES table docs for the service = 0 (search clean) |

Extrapolated: ~1M tables would go from the reported multi-hour range to **~10 min** at this rate.

Still open as follow-ups: per-chunk `flushInOneTransaction` atomicity (#2); the concurrency race
(#3); extending the capability flag to the other service trees; and applying the same skips to
`bulkSoftDeleteSubtree` / `bulkRestoreSubtree`.

## Problem Statement & Root Causes

### Why it is slow (2–6 hours)

The cascade walks the tree one entity at a time:

`EntityResource.deleteByIdAsync → EntityRepository.delete → deleteChildren → batchDeleteChildren → processDeletionBatch → cleanup()`

The dominant cost is **N independent transactions**: `cleanup()` (`EntityRepository.java:3763`) wraps *each* entity's full cleanup in its own `Jdbi.inTransaction(...)`, and the recursion re-queries children at each level (batches of 50, threshold 100). For ~1M descendants this is millions of transactions + millions of per-entity search calls + millions of per-entity change events. Transaction overhead — not row volume — is the wall.

### Why relationships are orphaned

1. **Cross-cutting edges are never reached by the walk.** The recursive walk follows `CONTAINS`/`PARENT_OF` edges. Non-hierarchical edges (lineage `UPSTREAM`, ownership `OWNS`, `HAS` domain, `FOLLOWS`, dataProduct, tags) that point *into* the subtree from outside are only cleaned if the in-subtree endpoint is individually reached and `cleanup()` runs `deleteAll(id, type)` for it. Any entity missed (see #2) leaves its edges dangling.
2. **The concurrency window.** During the multi-hour walk, ingestion can re-create children that the walk already passed. Those new entities — and their relationships — survive as orphans. The `HierarchicalLockManager` was introduced to stop this but its create-path gate is **not actually wired** (see Appendix B).

## Goals

1. **Speed:** delete a 1M-entity service in **minutes**, bounded by *hundreds* of SQL statements, not millions of transactions.
2. **Orphan-free by construction:** after deletion, **zero** `entity_relationship` / `field_relationship` / `tag_usage` / `entity_extension` / time-series / feed rows reference any deleted entity — regardless of relationship type, hash population, or rename history.
3. **Atomic & resumable:** a crash/restart mid-delete never leaves a *live* entity stripped of its dependencies; the operation resumes and completes.
4. **Concurrency-safe:** ingestion/create under a subtree being deleted is rejected (or queued), closing the orphan race.
5. **Faithful side-effects:** change events, audit log, search index, RDF, alerts/governance, and per-type cleanup behave as if each entity were deleted.
6. **Bounded blast radius:** the bulk path is available only on hierarchical, FQN-nesting roots.

## Non-Goals

- Changing **soft-delete** semantics. Soft delete keeps the existing tree-walk (it must preserve relationships for restore).
- Adding database-level foreign keys. `entity_relationship` references ~60 `*_entity` tables polymorphically via `(fromId, fromEntity)`; `ON DELETE CASCADE` is not expressible, and the schema is FK-free by design.
- A general distributed job framework. We reuse the existing async executor + `entity_deletion_lock` table.

## Core Design Decision: delete by **id-set**, not by FQN-hash prefix

The single most important decision is the **deletion key**.

- **FQN-hash prefix is the wrong key.** `entity_relationship.fromFQNHash/toFQNHash` is populated on only a handful of `CONTAINS` code paths; bulk-ingestion (`bulkInsertTo`) and every legacy/lineage/ownership/domain `addRelationship` overload write **NULL**. NULL never matches `= :hash` or `LIKE :hash.%`, so those rows survive. A one-time backfill cannot fix rows created *after* it. Hashes also go stale on rename and are blind to flat-FQN hierarchies (sub-teams).
- **The entity id-set is the right key.** `entity_relationship.fromId`/`toId` (and the `id` column of every entity-keyed table) are **always populated** and **stable across renames**. Deleting `WHERE fromId IN (subtree) OR toId IN (subtree)` catches every edge touching the subtree, whatever its type or hash state.

**Rule:** delete by **id-set** wherever a table stores entity ids; delete by **bounded fqnHash prefix** (`hash + "." + %`, plus exact-match for the root) only for satellite tables that are *keyed by FQN hash* and have no id column.

| Table | Key column(s) | Deletion strategy |
|---|---|---|
| `<type>_entity` | `id` | id-set, chunked |
| `entity_relationship` | `fromId`, `toId` | **id-set** via `batchDeleteFrom`+`batchDeleteTo` per type (NULL-immune) |
| `entity_extension` | `id` | id-set, chunked |
| `entity_usage` | `id` | id-set, chunked |
| `thread_entity` (feed) | `entityId` (about) | id-set via `findByEntityIds` → delete threads |
| `field_relationship` | `fromFQNHash`, `toFQNHash` | bounded fqnHash prefix (already `.`-anchored) |
| `tag_usage` | `targetFQNHash` **and** `tagFQNHash` (source) | target by prefix; **source** by `deleteTagLabelsByFqn` per deleted tag/term |
| `*_time_series` (profiler, test results, query cost, etc.) | `entityFQNHash` | bounded fqnHash prefix |
| search index (ES/OS) | doc `fullyQualifiedName` | bounded prefix delete-by-query + exact root + reverse-reference scrub |
| RDF triple store | entity IRI | bulk SPARQL delete by subtree |

Existing primitives we reuse: `RelationshipDAO.batchDeleteRelationships(ids, type)` / `batchDeleteFrom` / `batchDeleteTo` (`CollectionDAO.java:2409-2433`, chunked), `EntityTimeSeriesDAO.deleteByFqnHashPrefix`, `FieldRelationshipDAO.deleteAllByPrefix`, `FeedDAO.findByEntityIds`.

## Architecture

Two cooperating pieces, both backed by the existing `entity_deletion_lock` table (used as the durable job record):

```
   DELETE /services/.../prefix/{id}
            │  (synchronous, O(1))
            ▼
   ┌─────────────────────────┐        ┌──────────────────────────────┐
   │ 1. Acquire tombstone     │        │  BulkDeletionExecutor         │
   │    (DELETE_IN_PROGRESS    │        │  (async, resumable)           │
   │     lock on root FQN)     │──────▶ │  - collect id-set (cursor)    │
   │ 2. Persist job record     │        │  - per-chunk TXN: deps+rows   │
   │ 3. Return 202 + jobId     │        │  - bulk hooks per type        │
   └─────────────────────────┘        │  - search/RDF/events          │
            │                          │  - update cursor in lock row  │
            ▼                          │  - release lock on success    │
   create/update path                 └──────────────────────────────┘
   checks tombstone → 409                         ▲
            │                                      │ resume on restart
            └──────────────────────────────────────┘ (StaleLockReaper / boot)
```

### 1. The tombstone closes the race (synchronously, before any work)

On request, **before** collecting any ids, acquire a `DELETE_IN_PROGRESS` lock on the root FQN (`HierarchicalLockManager.acquireDeletionLock`, which already writes `entity_deletion_lock`). This is the gate; deletion proceeds only if the lock is acquired (no best-effort “continue without lock”).

The create/update/bulk-upsert paths already *call* `checkModificationAllowed(...)`. The fix is to make that check actually consult the DB:

- **Wire the gate.** Route `checkModificationAllowed` through the already-correct, **currently-callerless** `checkModificationAllowedByFqn(fqn)` (`HierarchicalLockManager.java:169`), which runs `findParentLocks` (`entityFqn = :fqn OR :fqn LIKE entityFqn || '.%'`). For the bulk path, batch it. Replace the dead `loadLockedFqnPrefixes()` stub (returns `new HashSet<>()`, `:312`) with a real `DeletionLockDAO` query, cached in the existing Caffeine cache (~30s TTL, invalidated on acquire/release) for the hot ingestion path.

Result: any insert/upsert under a deleting prefix is rejected with `EntityLockedException` → the snapshot-then-orphan race is closed.

### 2. The executor: collect → chunked-transactional purge → finalize

```
bulkDelete(root):
  job = lock row for root (DELETE_IN_PROGRESS), with progress cursor in metadata

  # Phase A — collect (read-only, resumable). FQN-hash prefix is fine HERE:
  # we only use it to FIND descendants; we DELETE by id.
  idsByType = {}
  for type in fqnHashKeyedTypes():           # skip flat-FQN types
      ids = dao(type).findIdsByFqnHashPrefix(hash(root.fqn))   # + the root id
      if ids: idsByType[type] = ids
  totalIds = flatten(idsByType) + root.id

  # Phase B — purge in chunks; EACH CHUNK IS ONE TRANSACTION.
  for chunk in partition(totalIds, CHUNK=25_000):   # tune per engine
    inTransaction:
       # satellite tables keyed by FQN hash for entities in this chunk
       #   (or once up-front, see "scaling" note)
       relationshipDAO.batchDeleteFrom(chunk, type) / batchDeleteTo(chunk, type)  # id-set
       entityExtensionDAO.deleteBatch(chunk)
       usageDAO.deleteBatch(chunk)
       feedRepository.deleteByAboutBatch(chunk)
       dao(type).deleteBatch(chunk)              # entity rows — CHUNKED (≤ 50k)
    job.cursor = advance(chunk); persist(job)    # durable progress

  # FQN-hash-keyed satellites (bounded prefix, one pass — no id chunking needed)
  fieldRelationshipDAO.deleteAllByPrefix(root.fqn)
  for type: timeSeriesDAO(type).deleteByFqnHashPrefix(hash(root.fqn))
  tagUsageDAO.deleteTagLabelsByTargetPrefix(root.fqn)         # target side
  # source side: for each deleted tag/glossaryTerm id → deleteTagLabelsByFqn(fqn)

  # Phase C — per-type bulk hooks (replaces dropped cleanup()/preDelete/postDelete)
  for type: repo(type).bulkCleanup(idsByType[type])   # see "Per-type side-effects"

  # Phase D — finalize
  searchRepo.deleteSubtree(root)              # anchored prefix + root + reverse scrub
  rdf.deleteSubtree(root)                     # bulk SPARQL
  changeEventDAO.insert(ENTITY_DELETED for root)   # + summary count
  invalidateCache(ALL deleted ids)            # not just root
  releaseDeletionLock(root)
  websocket: COMPLETED  (or FAILED with detail on any aggregated error)
```

Key properties:

- **Atomicity at chunk granularity.** Dependency rows and entity rows **for the same id chunk** commit together. A crash leaves a clean *prefix* of fully-deleted chunks; never a live entity with destroyed dependencies. (Contrast: the prefix PR deletes *all* dependency tables first and *then* entity rows, with no transaction — a crash in between corrupts the whole subtree.)
- **Resumability.** The cursor lives in the lock row (`entity_deletion_lock.metadata` JSON). On restart, a reaper (or boot scan) finds `DELETE_IN_PROGRESS` locks and **resumes from the cursor**. Re-running a chunk is idempotent (`DELETE … WHERE id IN` of already-gone ids is a no-op).
- **No swallowed fatal errors.** Per-chunk failures are retried with backoff; unrecoverable failures mark the job `FAILED`, send the FAILED websocket/notification, and leave the lock for the reaper — the API never reports “completed” on partial failure.

## Per-Type Side-Effects (the dropped `cleanup()` work)

Raw `deleteBatch` skips `entitySpecificCleanup`, `preDelete` guards, and `postDelete`. Introduce one bulk hook on `EntityRepository`:

```java
protected void bulkCleanup(List<UUID> ids) { /* default no-op */ }
```

Overrides (mirroring today's per-entity logic, but set-based):

- **TestCase / TestSuite:** delete `data_quality_data_time_series` results.
- **IngestionPipeline / Workflow / WorkflowDefinition:** delete external pipelines/secrets — **batch** the external calls; do not `find(id)` per entity in a loop (the prefix PR re-introduced N+1 here).
- **Pipeline / StoredProcedure:** `deleteLineageBySourcePipeline` (lineage edges keyed by JSON `$.pipeline.id`, which an id-IN on `fromId/toId` will **not** catch).
- **Team:** sub-team reparenting / membership; **Role/Team:** `PolicyConditionUpdater` SpEL cleanup.
- **Tag / DataProduct:** the `IN_REVIEW` reviewer guard must be **checked**, not bypassed (governance). Also source-side `tag_usage` (`deleteTagLabelsByFqn`).
- **Base `postDelete`:** RDF removal via a **bulk** SPARQL delete for the subtree (not a per-entity loop).

`preDelete` system-protection guards (system policies/roles, the `organization` team) must run against the **root** and be enforced before Phase B.

## Endpoint Scope

Expose the bulk path **only** on hierarchical, FQN-nesting roots: `DatabaseService`, `Database`, `DatabaseSchema`, and the analogous `*Service`/container roots (dashboard, pipeline, messaging, mlmodel, storage, search, api, drive). **Do not** expose it on flat-FQN, `nameHash`-keyed types (`Team`, `User`, `Role`, `Persona`, `TestDefinition`, `Tag`, `Glossary`, `Domain`, `Policy`): for those `findIdsByFqnHashPrefix` returns `List.of()`, so a bulk delete degenerates to a raw root delete that skips required cleanup — strictly worse than the existing recursive path. Those types keep the existing `cleanup()` path.

## Search Index Strategy

The catalog (DB) is the source of truth; search must converge without divergence:

1. **Anchor the prefix.** Delete-by-query uses `fullyQualifiedName` prefixed with `root.fqn + Entity.SEPARATOR` (the `.`) so deleting `prod` does **not** wipe `prod_backup`. Delete the root doc separately by exact FQN/id. (The prefix PR passed the raw, unanchored `rootFqn`.)
2. **Reverse-reference scrub.** Run `deleteOrUpdateChildren`-equivalent for every deleted entity that may be *referenced inside other docs* (tags/terms/domain/dataProduct/owners/lineage on surviving assets), not just the root.
3. **Child docs.** Column-level / field-level docs under the deleted entities are covered by the same anchored prefix.
4. **Ordering & idempotency.** Search delete runs in Phase D after DB purge; it is idempotent and safe to re-run on resume.

## Change Events, Audit, Governance

The bulk path must not silently skip the eventing pipeline:

- Emit a real `ENTITY_DELETED` `change_event` for the **root** (so `EventSubscription` alerts, the audit log, and governance delete-workflows fire), carrying a **summary** (descendant counts by type, jobId).
- For very large subtrees, do **not** emit one event per descendant (that re-creates the millions-of-events cost). The root “subtree deleted” event + counts is the contract; document this as an intentional change from per-entity events. Consumers that need per-entity granularity subscribe to the job-summary payload.

## Relationship to PR #28675 (one-transaction write path) — build on it, don't reinvent

PR #28675 ("perf: one-transaction flush + async indexing write path", merged to `main` 2026-06-05) is **not** about deletion, but it landed exactly the infrastructure this design needs. **This deletion branch was last synced with `main` on 2026-04-13, so it does not yet contain #28675** — step 0 of any implementation is to rebase/merge `main`. The pieces and how the deletion path reuses each:

| #28675 primitive (location) | What it does for writes | How bulk deletion reuses it |
|---|---|---|
| `EntityRepository.flushInOneTransaction(Runnable)` (`EntityRepository.java:5029`) + `DeadlockRetry.execute(Supplier)` (`jdbi3/DeadlockRetry.java`) | Wraps the create/update/patch flush in `DeadlockRetry.execute(() -> jdbi.inTransaction(...))` — retry OUTER (fresh handle per replay), `inTransaction` INNER; collapses 5–7 commits → 1, atomic + deadlock-replay-safe | **The per-chunk atomic boundary in Phase B.** Each id-chunk purge runs inside `flushInOneTransaction` instead of a hand-rolled transaction. `DeadlockRetry` replays the whole chunk body — and `DELETE … WHERE id IN (…)` is idempotent, so replay is safe. Do not invent a new retry/transaction wrapper. |
| Deferred external-side-effect collectors: `DEFERRED_CACHE_INVALIDATIONS` + `beginCacheInvalidationDeferral`/`drainCacheInvalidations`; `RdfTagUpdater.beginDeferral`; `LineageUtil.drainLineageDeferred`; `SearchRepository.beginSearchWriteDeferral`/`drainSearchWriteDeferred` | Captures cache-L2 invalidation, RDF/SPARQL, lineage-ES and search writes *during* the flush and drains them **post-commit**, so the held DB connection makes **zero network round trips** | **Solves "no I/O while holding the delete transaction."** Inside each chunk transaction, only DB deletes run; record a cache invalidation for **every deleted descendant id** (fixes the only-root-invalidated bug) into `DEFERRED_CACHE_INVALIDATIONS`, and defer search/RDF deletes. Drain per chunk on the deletion worker thread (the "request thread" in #28675 just means "the thread that opened the scope"). |
| `EntityLifecycleEventDispatcher.onEntityDeleted` → `OrderedLaneExecutor` (per-entity-id lanes) → `SearchIndexHandler.onEntityDeleted` → `searchRepository.deleteEntityIndex`, failures → **`SearchIndexRetryQueue`** durable outbox | Entity-delete search/RDF/lineage propagation is already **async + per-entity-ordered + durable** | **Replaces the prefix PR's synchronous, best-effort `cleanSearchIndex`** (which silently diverges on ES failure). Route search/RDF cleanup through this hub so it inherits durable retry. |
| `SearchRepository.deleteEntityByFQNPrefix(EntityInterface)` (`SearchRepository.java:2573`) + `SearchIndexRetryQueue.failureReason(...)` | Prefix delete-by-query for search docs, with durable retry on failure (already used for `Entity.PAGE`) | The subtree search cleanup. **Note the signature differs** from this branch's `deleteByEntityTypeFqnPrefix(type, fqn)` — resolve the merge in favor of `main`'s durable variant; anchor with `Entity.SEPARATOR` (see Search Index Strategy). |
| Consistency contract: GET-by-id/name real-time (DB + **synchronous** cache write-through post-commit); `/search`, RDF, lineage **eventually consistent** with durable retry | — | **Adopt verbatim for delete.** The tombstone is the delete-time analog of #28675's synchronous cache write-through: it makes the subtree invisible/locked at the DB+cache layer *immediately*, while search/RDF converge asynchronously and durably. No new contract to invent. |

### The one adaptation that matters: granularity

#28675's dispatcher is **per-entity** — one `OrderedLaneExecutor` lane task per entity id (correct for writes, where per-entity ordering prevents a stale create clobbering a newer update). A bulk delete must **not** fan out `onEntityDeleted` across 1M descendants — that re-creates the millions-of-tasks cost this redesign exists to kill. Instead:

- Enqueue **one** subtree search delete-by-query (`deleteEntityByFQNPrefix` on the anchored root) as a single durable task after the DB purge — not N per-entity deletes.
- Emit **one** root `ENTITY_DELETED` summary event through the dispatcher (descendant counts by type), not one per descendant.
- Per-entity lane ordering is unnecessary here: the subtree is tombstone-locked, so no concurrent index-write for a deleted id can be in flight to race the delete.

Net: deletion reuses #28675's transaction wrapper, deferred-collector discipline, durable search outbox, and consistency contract, but operates at **subtree granularity** on the propagation side.

## Scaling Analysis

Let **N** = descendant count, **T** = number of entity types present, **C** = chunk size.

- **Statements:** collection = `T` SELECTs; purge = `~ceil(N/C) × (tables-per-chunk)`; satellites = `O(T)` prefix deletes. For N=1M, C=25k → ~40 chunks → low **hundreds** of statements total. (Baseline: ~N transactions.)
- **Transactions:** `~ceil(N/C)` (≈40) vs **~N** (≈1M). This is the headline win.
- **Memory:** the id-set is materialized once. 1M UUIDs ≈ tens of MB as `UUID`/`String`. Acceptable, but **stream the collection cursor-style** (page by `fqnHash` ranges) for >2–3M to bound heap; the cursor already supports paging.
- **IN-list limits:** entity-row and id-keyed deletes **must be chunked ≤ ~50k** to stay under PostgreSQL's 65,535 bind-parameter limit and MySQL `max_allowed_packet`. (The prefix PR left `EntityDAO.deleteBatch` un-chunked — a deterministic failure at the exact scale it targets.)
- **Index usage:** id-set deletes on `entity_relationship` use the existing `from_index (fromId,relation)` / `to_index (toId,relation)` on **both** engines — no dependency on the new fqnHash LIKE indexes (which on default-locale PostgreSQL require `varchar_pattern_ops` to serve `LIKE 'prefix%'` at all). Keep id-set off the hottest table's LIKE path entirely.
- **Lock/bloat:** per-chunk transactions keep lock duration and WAL/undo growth bounded; a single giant transaction over 1M rows would bloat and risk lock timeouts.
- **Collection note:** for FQN-hash-keyed satellites we can either delete per-chunk by FQN (more queries) or once up-front by bounded prefix (fewer queries, but those rows are deleted before the corresponding entity rows). Prefer the **one-pass bounded-prefix** delete *inside the final chunk's transaction window* or as an explicitly-resumable Phase, since these tables have no cross-entity integrity that a mid-run crash could corrupt beyond what the cursor already protects.

## Failure Handling & Resumability

| Failure | Behavior |
|---|---|
| Chunk SQL error (timeout, deadlock) | retry chunk w/ backoff; chunk TXN rolled back, cursor not advanced |
| Unrecoverable chunk error | job → `FAILED`, FAILED notification, lock retained for reaper/operator |
| JVM restart mid-job | `DELETE_IN_PROGRESS` lock + cursor survive; **StaleLockReaper** (Quartz) resumes from cursor |
| Abandoned/stale lock | reaper (wire the existing, **uncalled** `cleanupStaleLocks()` / `STALE_LOCK_CHECK_INTERVAL_MINUTES=5`) resumes or, past TTL, force-releases |
| Concurrent second delete of same root | rejected — lock already held |
| Concurrent ingestion under root | rejected with `EntityLockedException` (gate wired) |

## Observability

- Job record (`entity_deletion_lock` + metadata): `phase`, `cursor`, `deletedByType`, `startedAt`, `lastHeartbeat`, `error`.
- Metrics: rows deleted per table, chunk latency, total duration, retries; expose via `getLockStatistics()` and a status endpoint (`GET …/prefix/{jobId}/status`).
- Websocket progress events (already used by the prefix PR) reporting `% complete` from the cursor.

## Migration & Rollout

0. **Phase 0a (rebase):** merge/rebase `main` into the branch to pick up **PR #28675** (`flushInOneTransaction`, `DeadlockRetry`, deferred collectors, `OrderedLaneExecutor`, `SearchIndexRetryQueue`, `deleteEntityByFQNPrefix`). Resolve the heavily-overlapping `EntityRepository` changes and the `SearchRepository` prefix-delete signature in favor of `main`'s durable variants. Everything below builds on this.
1. **Phase 0b (correctness now / quick wins):**
   - Add id-set relationship sweep (`batchDeleteRelationships(ids, type)`) to the purge — closes the entire NULL-hash orphan class with an existing primitive.
   - Chunk `EntityDAO.deleteBatch` at 50k.
   - Wrap each id-chunk purge in `flushInOneTransaction` (from #28675); stop reporting “completed” on partial failure.
   - Anchor the search prefix with `.`; restrict the endpoint to hierarchical roots only.
2. **Phase 1 (race):** wire `checkModificationAllowed` → real DB gate (`checkModificationAllowedByFqn` / `loadLockedFqnPrefixes`), with Caffeine caching; tombstone before collection; acquire-or-abort (no best-effort).
3. **Phase 2 (durability):** cursor in lock metadata + `StaleLockReaper` (Quartz) for resume; status endpoint.
4. **Phase 3 (fidelity):** `bulkCleanup` overrides; route search/RDF cleanup through `EntityLifecycleEventDispatcher` + `SearchIndexRetryQueue` (one subtree task, not per-entity); record deferred cache invalidations for all deleted ids; reverse-reference search scrub; root `change_event` with summary.
5. **Deprecate / keep** the `fromFQNHash`/`toFQNHash` columns: they are **no longer required** for deletion (id-set replaces them). Decide separately whether to keep them for other features; if dropped, revert the v1.13.0 backfill (which is itself a perf risk — see Appendix A).

## Testing Strategy

Integration tests that **fail without the fix**:

1. **NULL-hash orphan:** bulk-ingest a service via the batch import path, prefix-delete it, assert **zero** surviving `entity_relationship` rows referencing any deleted id (proves id-set ≠ fqnHash).
2. **Cross-cutting edges:** add lineage/ownership/domain/follows from *outside* the subtree into it; after delete, assert all such edges are gone and the *external* entities survive.
3. **Crash atomicity:** inject a failure mid-purge; assert the subtree is either fully intact or fully gone — never a live entity with missing dependencies — and that resume completes it.
4. **Postgres scale:** a service with >65,535 descendants of one type deletes successfully (no bind-param failure).
5. **Concurrency:** insert-during-delete under the root is rejected; insert outside the root succeeds.
6. **Search convergence:** sibling docs (`prod_backup`) survive; subtree docs and reverse references are gone.
7. **Governance:** an `IN_REVIEW` tag inside the subtree blocks/honors the reviewer guard rather than being silently bypassed.
8. **Benchmark:** assert wall-clock for a seeded large service is within target (minutes), tracked over time.

## Alternatives Considered

- **A. FQN-hash prefix delete (the current PR).** Rejected as the primary mechanism: NULL-hash blindness re-creates orphans, stale on rename, blind to flat hierarchies, sibling collisions in search. The prefix is still useful for *collecting* descendants and for FQN-keyed satellite tables.
- **B. FK `ON DELETE CASCADE`.** Rejected: polymorphic `(fromId, fromEntity)` references prevent DB-level cascade; FK-free schema by design; huge migration to add/validate FKs on existing data.
- **C. Soft-tombstone + scheduled GC purge.** Strong for perceived latency (API is O(1), GC purges later) and folds naturally into this design’s tombstone. Adopted as an *option*: the tombstone already makes the subtree invisible/locked; whether the purge runs immediately (this doc’s default) or via a GC app is a deployment choice. The id-set purge mechanics are identical either way.

## Appendix A — Migration perf risk in the current PR

`MigrationUtil.backfillRelationshipFqnHashes` (v1.13.0) runs a correlated-subquery `UPDATE … SET fromFQNHash = (SELECT CAST(t.<hashcol> AS CHAR(768)) FROM <table> t WHERE CAST(t.id AS CHAR(36)) = entity_relationship.fromId)` once per entity type per direction (~120 statements). The `CAST(t.id AS CHAR(36))` **defeats the primary-key index** on the entity table, risking a full scan per ER row on instances with tens of millions of relationships. Since the redesign deletes by id-set, this backfill (and the columns) can be dropped. If retained, rewrite as an indexed join without casts.

## Appendix B — The race the current PR does not close

`createInternal`/`createOrUpdate`/bulk-upsert *do* call `lockManager.checkModificationAllowed(...)`, but it short-circuits on `isFqnLocked(fqn)` → `loadLockedFqnPrefixes()`, which is a stub returning `new HashSet<>()` (`HierarchicalLockManager.java:312-316`). So no FQN is ever considered locked and ingestion is never blocked. The correct, cache-free gate `checkModificationAllowedByFqn` (`:169`) exists but has **zero callers**. Wiring this (Phase 1) is the single change that makes the lock actually prevent concurrent-ingestion orphans.
