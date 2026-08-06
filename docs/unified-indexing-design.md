# Unified Live + Reindex Indexing Architecture

**Status:** Proposal · **Owner:** Search/Platform · **Scope:** OSS `openmetadata-service/.../search` + `apps/bundles/searchIndex`, with Collate (`io.collate`) extension contract preserved

---

## 0. Executive summary

Live indexing and reindexing are described as "two paths to the same document". They are not. An audit
across both repos found **three independent definitions of document semantics** (declarative projector,
live self-update painless, cascade painless), **no test anywhere that compares a live-produced document
to a reindex-produced one**, and a set of concrete divergences where the two paths provably disagree.

It also surfaced two problems that are **independent of this redesign and more urgent than it**:

1. **Staged-index write routing is process-local.** `activeStagedIndices` is an in-memory
   `ConcurrentHashMap` (`SearchRepository.java:424`), populated only by the JVM running the reindex.
   Live writes served by any *other* node — or by any node at all when the reindex is triggered from the
   `openmetadata-ops.sh` CLI — go to the old index, which is **hard-deleted at promotion**
   (`DefaultRecreateHandler.java:191-201`). Those edits are silently lost. No test covers this.
2. **The retry worker has no write-ordering guard**, so a retry can overwrite a newer document.

The redesign below is worth doing, but §9 should ship first and separately.

The core architectural correction the audit forced: **"one projector, two masks" is not sufficient**,
because not every document field is derivable from the entity. Embeddings, fenced relationship fields,
and accumulated lineage state are not. A full-document rebuild must *preserve* them, not overwrite them.
The codebase already solves this twice, ad hoc and per-field. The design formalises it as a field
ownership taxonomy (§6).

---

## 1. Where we actually are today

The document *builder* is already shared. Both paths call:

```
SearchIndex.buildSearchIndexDoc(DocBuildContext)     — search/indexes/SearchIndex.java:83
  Phase 1 populateCommonFields    (owners, domains, followers, votes, ...)
  Phase 2 mixins                  (TaggableIndex, ServiceBackedIndex, LineageIndex, AIContextIndex)
  Phase 3 buildSearchIndexDocInternal
  Phase 4 FQN hash / derived keys
```

The divergence is entirely in the layer above — how a change becomes a write.

| Concern | Live path | Reindex path |
|---|---|---|
| Hydration | whatever the API request happened to fetch | explicit set from `SearchIndexFactory.getReindexFieldsFor()` |
| Doc semantics (self) | hand-written painless if-chain, `SearchRepository.getScriptWithParams():3442` | declarative projector |
| Field coverage | 7 fields (`PARTIAL_SCRIPT_SUPPORTED_FIELDS`); everything else falls back to full doc | all fields |
| Doc semantics (cascade) | painless update-by-query over child aliases | **nothing runs** — children re-derive via `EntityRepository.setInheritedFields()` |
| Inheritance conflict rule | painless: overwrite iff `null`, or `inherited==true` && parent id matches | Java: `setInheritedFields()` |
| Derived-field re-separation | painless `TAG_RESEPARATION_SCRIPT`, appended **by hand** to each tag-mutating script | Java `ParseTags` / `TaggableIndex.applyTagFields()` |
| Write | `searchClient.updateEntity(...)`, unversioned | bulk sinks (ES 68 KB / OS 76 KB), staged index + promotion |
| Ordering guard | none, except two fenced fields (§8) | staged index (whole-index only) |
| Validation | none | none |

### Root cause

> Three independent definitions of "what the document for field X looks like", with nothing in the type
> system, the tests, or CI forcing them to agree.

The `TAG_RESEPARATION_SCRIPT` javadoc states it outright:

> *"Append this to every script that mutates `tags[]` so live-indexing updates produce the same
> separation that `TaggableIndex.applyTagFields` (the reindex path) produces."*

A painless re-implementation of `ParseTags`, kept in sync by remembering to paste it in — with a further
caveat that `tier` must be assigned conditionally, discovered (per the same javadoc) by a Playwright test
after the fact. `PropagationDescriptor.EXTERNAL_HANDLER` exists for the same reason: the generic scripts
cannot express certification, so certification got an escape hatch instead of a model fix.

---

## 2. Divergence catalogue (audit findings)

Each row is a place where live and reindex provably disagree. **Each is also a ready-made test case for
§11.** Severity is my assessment.

### P0 — data loss / silent corruption

| # | Finding | Evidence |
|---|---|---|
| 1 | **Staged-index routing is process-local.** Live writes on non-reindexing nodes, and *all* live writes during a CLI-triggered reindex, land in the old index and are deleted at promotion. | `SearchRepository.java:424` (in-memory map), only writers `DefaultRecreateHandler.java:210,231,328,420,584`; deletion at `DefaultRecreateHandler.java:191-201`; CLI entry `OpenMetadataOperations.java:1112,2485`; clustered Quartz `AppScheduler.java:73`. No test coverage. |
| 2 | **Retry worker can clobber a newer write.** It correctly re-reads from the DB rather than replaying a stale payload, but the ES write itself has no version guard, so a slow retry can overwrite a newer concurrent write. | `SearchIndexRetryWorker.java:510-533` (fresh read), `SearchClient.java:42-52` (`DEFAULT_UPDATE_SCRIPT`, unconditional `put`) |
| 3 | **Retry-queue enqueue silently un-claims an in-flight row** (`ON DUPLICATE KEY UPDATE` resets `status`/`retryCount`/`claimToken` unconditionally), so the working worker's outcome is discarded. | `SearchIndexRetryQueue.java:74-107`, `CollectionDAO.java:13740-13791` |

