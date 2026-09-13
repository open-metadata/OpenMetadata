# Entity repository composition

The shared repository and updater inheritance have been replaced by composed
application services and entity policies. `EntityRepository`,
`ServiceEntityRepository` and `ColumnEntityUpdater` are removed. The common
repository originally contained 13,569 lines; the extracted package contains
209 components, with the largest at 493 lines.

The code migration is implemented. Coverage and latency acceptance remain separate
gates; see [current verification status](entity-repository-status.md). This document
describes the resulting architecture. Java extension authors should also read the
[module migration guide](entity-module-migration.md).

## Module construction and boundaries

An entity family implements the open `EntityPolicy<T>` SPI. A policy owns one
`EntityPolicyContext<T>`, containing schema metadata, configured field capabilities,
infrastructure dependencies and the constructed service graph. The 74 former direct
repository subclasses implement this interface.

`EntityModuleFactory.initialize` binds and assembles a policy once. Seven startup
assemblies construct storage, metadata, queries, commands, deletion, bulk and
mutation services in dependency order. Registration retains the existing named
priority rules. Requests reuse those components rather than constructing another
graph. Independent module tests can provide their own retained DAO graph.

| Boundary | Responsibility |
| --- | --- |
| Queries and hydration | ID/FQN reads, reference projections, pagination, shared field loading and inheritance |
| Commands and update engine | Create/PUT/PATCH orchestration and ordered entity-specific mutations |
| Change tracking and history | Change descriptions, consolidation, versions and historical snapshots |
| Store | Canonical storage projections and reusable serialized write results |
| Unit of work | One owning transaction per existing flush, retries and deferred effects |
| Metadata services | Relationships, tags, certification, extensions, ownership and governance |
| Deletion, bulk and CSV | Traversal, dependent cleanup, restore, imports, reconciliation and jobs |

The native `EntityModule<T>` interface exposes common operation ports such as
`reads()`, `pages()`, `creates()`, `puts()`, `patches()`, `persistence()` and
`bulk()`. Generic consumers use `Entity.getEntityModule(type)`; entity-specific
consumers can obtain a typed policy. Domain operations such as table profiling
remain in the corresponding entity implementation.

REST endpoints, authorization, stored JSON, history and observable completion
behavior are compatibility requirements. Java extensions must recompile against
the new interfaces.

## Component inventory

