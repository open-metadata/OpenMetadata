# Entity modules and Java extension migration

The shared `EntityRepository` implementation has been retired from the worktree.
See [implementation status](entity-repository-status.md) for the verified artifact
and outstanding regression and performance gates.

## Construction and responsibilities

An entity family implements `EntityPolicy<T>`. Its `EntityPolicyContext<T>` holds
the schema, write-field selections, infrastructure dependencies and native service
graph. `EntityModuleFactory.initialize(policy, registerEntity)` binds the policy
once, constructs the components in dependency order, and registers the completed
graph when requested. Calling it again fails before replacing any components.

The factory groups are deliberately small:

| Assembly | Responsibility |
| --- | --- |
| `EntityStorageAssembly` | Canonical lookup, retained transaction boundary, row persistence, seed creation |
| `EntityMetadataAssembly` | Relationships, tags, certification, extensions, ownership and metadata hydration |
| `EntityQueryAssembly` | Detail/list/paging policies, inheritance, history and shared projections |
| `EntityCommandAssembly` | Preparation of PUT/PATCH, create and import commands |
| `EntityDeletionAssembly` | Delete, subtree traversal, restore and dependent cleanup |
| `EntityBulkAssembly` | Bulk updates, jobs, stale reconciliation and CSV change history |
| `EntityMutationAssembly` | Ordered mutation policies and lifecycle publication |

These components are constructed at startup. Requests reuse their immutable
operation records and callbacks. They do not construct a graph or search for an
entity policy for each field. `EntityModuleServices` exposes component references;
only the assembly package can assign them during construction.

Entity policy interfaces group the variable operations: read, inheritance,
mutation, metadata, deletion, lifecycle, bulk and seed behavior. Their defaults
preserve the established behavior. Shared private callbacks live outside the
policy interfaces so a similarly named entity method cannot accidentally override
an implementation detail. An entity can still supply its own ordered updater,
parent selection, CSV matching or field projection.

## Migrating an entity family

Use [ChartRepository](../openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/ChartRepository.java)
as a complete example.

1. Replace `extends EntityRepository<T>` with `implements EntityPolicy<T>`.
2. Keep an explicit `@Repository` annotation. Preserve an existing registration
   name and priority; the registry continues to use the same priority rules.
3. Construct one `EntityPolicyContext` from `Schema`, `WriteFields` and
   `EntityModuleDependencies`. Production can use `EntityModuleDependencies.standard()`;
   independent module tests can inject their retained DAO graph directly.
4. Implement `context()` and initialize the module once in the constructor.
   Keep registration disabled for a deliberately unregistered test policy.
5. Make policy implementations public. Implement the entity's preparation,
   storage, relationship, read and clear operations. Preserve overrides for
   inheritance, import matching, paging and ordered update behavior.
6. Configure quoting, renaming, search and ancestor-cascade options through
   `context().options()`. Register additional field fetchers through `fieldLoading()`.
7. Replace a call to a former base implementation with the corresponding
   `EntityPolicy.super` default when the class implements the interface directly.

Service entities implement `EntityServicePolicy<T, S>`, retain their own
`EntityPolicyContext`, and compose `EntityServiceOperations` through
`EntityServiceAssembly.create`. See `McpServiceRepository` for a small example.
The shared component handles connection preparation, pipeline hydration, test
connection results and service cleanup. `ServiceEntityRepository` is removed.

Entity-specific updaters implement `EntitySpecificMutation<T>` and are supplied
to the final `EntityUpdater` constructor. Their `update` method receives the
owning mutation, including the current original/updated snapshots and change
recorder. Always read those snapshots from the mutation: consolidation can replace
them. Reset any per-attempt guards in `reset()` so a rolled-back rename or cascade
runs again on retry. `ChartRepository` demonstrates an ordinary mutation policy;
`GlossaryTermRepository` demonstrates retry guards and consolidation policy.

Column-bearing policies implement `EntityColumnMutation<T>` and compose an
`EntityColumnUpdater` with the same owning mutation. Table lineage overrides run
through that policy. Service connection updates use the stateless
`EntityServiceMutation`; the security service composes it with its additional
field changes. Policies participate in the existing owning flush and never open
a second transaction or publish cache effects before its commit.