### P1 — live and reindex produce different documents

| # | Finding | Evidence |
|---|---|---|
| 4 | **Table-level tags propagated live into column docs' `tags[]` vanish on any rebuild.** `ColumnSearchIndex` computes `tags` only from `column.getTags()`; it never merges parent-table tags (unlike `tier`, which has an explicit fallback). Live appends them, rebuild drops them. **The purest instance of the whole problem.** | `TableRepository.java:1771-1773`, `SearchRepository.java:3085-3107` vs `ColumnSearchIndex.java:54-151` |
| 5 | **Table rename leaves column docs' own `id`/`fullyQualifiedName`/`fqnParts`/`fqnHash` stale.** A pure rename produces no `columns.*` entry in `ChangeDescription`, so `hasColumnsChanged` is false and the cheap branch runs, which never touches column identity fields. Self-heals only on reindex. | `SearchRepository.java:1334-1345`, `EntityRepository.java:10579-10582`, `SearchRepository.java:1347-1431` |
| 6 | **Table tier change never updates column docs' dedicated `tier` field live** — the cascade only appends to `tags[]`. Only a rebuild recomputes `tier`. | `ColumnSearchIndex.java:131-137` |
| 7 | **Nested GlossaryTerm rename leaves descendant term docs stale.** The Glossary-level rename was fixed with `updateEntitiesByReference` (with a comment describing exactly this bug); the term-level path only fixes tagged *assets*, never descendant *terms*. | `GlossaryRepository.java:582-615` (fixed) vs `GlossaryTermRepository.java:1714-1724, 2228-2379` (not) |
| 8 | **Every reindex reverts lineage SQL dedup.** `SearchIndex.populateLineageData` (which would rebuild `lineageSqlQueries`) is **dead code — zero callers**. The live `ADD_UPDATE_LINEAGE` script dedups; reindex writes raw `sqlQuery` per edge, which can push the doc over the payload cap and trigger `stripLineageForSize` to drop `upstreamLineage` **entirely**. | `SearchIndex.java:659-674` (uncalled), `SearchClient.java:362-440`, `SearchIndexUtils.java:99-140`, `ElasticSearchBulkSink.java:469` |
| 9 | **`pipelineExecution` is never reindexed at all** — not in `TIME_SERIES_ENTITIES`, written only by live call sites with a different composite doc-ID scheme. If that index is lost, only re-ingestion restores it. | `SearchIndexEntityTypes.java:28-37`, `SearchRepository.java:1822-1848`, `PipelineRepository.java:483-501` |

### P2 — cascade completeness gaps (live leaves orphans; reindex is authoritative)

| # | Finding | Evidence |
|---|---|---|
| 10 | **`childAliases` are not transitive and nothing validates them.** `directory → [file, spreadsheet]` and `spreadsheet → [worksheet]`: hard-deleting a directory never deletes `worksheet` docs. | `indexMapping.json:165-177,191-203`; `SearchRepository.java:3410-3416`; `IndexMappingValidator.java:40-70` checks soft-delete compatibility only, never transitivity |
| 11 | **Soft-deleting a database/schema/service leaves `tableColumn` docs with `deleted=false`.** The subtree soft-delete is a batched raw DB write that dispatches no per-table event, and `tableColumn` is not in the ancestor's `childAliases`. | `EntityRepository.java:6657-6684`, `SearchRepository.java:3306-3308,3420-3440` |
| 12 | **`tableColumn` has no registered `EntityIndexCapability`** (it has no backing repository), so the registry returns `null` — and two callers treat `null` **oppositely**: fail-closed in `SoftDeleteScript.compatibleWith`, fail-open in `propagateInheritedFieldsToChildren`. Currently masked by explicit `Entity.TABLE.equals(...)` fallbacks; a refactor that trusts the generic cascade would regress silently. | `SoftDeleteScript.java:42-45` vs `SearchRepository.java:2478-2480` |
| 13 | `updateAssetDomainsForDataProduct` is **dead code** (zero callers); the live flow uses `updateAssetDomainsByIds`. | `SearchRepository.java:2289-2316` |
| 14 | `EntityCsv.flushPendingSearchIndexUpdates` catch block logs *"will retry individually"* but contains no retry. Narrow gap: the inner bulk path usually self-enqueues first. | `EntityCsv.java:1358-1359` |

### Refuted (worth recording so nobody re-investigates)

- **`LineagePathPreserver` is not a reindex mechanism.** It is a query-time graph-connectivity helper that
  re-adds intermediate nodes when a filtered lineage query would otherwise return disconnected islands.
  Callers are all graph builders. (`AbstractLineageGraphBuilder.java:237,336`)
- **Embeddings are not reindex-only.** `VectorEmbeddingHandler` is a live lifecycle handler
  (`vector/VectorEmbeddingHandler.java:32-71`); scripted partial updates preserve embeddings because they
  only write keys in their own params map; and the bulk sinks **explicitly splice cached embeddings back
  into full-doc replaces or regenerate them** (`ElasticSearchBulkSink.java:337-341,1103-1192`). This is
  important — it is existing precedent for the "carried field" concept in §6.