| Component | Current implementation |
| --- | --- |
| Canonical entity lookup | `EntityLookupService`, preserving L1-first reads and negative-cache ordering |
| Search-result pages | `EntitySearchReader`, preserving subject filters, search order, follower normalization and count-only responses |
| Detail read orchestration | `EntityReader` and `EntityReadService`, preserving request aliases, fresh scopes and hydration ordering |
| Collection reads | `EntityCollections` and `EntityCollectionReader`, preserving ID/FQN order, bulk projections, CSV hydration and parent-range filters |
| Time-series metadata | `EntityTimeSeries`, preserving retained DAO access, inclusive windows, ordering and per-series batch limits |
| Shared detail hydration | `EntityMetadataHydrator`, preserving field order, relation includes and entity-specific read/clear hooks |
| Metadata read assembly | `EntityMetadataReads`, one startup graph for reference fields, batch projections, votes and shared hydration |
| Inheritance and votes | `EntityInheritanceReader`, `EntityVoteReader`, and batch container/parent policies |
| Shared metadata writes | `EntityMetadataWriter`, preserving validation, retained DAO access and lineage ordering |
| Metadata persistence policies | `EntityMetadataPersistence`, immutable single/bulk/cleanup sequences that run inside the owning transaction |
| Batch field assignment | `EntityBatchFields`, preserving input order, duplicate IDs, missing-value clearing and excluded-field behavior |
| Bulk field dispatch | `EntityFieldLoading`, preserving shared relationship/tag hydration before entity-specific field policies |
| Ownership persistence and user actions | `EntityOwnershipWriter`, `EntityUserActions`, preserving full requested sets, follower propagation and vote events |
| Shared metadata cleanup | `EntityMetadataCleanup`, retaining tag-first deletion and 500-ID relationship batches |
| Asynchronous bulk jobs | `EntityBulkJobs`, bounded active work and completed history using the existing executor |
| Bulk tag removal | `EntityTagAssetRemoval`, publishing metadata invalidation before search after commit |
| Bulk asset membership | `EntityAssetMembership`, preserving validation, relationship effects and the post-write audit source |
| Update lifecycle | `EntityMutationLifecycle`, retaining owning flushes, snapshot replay and cache publication |
| Native updater API | Final `EntityUpdater`, `EntityOperation`, and `EntityUpdateContext`, replacing nested repository types |
| Entity-specific mutation policies | `EntitySpecificMutation` and `EntityColumnMutation`, replacing all updater subclasses; `EntityColumnUpdater` shares the owning mutation's state |
| Service policies | `EntityServicePolicy`, `EntityServiceOperations`, `EntityServiceMutation` and `EntityServiceAssembly`, replacing the service repository base |
| Mutation policy assembly | `EntityMutationPlan`, preserving normal/import field order and entity-specific dispatch |
| Ordered field mutations | `EntityMutationPipeline`, an immutable startup policy sequence shared by normal and import updates |
| Seed initialization | `EntitySeedResources`, `EntitySeedInitializer`, preserving resource order, startup gating and creation policies |
| Nested field tags | `EntityFieldTagReader`, preserving exact-FQN batches without hashing mutable entity graphs |
| Detail reads | `ReadPlanner`, `ReadBundleLoader`, `RelationshipReadLoader`, `RelatedEntityResolver` |
| Bulk relationship projections | `BulkRelationshipLoader` with `BulkRelationshipField` assignment policies |
| Relationship reference queries | `EntityRelationshipReader`, preserving Include, orphan and container-cache policies |
| Relationship field projections | `EntityRelationshipFields`, `ReadBundleAccess`, preserving capability, null/empty and Redis coverage policies |
| Entity-specific batch references | `EntityBatchReferenceReader`, preserving direction, duplicate and last-parent rules |
| Relationship persistence and differences | `EntityRelationshipWriter`, `EntityRelationshipUpdates`, with retained DAOs and deterministic write order |
| Authorization and inheritance metadata | `EntityAccessMetadataReader`, shared owner/domain queries with separate reference filters |
| Table column metadata | `TableMetadataLoader` |
| Canonical row persistence | `EntityStore`, `StorageProjection`, immutable `StoredEntity` write results |
| Cache state and invalidation | `EntityCaches`, bounded local caches/epochs, Redis loaders, invalidation policies and rename/tag targets |
| Cache publication | `EntityCacheWriter`, bounded `CachedEntityDao` pipeline batches |
| Version reads | `EntityVersionHistory`, `EntityHistoryQuery`, `HistoryCursor` |
| History assembly | `EntityHistoryServices`, one startup composition of history reads, persistence and change policies |
| Attribution persistence | `EntitySummaryWriter`, a locked metadata projection and JSON-field update inside the retained transaction |
| Pagination and row hydration | `EntityPageReader`, `EntityCursor`, `EntityRowReader` |
| Native paging policies | `EntityPages`, `EntityPagePolicy`, preserving task domain filtering before counts and ingestion-pipeline directional sorting |
| Custom properties | `CustomPropertyValidator`, `EntityExtensionService` |
| Tags and certification | `EntityTagReader`, `EntityCertificationService`, `DerivedTagLoader` |
| Update selection and consolidation | `PatchFieldSelection`, `SessionConsolidationPolicy` |
| Update lifecycle and replay | `EntityUpdateWorkflow`, `EntityMutationState`, `EntityUpdateSnapshot`, `EntityUpdateStore` |
| Change recording and history writes | `EntityChangeRecorder`, `EntityChangeSummary`, `ChangeSummarizer`, `EntityVersionPolicy`, `EntityVersionStore` |
| Inheritance | `EntityInheritanceLoader`, `InheritedReferences` |
| Custom-property mutations | `EntityExtensionUpdater` |
| Column mutations | `EntityColumnUpdates`, `ColumnValueUpdater`, `ColumnMatchIndex` |
| Tag mutations | `EntityTagUpdates`, `EntityTagWriter` |
| Shared value mutations | `EntityValueUpdates`, preserving sanitization, bot permissions and lifecycle version rules |
| Ownership reconciliation | `EntityOwnershipUpdates`, preserving distinct PUT, import and inherited-reference rules |
| Reference validation | `EntityReferenceValidator`, preserving validation order, Include and mutable-reference contracts |
| Governance mutations and review decisions | `EntityGovernanceUpdates`, `EntityReviewerPolicy`, preserving bot guards, lineage and approval rules |
| Certification mutations | `EntityCertificationUpdates`, preserving cleanup, settings and calendar-period expiry |
| PUT/PATCH commands | `EntityPutService`, `EntityPatchService`, `EntityPatchPreparation`, `EntityUpdateCommand` |
| Native PATCH consumers | `EntityPatches`, preserving ID/FQN targeting, ETags, change source and impersonation without repository adapters |
| Creation and prepared imports | `EntityCreationService`, `EntityCreateWorkflow`, `EntityImportService`, `EntityImportBatch` |
| Input preparation | `EntityPreparation`, preserving tag, entity, name, extension and status order; bulk resources reuse the prepared name |
| Schema field selections | `EntityFieldPolicy`, preserving strict/supported parsing, startup field changes, mutable selections and common write/summary defaults |
| Lifecycle projections | `EntityLifecyclePublisher`, preserving creation deduplication, update ordering, RDF, count and owning-commit policies |
| Canonical JSON capture | `StoredEntityCapture`, one pending row per thread with identity, publication and failure guards |
| Deletion dependents | `EntityDependentCleanup`, `EntityFeedCleanup` |
| Hierarchy and hard deletion | `EntityHierarchy`, `EntitySubtree`, `EntityHardDeletion` |
| Child-deletion eligibility | `EntityChildDeletion`, preserving recursive guards, shared-child preparation and entity-specific deletion hooks |
| Canonical hard-delete flush | `EntityPurge`, retaining one transaction for metadata and row deletion, deadlock replay and post-commit workflow cancellation |
| Deletion persistence assembly | `EntityDeletionPersistence`, retained dependent-row cleanup, purge and workflow publication |
| Deletion reads | `EntityDeletionReader`, tolerating dangling references while propagating unrelated failures |
| Atomic subtree updates | `EntitySubtreeUpdates`, `EntityDeferredUpdate` |
| Restore and subtree orchestration | `EntityRestoreService`, `EntitySubtreeLifecycle` |
| Single deletion and workflow cleanup | `EntityDeletionService`, `EntityDeletionGuard`, `EntityWorkflowCleanup` |
| Rename references | `EntityWorkflowReferences`, retaining ordered task batches and one workflow-subtree update in the owning flush |
| Mutation permissions | `EntityMutationPermissions`, one bounded operation snapshot per updater |
| CSV summary history | `CsvImportSummary`, `EntityCsvChangeLog` |
| Bulk update flushes | `EntityBulkUpdateService`, `EntityBulkMutation` |
| Bulk metrics | `EntityBulkMetrics`, fixed lazy meter references |
| Mixed bulk requests | `EntityBulkService`, create/update partitioning, fallback and duplicate reloads |
| Command feed events | `EntityEventService`, masked bulk and asynchronous events |
| Stale ingestion reconciliation | `EntityStaleDeletion`, `StaleEntityPlanner` |
| Transaction lifecycle | `EntityUnitOfWork`, `EntityPostCommitEffects`, `DeferredCacheInvalidations` |