The registry's typed policy accessor remains `Entity.getEntityRepository(type)`.
Code needing only common operations should use `Entity.getEntityModule(type)`.
Java extensions need recompilation against the new policy types. HTTP endpoints,
stored JSON, field/include semantics and response contracts remain compatibility
requirements.

## Native operation ports

| Work | Port |
| --- | --- |
| ID/FQN detail reads | `reads()` |
| Canonical rows and reference lookups | `lookup()` |
| ID/name collections and CSV projections | `collections()` |
| Keyset and offset pages | `pages()` |
| Entity preparation | `preparation()` |
| Create and create-or-update | `creates()` |
| PUT and PATCH | `puts()`, `patches()` |
| Import matching, canonical actor upsert and prepared batches | `imports()` |
| Storage projection and canonical JSON capture | `persistence()` |
| Metadata writes and cleanup | `metadata()` |
| Delete, restore and subtree operations | `deletes()`, `restores()`, `subtrees()` |
| Mixed bulk requests, async jobs and stale deletion | `bulk()` |
| Versions, history and attribution summaries | `versions()`, `history()`, `summaryWrites()` |
| Relationship/tag/extension projections and mutations | `relationships()`, `relationshipWrites()`, `tags()`, `tagWrites()`, `extensions()` |

Use the typed request records for the operation. In particular, retain the
distinction between normal import policy upsert and explicit-actor canonical
upsert, and between ID/FQN PATCH arguments for ETags and impersonation.

Offset consumers that formerly supplied row/count functions to `listWithOffset`
now call `pages().offset(OffsetPage, OffsetSource)`. The page record carries the
projection, limit, encoded cursor and error policy; the source carries the existing
row and count functions. Preserve a known job total by returning it from the count
function. `PaginatedEntitiesSource` demonstrates this for ordinary and resumed
pages without another count query. `RdfIndexApp` demonstrates the DAO count variant.
Consumers that already have their rows construct `ResultList` directly, preserving
the cursor or offset constructor they previously used.

## Transactions, retries and caches

The owning command determines the existing flush boundary. A policy hook joins
that boundary; moving the hook to another component does not add a transaction.
`EntityUnitOfWork` retains the original `CollectionDAO` so its child SQL objects
join the same handle. Operations spanning module DAOs use `persistence().execute`.
Normal commands continue using their owning flush. Atomicity remains per existing
bulk chunk, with the existing best-effort post-commit feed behavior where applicable.

Deadlock retries recreate mutation state from the captured snapshot. An enclosing
transaction owns the retry and rollback of its nested work. History and entity
rows cannot commit independently when they belong to the same flush.

Redis publication, alias invalidation and other deferred effects run after the
owning SQL commit. Rollback discards them. The ID/FQN L1 caches, request projections,
Redis keys, negative-cache semantics, epochs and bypass behavior stay in the shared
cache runtime. Cache-disabled and invalidation-only paths remain supported.
Canonical stored JSON can be reused for cache publication without serializing the
entity a second time.

Bulk preparation uses `bulkPreparation().prepare(...)`. Its parent cache is capped
at the existing SQL `IN` chunk size, 30,000 parents, and cleared on success or
failure. Larger inputs prepare groups sharing the same parent snapshot so a parent
is not fetched repeatedly. Preparation hooks validate and normalize entities;
authorization and writes receive successful rows in original input order. This
does not change the existing transaction boundaries or last-write-wins ordering.

## Verification

`EntityModuleFactoryTest` constructs a record policy without repository inheritance
or startup database reads, verifies independent injected canonical rows, and rejects
a second initialization. The existing behavioral suites cover entity-specific policy
dispatch and native consumers.

The real-database suites include failures injected after SQL execution, enclosing
rollback, deadlock replay, canonical cache publication, optimistic conflicts and
subtree cleanup on MySQL and PostgreSQL. Their results must identify the tested
artifact. A clean build is required when retiring the base class so stale bytecode
does not remain in the packaged JAR.

The final coverage and latency requirements are separate from compilation and file
size. Consult the [performance record](entity-repository-performance.md) for measured
SQL reductions and valid paired timings, and the status page for gates still open.
