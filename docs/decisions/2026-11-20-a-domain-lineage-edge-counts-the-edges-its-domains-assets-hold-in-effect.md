# A domain lineage edge counts the edges its domains' assets hold in effect

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial); v2 2026-11-20 (a container's domain change moves its
  inheritors in the write's transaction); v3 2026-11-25 (review: lineage ends are every
  domain-bearing type, discovery counts distinct ids under a cap, a rollup write invalidates the
  lineage caches, and a manual row keeps its source when its last asset edge leaves); v4 2026-11-26
  (the repair and the Postgres prefix indexes move to the unreleased 2.1.2)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `DomainLineageRefcountIT`, `DomainLineageInheritanceIT`, `DomainLineageRebuildIT`,
  `LineageDomainRollupsTest`, `LineageDomainInheritorsTest`, `MigrationArchitectureTest`
- **Related:** #33961

## Context
Domain lineage is a rollup: one `UPSTREAM` row per ordered pair of domains, with `source`
`ChildAssets` and `assetEdges` standing for the asset edges between the two domains' assets. The
UI weighs domain edges by that count (ADR:2026-11-13-lineage-scene-edges-weigh-the-asset-edges-they-stand-for).
`LineageRepository` kept it on edge writes and deletes, counting inherited domains, but nothing
moved it when an asset's domains changed. The call that tried passed the domain's id where the
asset's was expected, so it never matched a row. Domains are usually assigned after lineage is
ingested, so the domain edge was missing, or stuck at 1 once an edge was re-sent, and deleting one
asset edge could delete it while others remained.

## Decision
- **Invariant.** A domain rollup `A → B` has `assetEdges` equal to the number of lineage edges whose
  own `source` is not `ChildAssets`, whose from-end holds `A` and whose to-end holds `B`, with
  `A ≠ B`. An end holds its own domains, or else the ones it inherits.
- **Which edges count is decided by `source`, not by entity type.** A service→service or data
  product edge written directly through `PUT /v1/lineage` counts, as `LineageRepository` counts
  it when it is first written; a `ChildAssets` rollup never does. The domain move and the repair
  apply that rule through `LineageDomainRollups.rollsUp`; `LineageRepository` applies its own
  form of it at edge-write time.
- **Known divergence: a re-sent rollup.** A `PUT /v1/lineage` onto an existing `ChildAssets`
  service or data product rollup turns it `Manual` and keeps its `assetEdges`. `LineageRepository`
  does not count that re-send into the domain rollups (the edge already existed), but the repair
  and later moves do. The domain edge then over-counts by one, and deleting the asset edges behind
  the rollup leaves it standing with no asset edge until the repair runs again.
- **Three triggers keep it.** An asset edge write or delete (`LineageRepository`, ±1 per pair); a
  domain write on the asset, moved once on the updater's baseline pass, by the CSV batch update,
  by a data product's domain move and by a data product leaving a deleted domain
  (`LineageDomainRollups.move`, −1 for each pair before and +1 for each pair after); and the
  `DomainLineageRebuild` repair, which recounts every pair from the edges.
- **The live delta never ships without the repair.** A delta subtracts from what the store holds,
  so over drifted counts it deletes rollups that edges still stand for.
- **A rollup another writer owns keeps its source.** The repair and the live move delete only
  `ChildAssets` rows. A row with another source (a manual edge, or a rollup re-sent by hand) keeps
  its source and metadata when its count reaches zero: only the `assetEdges` it carries is
  cleared. One without a count is left as written, and a row whose stored details are `null` reads
  as empty details, so it is never a reason to fail.
- **A rollup write invalidates the lineage caches once it commits.** The search write for a
  rollup add or delete runs after commit and calls `LineageUtil.invalidateLineageCaches`, the same
  invalidation a regular lineage write makes, so an open domain scene does not keep the old edge
  until its TTL.

## Consequences
Domain lineage appears however the domains were assigned, and a second repair run changes
nothing. Two writes still bring the drift back until they are re-projected, and a later asset
move can then under-count, as a delta over a drifted store does; only the repair restores the
invariant meanwhile:
- a container's own domain change whose descendants exceed the cap (see the amendment);
- a domain's hard delete, which drops its HAS rows with the domain's relationships, so an asset
  that falls back to an inherited domain is never counted under it.

Excluding service and data product ends by type instead, which would also close the re-sent
rollup divergence, needs the same change in `LineageRepository`.

## Amendment — 2026-11-20: a container's domain change moves its inheritors in the write's transaction

- **A fourth trigger.** A write to an entity's own domains also moves the rollups of the
  descendants whose domains in effect follow it. `LineageDomainInheritors` finds them by FQN among
  the types that can inherit the container's domains and be a lineage end: the types search
  carries the container's inherited fields onto (`indexMapping.json` `childAliases`,
  transitively), plus the container's own type when it nests (a directory), kept when the type has
  domains, the gate `LineageRepository` applies to both ends of an edge it counts. So schemas are
  lineage ends, and so are test suites and test cases, whose FQNs sit under their table's. A table's
  own domain write therefore runs two prefix queries (`test_suite`, `test_case`), and a container's
  runs one per such type under it. Every table discovery scans has a prefix index on Postgres
  (below); the time the test suite and test case scans add is not measured yet. The descendants
  found are those that are an end
  of a lineage edge; their domains in effect are read before the write and after it, in the write's
  transaction, with no
  cache answering or keeping the reads. Reading both sides gets each move right whether the
  descendant inherits from the container, holds its own domains or inherits from a nearer parent,
  so a move read this way replaces the caller's move for the same entity, even when it changes
  nothing. The moves go to `LineageDomainRollups.move` with the container's own, so an edge between
  two moved ends counts once. It runs on the updater's baseline pass, in the CSV batch flush and in
  a data product's domain move (containers can be its assets).
