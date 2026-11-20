# A domain lineage edge counts the edges its domains' assets hold in effect

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `DomainLineageRefcountIT`, `DomainLineageRebuildIT`, `LineageDomainRollupsTest`,
  `IngestionPipelineMigrationEntryPointTest`
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
- **A rollup another writer owns keeps its source.** The repair inserts and deletes only
  `ChildAssets` rows. A row with another source keeps it and has only an `assetEdges` it already
  carries rewritten; one without a count is left as written.

## Consequences
Domain lineage appears however the domains were assigned, and a second repair run changes
nothing. Two writes still bring the drift back until they are re-projected, and a later asset
move can then under-count, as a delta over a drifted store does; only the repair restores the
invariant meanwhile:
- a container's own domain change (service, database, schema), which is not re-projected onto
  its descendants' edges yet;
- a domain's hard delete, which drops its HAS rows with the domain's relationships, so an asset
  that falls back to an inherited domain is never counted under it.

Excluding service and data product ends by type instead, which would also close the re-sent
rollup divergence, needs the same change in `LineageRepository`.