## Mutation ownership and Java 21

All 69 former updater subclasses supply `EntitySpecificMutation<T>` or
`EntityColumnMutation<T>` behavior to the final `EntityUpdater<T>`. Shared column
logic lives in `EntityColumnUpdater`. The 13 service families implement
`EntityServicePolicy` and compose service preparation, connection handling and
lifecycle operations through `EntityServiceOperations` and `EntityServiceMutation`.

Shared services and the ordered `EntityMutationPipeline` are assembled once.
Mutable entity snapshots, change descriptions and version flags belong to the
request's mutation. Entity-specific guards reset on retry. Policies read the current
original/updated entities from the owning mutation because consolidation can replace
them. Service-connection policies are stateless and can be reused by their module.

The architecture uses capability composition, local command/query separation,
an explicit Unit of Work and snapshot-based replay. It retains the existing
Strategy, Observer and executor infrastructure.

Java 21 records carry request options, projections, stored JSON and mutation
configuration. The sealed PATCH target variants support exhaustive ID/FQN dispatch.
Sequenced collection accessors replace index arithmetic where order matters, and
scoped resources clean up request/transaction state. Extension interfaces remain
open; preview language or concurrency APIs are not required. Cache identity and
its FQN payload remain separate where their equality semantics differ.

## Single transaction is mandatory

Within each existing mutation flush, entity rows, relationships, extensions and
version history commit or roll back together. Moving a method into another component
does not introduce an independent transaction or acquire another handle for its writes.
Existing bulk chunks remain the atomicity boundaries.

`EntityUnitOfWork` preserves the retained `CollectionDAO.inTransaction` binding
needed by the on-demand DAO graph. Multi-repository operations enter through
`persistence().execute`. Nested commands participate in their enclosing transaction;
the outer owner controls rollback and deadlock replay.

A retry restores entity contents, caller-visible identity, changes and entity-specific
guards from the captured baseline. Deferred effects from failed attempts are discarded
or rewound to the enclosing checkpoint. Optimistic conflicts preserve their response
semantics.

Required cache invalidation, RDF, lineage/search publication and post-commit actions
run in their established order after the owning commit and database-handle release.
Required synchronous work completes before the response. Asynchronous operations retain
their acknowledgement, retry and completion behavior.

Bulk metadata/history/row writes share one mutation commit. The existing best-effort
feed insertion remains a separate post-commit batch; a changed bulk request therefore
has one mutation commit and one feed commit. CSV summary audit persistence and asset
membership audit events have different failure semantics and share their owning write
transaction. Empty membership requests and dry runs avoid a write transaction.