- **In the same transaction, not after commit.** The rollups commit with the domain rows they
  follow. That does not isolate them from other rollup writers: every writer (`LineageRepository`
  on an edge write or delete, the move) reads the rollup row without a lock and writes it back with
  an upsert, so an edge write racing a container's move can overwrite the move's delta with a count
  it read before the move, and it counts its new edge under the domains it read. The rebuild is the
  backstop; making it exact would need `SELECT … FOR UPDATE` in every writer, which this does not
  add. A post-commit job would be worse, even moving only the edges it snapshotted in the
  transaction: counts stop at zero (`LineageRepository` skips the decrement of a missing row, the
  move deletes a row at 0), so an edge deleted between commit and job loses its decrement on the
  new pair and the job's increment then leaves a count no edge stands for; and two jobs whose edges
  share a pair must run in commit order, across pods. The CONTAINS tree is not the descendant set:
  a nested container inherits from its service.
- **Cap: 5,000 descendants with lineage per write** (`LineageDomainInheritors.MAX_REPROJECTED`).
  Measured on the integration-test stack (Testcontainers, a shared 32 GB host; tables with one
  column, so wider tables read more JSON per entity), one PATCH of a database service's domains:

  | Lineage-bearing tables (of all tables) | MySQL + ES: assign / move | Postgres + OS: assign / move |
  |---|---|---|
  | 10 (10) | 140 / 196 ms | 131 / 137 ms |
  | 1,000 (1,000) | 236 / 286 ms | 184 / 230 ms |
  | 10 (5,000) | 111 / 151 ms | 91 / 115 ms |
  | 5,000 (5,000) | 1,037 / 1,000 ms | 675 / 672 ms |

  Discovery bounds the matches, not the rows scanned: each query walks every descendant of its
  type under the prefix with two `EXISTS` probes (the 10-of-5,000 row). On Postgres the 5,000
  edges point at 50 targets: with one, OpenSearch's 2 GB test heap tripped its circuit breaker
  while the edges were written. Each re-projected
  descendant then costs two full-entity reads, its share of the edge reads and the neighbours'
  domain reads, all inside the request's transaction, which holds the rollup rows it writes. At
  5,000 the PATCH stays near a second, which leaves room under MySQL's 50 s lock wait for wider
  tables (not measured), so the cap stays at 5,000. The cap counts distinct descendants across
  every container and type of the write: each prefix query asks for the cap plus one rows, so an
  overlapping prefix cannot crowd out a sibling, and the scan stops once the union exceeds the cap.
  Above the cap nothing moves: the request succeeds and a WARN (`Domain lineage was not moved for
  the descendants of …`) names the rebuild command. Those descendants' rollups stay
  under their old domains, and a later delete of one of their edges is lost on the missing new
  pair, until the rebuild runs. Which durable fallback replaces the warning (queue the rebuild,
  re-project after commit in chunks, or persist a "rebuild due" marker) is a maintainer decision.
- **The rebuild command**, `openmetadata-ops.sh rebuild-domain-lineage`, runs `DomainLineageRebuild`.
  It overwrites counts tallied from a full scan of `entity_relationship`, so it needs lineage and
  domain writes paused (or the server stopped), its run time grows with that table, and a
  `reindex --force --entities=domain,dataProduct` follows. `--force` is needed: a reindex without it
  skips the mappings it finds unchanged, and the domain view would keep the old counts.
- **Postgres prefix indexes.** Discovery's `fqnHash LIKE 'hash.%'` needs a `text_pattern_ops`
  index under a non-C collation (as in 1.13.0); 2.1.2 adds the seven that discovery's tables
  lacked (amendment v4): `stored_procedure_entity`, `pipeline_entity`, `llm_model_entity`, `mcp_server_entity`,
  `test_suite` (one basic suite per table, scanned on every table, schema, database and database
  service domain write), `tag` (a classification's write) and `ai_framework_control_entity` (an AI
  governance framework's write). MySQL's `fqnHash` btree serves a constant prefix as it is.
- **Still not moved live:** a domain's hard delete, where an asset whose own domains were all
  deleted falls back to an inherited one nobody counts under; a directory moved to another parent
  (the update rewrites its CONTAINS row and keeps its FQN, so it and its files inherit from a parent
  whose prefix they are not under); inheritance that does not follow the FQN (a query's domains
  come from its tables). The rebuild command restores them.

## Amendment — 2026-11-26: the repair runs in 2.1.2

- **The repair is a 2.1.2 data migration step.** 2.1.0 and 2.1.1 had shipped, so a database at
  2.1.1 never runs a step added to 2.1.0: the workflow reprocesses only the newest version of a
  release train it has applied. `DomainLineageRebuild` lives in `migration/utils/v212` and runs
  once, recorded as `data-migration-step:2.1.2:rebuildDomainLineage`, from both engines' v212
  `Migration`. `DomainLineageRebuildIT#anUpgradeFrom211RunsTheRebuild` sets the migration log back
  to 2.1.1 and runs the migration workflow over the real native folders.
- **It is a named exception to ADR:2026-11-11-a-data-migration-carries-its-own-logic.** The
  recount reads domains in effect through the running server's inheritance, the same resolution
  the live delta that follows it uses, and it has to run in the upgrade that ships that delta. It
  and the v212 `Migration` classes are listed in `MigrationArchitectureTest` with that reason.
- **The Postgres prefix indexes are built by the 2.1.2 Java step**
  (`DomainLineageDiscoveryIndexes`), which checks `pg_index.indisvalid` first and rebuilds an
  invalid one, per ADR:2026-10-22-guarded-index-ddl-runs-from-a-java-data-migration. Discovery
  runs only on a server that has run 2.1.2, so the index exists before any query uses it.