- **Time-series doc IDs are stable and consistent** across both paths (`entity.getId()`), so no
  orphan/duplication risk for the types reindex actually covers.
- **`applyLiveServingSettings` is called on both promotion paths**, with a hard floor overriding
  `refresh_interval=-1` (`DefaultRecreateHandler.java:121,340,700-728`). This class of bug was found and
  fixed already.
- **Alias swap is atomic** — one `_aliases` call; readers never see a gap or an incomplete index
  (`ElasticSearchIndexManager.java:377-429`).

---

## 2a. Catalogue status (updated 2026-08-04)

Worked through on `mohit/unified-indexing-architecture-279acd`. This section is the record of what
actually happened to each finding, because several turned out to differ from the audit's framing.

| # | Status | Note |
|---|---|---|
| 1 | fixed | `StagedIndexRouting` publishes staged indices cluster-wide via `search_index_job`. The CLI path still cannot, and now warns. |
| 2 | fixed | `STALE_GUARDED_UPDATE_SCRIPT`; the retry worker writes through it. |
| 3 | fixed | The upsert preserves the claim while a row is `IN_PROGRESS`. One narrow window remains, marked in the javadoc. |
| 4, 6 | fixed | Parent-table tags and tier reach column documents on rebuild. |
| 5 | not reachable | A pure table rename records no `columns.*` change, but no table rename/move endpoint exists. Documented at `hasColumnsChanged`; handle column identity when one is added. |
| 7 | fixed | `reindexNestedTerms` rebuilds descendant term documents on an FQN move. |
| 8 | fixed | Lineage SQL dedup survives a rebuild; its `KNOWN_DIVERGENCES` entries are gone, which is the regression test. |
| 9 | **left open, deliberately** | Not a divergence but a missing source: neither `pipelineStatus` nor the `pipelineExecution` documents sharing that index are in `TIME_SERIES_ENTITIES`. The application path only recreates what it rebuilds, so the exposure is the CLI path, which recreates every index and empties this one. `createIndexes()` now names the loss. Building a source that walks pipelines against their status history is a feature, and whether these analytics *should* be reindexable rather than re-ingested is a product call. |
| 10 | fixed (directory), acknowledged (mcp) | `directory` → `worksheet` is swept by FQN prefix — adding the alias would have been a no-op, since worksheet documents carry only `spreadsheet`. `mcpService` → `mcpExecution` leaks nothing today because `McpExecutionRepository` does not set `descendantsCoveredByAncestorCascade`. |
| 11, 12 | fixed | Descendant column soft-delete cascade; synthetic `EntityIndexCapability` for `tableColumn`. |
| 13 | deleted | 225 lines across six files, not the single stray method the audit implied. No caller in Collate either. |
| 14 | fixed | CSV import queues the batch for retry instead of clearing it after a log that promised a retry it never performed. |

**New finding #15, surfaced by building phase 3.** A cascade that changes a child's `tags` leaves
that child's `tagSources` / `tierSources` stale. The cascade runs painless over child aliases;
`TAG_RESEPARATION_SCRIPT` recomputes `tier` / `classificationTags` / `glossaryTags` but not the
label-type counts, and as established above it *cannot* — they are computed from per-column tag lists
the document does not carry. This is pre-existing and independent of anything on this branch; it is
listed here because the projection work is what made it visible. It is sized rather than fixed: the
honest fix is to reproject affected children, which for a tag rename can be a very large number of
documents, so the decision needs the drift numbers (§11.7) to justify the cost. `requiresReprojection()`
is the declaration that stops phase 5 from generating a cascade that silently gets this wrong.

**On `votes`.** The audit and the tolerated-divergence note both read this as a semantic disagreement
needing a product decision. It is not: `SearchIndex.populateCommonFields` already omits `votes` when
`entity.getVotes()` is null, and **both paths run it**. They differ because reindex hydrates from the
explicit `getReindexFieldsFor()` set while live builds from whatever the request fetched — the
hydration row of the §1 table. It is therefore resolved by `ProjectionSpec.alwaysProjected` in phase
3, and patching the projector now would contradict `PopulateCommonFieldsTest.testVotes_nullVotes`.
`descriptionSources` and `usageSummary` remain tolerated on the same reasoning.

**On the validator.** Its transitive check flagged five gaps, four of them covered by a dedicated
cascade. All five are now acknowledged with the covering mechanism named, so the real mapping warns
zero times and a genuinely new gap is visible again. Suppression without a named mechanism is how a
check like this becomes noise nobody reads.

---

## 3. Goals

1. One definition of a search document; a field is derived in exactly one place.
2. Partial updates stay partial, but become *derived* rather than hand-written.
3. Partial coverage becomes the default for every field, not an allowlist of 7.
4. **A full-document rebuild never destroys state it cannot reconstruct** (embeddings, fenced
   relationships, accumulated lineage).
5. **A cascaded write and a rebuilt document converge to the same value.**
6. Derived-field rules and inheritance-conflict rules are declared once, rendered to both Java and painless.
7. Correct-by-default: an undeclared field degrades to a full write, never to a wrong document.
8. Writes are ordered regardless of interleaving, across nodes and across retries.
9. Drift is measurable at runtime.

**Non-goals.** Rewriting the doc builders or mixins. A message bus / transactional outbox (live indexing
is deliberately synchronous post-commit for read-your-write — `SearchIndexHandler.isAsync():152`).
Changing the query/read path. Nested-path partial merges.