Hard-delete not-found markers and external workflow cancellation join post-commit
publication, so an enclosing rollback preserves rows, cached aliases and workflow
lifetime. Subtree soft-delete and restore write each level's metadata, history and
rows through the owning flush. Per-entry bulk fallback reconstructs mutation state
after a rolled-back attempt.

## Avoid repeated work

- Column metrics load once per requested table batch and group by column. Column
  extensions use exact stored keys in bounded batches, including legacy records.
- Related entity IDs are resolved together across requested fields and directions,
  grouped by entity type, effective Include and DAO chunk.
- Tags and certification share applicable tag-usage rows. Derived glossary labels
  load in batches while retaining each entity family's strict or graceful failure policy.
- Redis bundles load only missing coverage. Broader cached projections survive
  narrower reads, including loaded-empty and loaded-null states.
- Request-cache projections normalize once and share one immutable JSON snapshot
  across ID/FQN aliases. Returned entity objects remain independently mutable.
- Applicable bulk cache publication reuses the exact committed storage JSON.
  Invalidation-only paths continue to avoid serialization and recaching.
- Later history pages check current-entity existence without hydrating unrelated
  current fields. Attribution-only changes lock a small metadata projection and
  update the change-description JSON field.
- Bulk preparation reuses canonical names and bounds loaded parents to the DAO's
  existing IN-list chunk limit. Larger inputs group common parents for preparation,
  then preserve original input order for authorization and writes.
- Change recording compares values before serializing unused diff payloads.
  Empty custom-property diffs skip deletes/inserts, and hard deletion avoids
  deleting extension rows again through per-property cleanup.
- Existing source-hash no-op shortcuts, authorization reuse, list batching and
  retry snapshots remain in the operation paths.

The [performance record](entity-repository-performance.md) distinguishes deterministic
work reductions from measured elapsed latency.

## Redis contract

The cache layer retains its keys, value formats, configured limits/expiry, excluded
entity types, negative caching, bypass scopes and cross-instance invalidation.
L1 caches and write epochs remain bounded; request snapshots retain the 50-entry bound.

Complete bundle hits remain lock-free. Partial fills use the existing striped
coordination and conditional publication. A concurrent publication conflict declines
replacement instead of overwriting newer coverage or retrying without a bound.
Expiry-only refresh does not recreate an invalidated key. Unsupported providers
decline conditional replacement.

Indirect changes evict local entries and defer shared invalidation to the owning
commit. Once shared eviction finishes, epochs advance and local ID/FQN aliases are
evicted again to remove a previous committed value loaded during the write. Request
entries are discarded too. A failure for one shared-cache invalidation does not skip
local eviction for later entities in the committed batch.

Bulk JSON results are collected per transaction attempt. Failure discards them,
replay collects fresh results, and nested scopes restore their enclosing collector.
Publication remains deferred to the owning commit, in batches of at most 100 entities.
Bypass is evaluated at publication time. Both aliases keep their JSON and configured
TTL; Redis failures retain the existing fallback and best-effort publication behavior.

## Verification and acceptance

Regression evidence must identify the exact artifact. The current results and
outstanding gates are recorded in [implementation status](entity-repository-status.md),
rather than inferred from earlier intermediate builds.

Real database tests cover one-commit success, failures after SQL execution, deadlock
replay, enclosing rollback, cache publication, optimistic conflicts, service secrets,
import overrides, subtree cleanup and API aliases on MySQL and PostgreSQL.
The class coverage requirement remains 90% for changed/new Java classes unless the
user explicitly approves an exception.

The frozen runtime baseline is the task-start snapshot
`b50e9277f9655df9e43138e24216180cb57371cd`. It is distinct from the later
`origin/main` revision named in the saved plan. Worktree diffs use the branch
merge-base so incoming upstream changes are not mistaken for this task's changes.

Latency comparisons use separate baseline/candidate processes, identical fixtures
and configuration, durable database storage and a separate version-neutral HTTP client.
Timed runs exclude builds, regression suites, coverage agents and profiling.

Acceptance requires five alternating pairs after warmup with sufficient tail samples.
It includes detail/list/history reads, creates, changed/no-op PUT, scalar/column PATCH,
conflicts, changed/unchanged/mixed bulk operations, duplicates, metadata overrides,
delete/restore and CSV jobs. Async submission and observed completion are measured
separately. Cache modes and offered-load comparisons, including overload recovery,
remain part of the saved acceptance plan.

A repeatable per-workload p50/p95/p99 regression, worse throughput or worse error
behavior prevents latency sign-off. Unstable measurements are inconclusive. SQL,
commits, pool waits, Redis traffic, allocation, GC and backlog explain changes;
they do not substitute for end-to-end response measurements.