---

## 4. The correction the audit forced

My first draft said: *a partial update is the same projection restricted to a subset of doc paths.* That
is right for **derived** fields and wrong for everything else, because it implies `Upsert(ALL)` is always
safe. It is not. A full-document rebuild that overwrites `_source` wholesale would destroy:

- **embeddings** — not derivable from the entity (require an embedding model call)
- **`testSuites` / `testSuitesRevision`** — owned by a fenced writer, deliberately not versioned on the entity
- **`lineageSqlQueries`** — accumulated across edges by the live script

The codebase already knows this and solves it **twice, ad hoc**:

- embeddings: the bulk sink splices cached vectors into the rebuilt doc before writing
  (`ElasticSearchBulkSink.java:1103-1153`)
- fenced relationships: a *second* painless script, `documentUpdateScript`, which is
  **presence-preserving** — if the target doc already carries the field pair, a routine rebuild does not
  touch it at all (`SearchRepository.java:269-285`)

That second script is the piece I was missing. Generalising the fenced-write CAS **without** also
generalising its "ignorant writer" companion would cause exactly the regression it exists to prevent.

---

## 5. Field ownership taxonomy

Every document path is classified into exactly one of three kinds. This is the central new concept.

| Kind | Definition | Rebuild behaviour | Examples |
|---|---|---|---|
| **Derived** | a pure function of the entity (+ its parents) | recompute and overwrite — authoritative | `description`, `owners`, `tags`, `tier`, `fqnParts`, `columns` |
| **Fenced** | owned by a specific writer, ordered by a monotonic ordinal; not versioned on the entity | **never overwritten blindly** — write only under the ordinal CAS; a rebuild that does not hold the ordinal must preserve | `testSuites`+`testSuitesRevision`, `tests`+`testsRevision`, cascade-managed paths (§10), lineage (should be) |
| **Carried** | not reconstructible from the entity at acceptable cost | read-forward from the existing doc, or regenerate | `embedding`, `fingerprint`, `lineageSqlQueries` |

```java
public enum FieldOwnership { DERIVED, FENCED, CARRIED }
```

The rule that makes rebuilds safe:

> `Upsert(ALL)` is authoritative for **DERIVED** paths only. **FENCED** paths are written solely under
> the ordinal CAS. **CARRIED** paths are spliced from the existing document or regenerated — never
> written empty.

This single classification retro-explains the embedding splice, the `documentUpdateScript`, and
divergences #4 and #8 (a `CARRIED`-shaped value — propagated table tags, deduped SQL — being treated as
`DERIVED` and therefore lost on rebuild).

---

## 6. Components

### 6.1 `FieldMask`

```java
public sealed interface FieldMask {
  record All() implements FieldMask {}
  record Subset(Set<String> docPaths) implements FieldMask {}
  boolean covers(String docPath);
  FieldMask union(FieldMask other);
}
```
Top-level doc paths only — a top-level key is replaced wholesale, which is what
`SearchClient.DEFAULT_UPDATE_SCRIPT:42` already does and what makes the write idempotent.

### 6.2 `ProjectionSpec` — field lineage + ownership

Declared next to the index class, so it cannot drift from the builder it describes:

```java
public interface ProjectionSpec {
  Set<String> docPathsFor(String entityField);   // empty ⇒ unknown ⇒ caller must use FieldMask.all()
  Set<String> alwaysProjected();                 // updatedAt, version, ordinal
  FieldOwnership ownershipOf(String docPath);    // DERIVED by default
}
```

### 6.3 `DocumentProjector`

Calls the existing `buildSearchIndexDoc(ctx)`, retains masked paths plus `alwaysProjected`, and **strips
FENCED/CARRIED paths from the result** unless the caller holds the right to write them. Mask-aware mixins
skip work (`LineageIndex.applyLineageFields` is skipped entirely when lineage isn't in the mask) — that
is where the live-path speedup comes from. Correctness never depends on a tight mask.

### 6.4 `DocInvariant` — the answer to `TAG_RESEPARATION_SCRIPT`

Some doc fields are functions of *other doc fields*: `tier`, `classificationTags`, `glossaryTags` all
derive from `tags[]`. Declare once, render twice:

```java
public interface DocInvariant {
  Set<String> dependsOn();               // {"tags"}
  Set<String> produces();                // {"tier","classificationTags","glossaryTags"}
  void applyJava(Map<String,Object> doc);// delegates to ParseTags — existing code
  String painlessPostlude();             // the existing TAG_RESEPARATION_SCRIPT text
}
```

Applied **structurally, never by hand**: the projector runs `applyJava` for every invariant intersecting
the mask; the writer appends `painlessPostlude()` for every invariant intersecting the touched paths,
including cascades. Forgetting becomes impossible because nobody appends anything.

> Two renderings of one rule is unavoidable — painless cannot call Java, and update-by-query is the only
> way to touch a million children without reading them. The design does not pretend otherwise; it makes
> the pair declared together, applied automatically, and asserted equal by a test (§11).

### 6.5 `MutationPlanner`

```
changedFields = names(changeDescription)
if empty                                  → Upsert(ALL)
if any field lacks a ProjectionSpec entry → Upsert(ALL)   // safe fallback, metered
else                                      → Merge(union of docPathsFor(each field))
in all cases: FENCED paths excluded unless an ordinal is held; CARRIED paths spliced or regenerated
```

`PARTIAL_SCRIPT_SUPPORTED_FIELDS` disappears; the allowlist becomes "has a declared lineage", which grows
organically and is CI-tracked.

### 6.6 `IndexWriter` — the only place the two paths differ

| Impl | Used by | Behaviour |
|---|---|---|
| `ImmediateIndexWriter` | live | one `_update`, synchronous post-commit (preserves read-your-write), failures → `SearchIndexRetryQueue` |
| `BulkIndexWriter` | reindex, CSV import, bulk asset ops | batching, back-pressure, circuit breaker, staged routing, stats |

Engine specifics stay behind `SearchClient`. The ES/OS bulk-sink duplication (68 KB / 76 KB, structurally
near-identical per the audit) collapses into one orchestrator plus two thin adapters.

---

## 7. Live and reindex in the new model

```java
// LIVE
indexWriter.submit(List.of(planner.plan(entity, changeDescription, WriteOrigin.LIVE)));

// REINDEX (per batch)
indexWriter.submit(batch.stream()
    .map(e -> planner.plan(e, null, WriteOrigin.REINDEX))   // → Upsert(ALL over DERIVED)
    .toList());
```

Same planner, same projector, same mutation type. A doc-semantics bug becomes impossible to fix in one
path and not the other.

---

## 8. Ordering — generalising what already exists

The audit found precise prior art. `RelationshipRevisionSpec` (`SearchRepository.java:253-320`) is a
**two-tier** mechanism, and both tiers matter:

**Tier 1 — the ordinal CAS** (the fenced writer):
```painless
if (ctx._source.<revField> == null || params.<revField> >= ctx._source.<revField>) {
  ctx._source.<relField> = params.<relField>;
  ctx._source.<revField> = params.<revField>;
}
```
`>=` is inclusive **by design** — replaying the same revision is idempotent rather than silently dropped.

**Tier 2 — the presence guard** (every other writer):
```painless
def preserve = ctx._source.containsKey('<relField>') || ctx._source.containsKey('<revField>');
for (k in params.keySet()) { if (!preserve || (k != '<relField>' && k != '<revField>')) ctx._source.put(k, ...); }
```

The ordinal source is a **DB-side atomic counter**, one row per entity in `entity_extension`, incremented
by a single atomic upsert (`CollectionDAO.java:1592-1613`) — no read-then-write race, safe across nodes.

Generalise exactly this, rather than inventing a scheme:

- **Fenced paths get an ordinal each**, sourced the same way. Do **not** pack `updatedAt`/`version` as I
  first proposed — the audit shows why the ordinal must be independent of entity version (these fields
  are mutated without bumping it).
- **Per-path ordinals, not per-document.** A cascade carries the *parent's* ordinal but writes the
  *child's* doc; a single doc ordinal would discard legitimate cascades whenever the child had a newer
  unrelated edit. Store `_pathOrdinals: { owners: …, domains: …, tags: … }`, only for fenced paths.
- **Tier 2 is mandatory.** Every non-fenced writer — including reindex `Upsert(ALL)` — must carry the
  presence guard, or routine rebuilds will clobber fenced fields.
- **Extend fencing to lineage** (finding #8) and to cascade-managed paths (§10).
- Ordinary self-updates additionally get a document-level ordinal + `external_gte` versioning, which
  closes the retry-clobber race (#2).

---

## 9. Ship first, independently: shared staged-index routing

This is not part of the redesign; it is a standing data-loss bug the redesign would inherit.

**Problem.** `activeStagedIndices` is a JVM-local `ConcurrentHashMap` (`SearchRepository.java:424`).
`registerStagedIndex` is called only by the node running the reindex. Every other node — and every node
when reindex runs from the ops CLI, a separate JVM entirely — resolves `getWriteIndexName()` to the
canonical alias, which points at the **old** index, which is hard-deleted at promotion.

**Fix.** Move the staged-routing table to shared state, since a DB-backed job record already exists and
already carries the staged-index mapping for the bulk pipeline
(`DistributedSearchIndexCoordinator.updateStagedIndexMapping`, persisted). Options, cheapest first:

1. **Read the existing persisted mapping on every node** — have `getWriteIndexName` consult a
   short-TTL-cached view of the job record's staged mapping instead of a local map. Smallest diff; reuses
   state that is already written and already correct.
2. Broadcast register/unregister over the existing WebSocket/event channel — faster propagation, but a
   new consistency surface and a missed message means silent loss again.

Option 1, with the cache TTL bounded well under the promotion window. Plus:

- **Refuse to promote when routing cannot be guaranteed** — if a CLI-triggered reindex cannot observe
  live writers, that is a policy decision (block, or accept and warn), not something to discover in prod.
- **A test.** There is currently none for staged routing at all.

---

## 10. Cascades

A parent's owner/domain/tier/glossary-term/certification/FQN must reach every descendant. Live mutates
children; reindex rebuilds them. Two implementations, never compared.

Re-projecting children is not viable — a service-level owner change fans out to millions of documents, so
`updateByQuery` must stay. Hence two execution strategies with identical semantics:

```java
public record PropagationRule(
    String sourceEntityType,
    String sourceField,
    TargetSelector targets,        // FQN_PREFIX | TAG_FQN | CHILDREN_OF | DOMAIN_ASSETS | TRANSITIVE_DESCENDANTS
    Set<String> targetDocPaths,
    ConflictPolicy conflict,       // OVERWRITE | INHERIT_IF_UNSET_OR_INHERITED
    ExecutionMode mode);           // SCRIPT | REPROJECT
```

| Mode | When | How |
|---|---|---|
| `SCRIPT` | unbounded fan-out, pure copy | one `updateByQuery`; painless **generated** from `targetDocPaths` + `conflict` + `DocInvariant` postludes |
| `REPROJECT` | bounded fan-out, or derived target value (certification — today's `EXTERNAL_HANDLER`) | enqueue IDs onto the same `IndexWriter` with `FieldMask.of(targetDocPaths)` |

`EXTERNAL_HANDLER` disappears. The bespoke `propagateCertificationTags` / `propagateGlossaryTags` /
`propagateToRelatedEntities` handlers collapse into rule declarations.

**The inheritance conflict rule, declared once.** `ConflictPolicy.INHERIT_IF_UNSET_OR_INHERITED` replaces
the painless (`PROPAGATE_ENTITY_REFERENCE_FIELD_SCRIPT`) / Java (`setInheritedFields`) duplication,
rendered to painless for `SCRIPT` and satisfied by the projector for `REPROJECT` and reindex.

**Cascade-managed paths are FENCED** (§5, §8) — that is what makes a cascade and a rebuild converge
instead of racing, and it is what fixes divergence #4 (propagated table tags surviving a rebuild).

**`targets` must be transitive.** `TRANSITIVE_DESCENDANTS` exists because `childAliases` today are
hand-listed and non-transitive, which is finding #10. The rule registry, being declarative, can be
validated for transitive completeness — see §11.

**Reindex consumes the rules for verification**, not execution: they are exactly the list of cross-entity
invariants the drift detector must check.

---

## 11. Validation

The audit confirmed: **no test in either repo compares a live-produced document to a reindex-produced
one.** The closest, `ReindexDocSurvivalIT`, checks ~4 hand-picked single fields. `SearchClientTagScript
SeparationTest` asserts on *script text*; `AddUpdateLineageScriptTest` tests a **hand-maintained Java
mirror** of a painless script, so it stays green while production drifts. Two files' own comments name
this exact gap as unguarded.

### 11.1 Live-vs-reindex document parity IT — the one that matters

```
1. create/mutate an entity via the SDK (live path); await indexing
2. capture the full _source                          → docLive
3. trigger reindex for that entity type
4. capture the full _source again                    → docRebuilt
5. deep-diff with a documented ignore-list (timestamps, _score, ordinals)
6. assert equal
```

Infrastructure exists and needs one new piece:

| Available | Path |
|---|---|
| `OssTestServer.defaultHandle()` / `ServerHandle` | `openmetadata-integration-tests/.../util/OssTestServer.java:23-37` |
| `TestSuiteBootstrap` (Testcontainers ES + OS) | `.../bootstrap/TestSuiteBootstrap.java:365-399` |
| `ReindexHelpers.triggerSearchIndexAndWait` / `recreateAllAndWait` | `.../search/ReindexHelpers.java` |
| `IndexAliasInspector` (resolve alias → index) | `.../search/IndexAliasInspector.java` |
| `ShadowIndex` (clone mapping into a throwaway index) | `.../search/shape/ShadowIndex.java` |
| **Missing:** full `_source` fetch + deep JSON diff | today only single-field fetch exists (`ReindexDocSurvivalIT:250-256`) |

Parameterise over entity type, then over the `PropagationRule` registry for the cascade variant
(mutate parent → compare each child's live doc against its rebuilt doc). Every divergence in §2 becomes a
case; #4, #5, #6, #7, #8 would all have been caught by this single test.

### 11.2 Projection parity property test (build time)

```
merge( project(before, ALL), project(after, maskFor(F)) ) == project(after, ALL)
```
Fails the build when a partial write does not reproduce the full document. Unit-testable, no cluster.

### 11.3 Static completeness checks (CI)

- **Lineage completeness** — every entity field seen in a `ChangeDescription` has a `ProjectionSpec` entry;
  missing ⇒ warn + `search.index.mask.fallback{entityType,field}` metric (the metric is the backlog).
- **`childAliases` transitive completeness** — extend `IndexMappingValidator`, which today checks only
  soft-delete compatibility. Directly catches #10.
- **Capability registration** — fail (not warn) on a child alias with no registered `EntityIndexCapability`,
  and make `null` handling uniform. Catches #12.

### 11.4 Runtime drift detector

Sample N docs/entity-type/hour, re-project from the DB, diff, emit
`search.index.drift{entityType, docPath}`. With repair enabled it becomes a continuous reconciler — the
incremental replacement for "run a full reindex when search looks wrong". Off by default in prod until
its cost is measured.

---

## 11.5 Phase 3 status (landed 2026-08-04, unwired)

The §6 components exist as declarations. Nothing calls them from a write path yet, which is what
§13 intends for this phase — the value is that §11.2 starts reporting before any behaviour changes.

| Component | Where |
|---|---|
| `FieldOwnership` | `search/projection/FieldOwnership.java` |
| `FieldMask` (`All` / `Subset`, top-level keys only) | `search/projection/FieldMask.java` |
| `ProjectionSpec` + `DefaultProjectionSpec` | `search/projection/` |
| `DocInvariant` + `TagDocInvariant` | `search/projection/` |
| `DocumentProjector` | `search/projection/DocumentProjector.java` |
| `MutationPlanner` | `search/projection/MutationPlanner.java` |
| §11.2 property test | `ProjectionParityPropertyTest` |

Two things worth recording, both found by building it rather than by reading:

1. **§11.2 paid for itself immediately.** The first run failed: setting `tags` also changes
   `tagSources` and `tierSources`, which the declared lineage did not list. A partial tag write under
   that declaration would have left both counting the *previous* tag set — the same shape as
   catalogue #4 and #6, caught at build time instead of in a cluster.
2. **The two renderings of the tag invariant are not equivalent, and now it is written down.**
   `tagSources` / `tierSources` are computed by `populateCommonFields`, so a rebuild gets them right,
   but `TAG_RESEPARATION_SCRIPT` does not compute them. They are therefore declared in the spec's
   lineage and deliberately **not** in `TagDocInvariant.produces()`, since claiming them there would
   assert the painless half maintains them. A live cascade leaning on the postlude alone still leaves
   them stale — a phase 5 item, now visible instead of latent.

`TaggableIndex.withoutAppliedAt` was widened from private to an interface static so the invariant
strips `appliedAt` through it rather than copying it. A second copy of that rule is exactly the drift
this phase exists to remove.

### The `tagSources` finding, resolved — and it changes §11.2's conclusion

The obvious fix for the asymmetry above was to teach `TAG_RESEPARATION_SCRIPT` to compute the two
counts. That fix is **wrong**, and the reason is worth keeping:

`SearchIndexUtils.processTagAndTierSources` counts the entity's tags *and each column's tags
separately*, summing repeats — a tag on three columns contributes three. The document's `tags` array
is the output of `mergeChildTags`, which dedupes by `tagFQN`, so that same tag appears once. The
pre-dedup per-column structure the counts derive from **is not in the document**, so no
update-by-query recovers them however carefully written. Scripting them would yield numbers that look
right and are wrong on every column-bearing entity, which is worse than not scripting them.

So they are declared `requiresReprojection()`: paths a cascade must rebuild rather than script. This
is §14's "choosing SCRIPT where REPROJECT was needed yields a stale derived field", now a declaration
the planner can act on instead of a hazard someone has to remember. **Phase 5 must honour it** — a
rules-driven cascade that only generates painless cannot maintain these paths at all.

## 11.6 Phase 4 gate (landed 2026-08-04, off by default)

`ProjectionRollout` is the flag phase 4 flips, and what it currently enables is *shadow* comparison
only: `canUseScriptedPartialUpdate` records what the declared-lineage planner would have decided
beside what the live path did decide, and the live path's decision still executes unchanged.

The counters (`search.index.projection.shadow`) exist because "partial coverage goes from 7 fields to
all declared fields" is an assertion until it is measured on real traffic — `narrowed_where_full` is
the win, `widened_where_partial` means a lineage is probably missing, and `reprojection_required`
counts masks that reach the unscriptable paths above. Reading the flag once at class init is
deliberate: this is the hottest write path, and a per-write property lookup would cost more than the
feature saves.

What phase 4 still owes, and why it is not done here: deleting `getScriptWithParams` and
`PARTIAL_SCRIPT_SUPPORTED_FIELDS` cannot happen while the flag can be off, and flipping it is a
per-entity-type rollout decision that wants the shadow numbers first. The mechanism is in place; the
judgement call is not mine to make.

---

## 11.7 Phase 7 drift detection (landed 2026-08-04, off by default)

`SearchDriftDetector` + `DocumentDrift`. Given a stored document and its entity, re-project and emit
`search.index.drift{entityType, docPath}` for each path that disagrees. **Detection only — nothing
writes to the index.** Off by default via `openmetadata.search.projection.drift`, because
re-projecting sampled documents is real work on a live node and the design asks for its cost to be
measured before it runs in production.

Two rules keep it usable, and both are the difference between a detector people read and one they mute:

- **Absent / null / empty are equivalent.** The two write paths genuinely disagree about materialising
  empty collections, in both directions, and that is not drift a user can see.
- **Paths outside `REBUILD_AUTHORITY` are never reported.** An `embedding` cannot be reconstructed and
  a fenced ordinal is not the projector's to hold, so those always differ — reporting them would fire
  on every sampled document and bury the real findings.

What is deliberately not here: the sampler (N docs/entity-type/hour) and the repair path that turns
this into a continuous reconciler. Detection is the half that carries no risk; a background sampler is
app-level scheduling, and repair writes to the index, so both want the detection cost measured first.

---

## 12. Collate extension contract

The redesign must preserve or deliberately replace these seams — Collate's entire search surface is 9
files, so the contract is small but load-bearing:

| Seam | Kind | Consumer |
|---|---|---|
| `SearchRepositoryProvider` SPI + `ServiceLoader` priority (Collate 100 > OSS 0) | SPI | `CollateSearchRepositoryProvider` |
| `SearchRepository.buildSearchClient()` / `buildIndexFactory()` — **invoked from the base constructor** | overridable | `SearchRepositoryExt` |
| `SearchIndexFactory.buildExternalIndexes()` — the only non-OSS entity dispatch seam | protected hook | `CollateSearchIndexFactory` (4 AI entity types) |
| `IndexMappingLoader`'s **hardcoded** `elasticsearch/collate/indexMapping.json` classpath | convention | mandatory; the one place OSS knows Collate by name |
| `SearchClient.listPageHierarchy*` — OSS-documented `NOT_IMPLEMENTED` stubs | designed override | `*ClientExt` |
| `ElasticSearchClient`/`OpenSearchClient` query methods (`search`, `searchForExport`, `searchWithNLQ`, …) | overridable | `*ClientExt` + `AiVisibilityQueryFilter` |

Notes:
- Collate overrides **no write/index/delete path** — only construction, entity-type dispatch, and query
  shaping. The redesign is therefore low-risk for Collate provided the constructor hooks survive.
- `SearchRepositoryExt.deleteOrUpdateChildren`'s Page branch is now **redundant** — OSS absorbed the same
  `case Entity.PAGE -> deleteEntityByFQNPrefix(entity)`, so every Page delete runs it twice. Delete the
  override rather than preserve it.
- `VectorBodyTextContributor` and `RecreateIndexHandler` are available extension points Collate does not
  use; Collate's 4 AI entity types consequently get default description-based embedding text.
- Collate's admin "Live Indexing" page reports `queueDepth=null` / `failures=[]` with a comment saying the
  data isn't queryable — **stale**: OSS now has `search_index_retry_queue` plus
  `GET /apps/name/{name}/live-indexing-queue`. Cheap follow-up, out of scope here.

---

## 13. Migration

| Phase | Change | Value on its own | Risk |
|---|---|---|---|
| **0a** | **Shared staged-index routing (§9) + a test** | closes confirmed multi-node / CLI data loss | low, isolated |
| **0b** | Document ordinal + `external_gte` on self-writes; fix retry-queue claim reset (#3) | closes retry-clobber race | low |
| **1** | `PropagationRule` + `FieldOwnership` registries — **declaration only**, existing handlers still execute; build the parity IT harness (§11.1) | **makes the §2 catalogue reproducible and regression-tested before any refactor** | none |
| **2** | Fix the P1 divergences individually against that harness (#4–#8) | user-visible bugs fixed, independent of the refactor | low each |
| **3** | `FieldMask` / `ProjectionSpec` / `DocumentProjector` / `DocInvariant`; planner behind a flag | §11.2 starts reporting | none (flag off) |
| **4** | Flip the flag; delete `getScriptWithParams` + `PARTIAL_SCRIPT_SUPPORTED_FIELDS` | partial coverage 7 → all declared fields; live writes cheaper | medium, gated by §11.2 |
| **5** | Cascades execute from rules; painless generated; `EXTERNAL_HANDLER` + bespoke handlers removed | one cascade model | medium, gated by §11.1 |
| **6** | `IndexWriter` split; ES/OS bulk sink dedup | ~100 KB duplicated code deleted | medium, mechanical |
| **7** | Drift detector + continuous reconciler | full reindex stops being the standard remedy | low, additive |

Ordering rationale:
- **0a/0b are not this project.** They are standing bugs; ship them now.
- **Phase 1 buys measurement before refactoring.** The harness costs little, changes nothing, and turns a
  list of audit claims into a red test suite. Phase 2 then fixes real user-visible bugs *without* the
  architecture work — which is what makes this proposal fundable even if phases 3–7 slip.
- Phases 4 and 5 are the payoffs, and both are net deletions.

---

## 14. Trade-offs

- **Masked projection can still cost DB reads.** Mitigated by mask-aware mixin skipping and
  `DocBuildContext` prefetch. Net effect should be positive: today most updates take the *full-doc
  fallback* because only 7 fields avoid it.
- **`ProjectionSpec`/`FieldOwnership` is metadata that can rot.** Countered by §11.2/§11.3, and by rot
  being *safe* — a missing entry degrades to a correct full write.
- **Cascades keep two renderings of one rule.** Unavoidable; the claim is only that they are declared
  together, applied automatically, and asserted equal.
- **Choosing `SCRIPT` where `REPROJECT` was needed yields a stale derived field** — caught by §11.1 only
  if the rule is in the registry, which is why the IT is parameterised over the registry.
- **Phase 4 changes the hottest write path in the product.** Flag, per-entity-type rollout, drift metric
  as canary.
- **`FieldOwnership` adds a concept.** Justified by three existing ad-hoc solutions to the same problem
  (embedding splice, `documentUpdateScript`, tier fallback) that currently share no vocabulary.

---

## 15. Summary

| | Today | Proposed |
|---|---|---|
| Doc definition | 3 (projector + self painless + cascade painless) | 1 declaration, 2 renderings, asserted equal |
| Field ownership | implicit; solved ad hoc 3× | explicit `DERIVED` / `FENCED` / `CARRIED` |
| Partial coverage | 7 fields, hand-allowlisted | all fields with declared lineage |
| Derived fields (`tier`, …) | painless copy of `ParseTags`, pasted by hand | `DocInvariant`, applied structurally |
| Inheritance rule | written twice (Java + painless) | declared once |
| Cascade ↔ rebuild agreement | never compared | parameterised IT over the rule registry |
| Write ordering | 2 fenced fields only | generalised ordinals + mandatory presence guard |
| Staged routing | process-local ⇒ **data loss** | shared state + test |
| Drift detection | none | metric + continuous reconciler |
| Net code | — | expected net **deletion** |
