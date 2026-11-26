# A data product lineage rollup is recounted from the asset edges, and an edge drawn between the products stays

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `DataProductLineageRollupIT` (the drawn-edge, PATCH, delete, domain-move and CSV cases) and `DataProductLineageRebuildMigrationIT`
- **Related:** #38260, PR #38271, ADR:2026-11-11-a-data-migration-carries-its-own-logic

## Context

A data product lineage edge stands for the asset edges between the two products' assets, and
`assetEdges` counts them. Its writers used to add or subtract one per change. A delta is only right
when the stored count is right, and released versions left counts wrong: edges from a product to
itself, counts lost on session-consolidated edits, CSV imports that never touched the rollup. A
delta also cannot tell a rollup row (`source` `ChildAssets`) from an edge an admin drew between the
products, so subtracting the last asset edge deleted the drawn edge, and a PATCH that added one
replaced the drawn edge's details with a rollup row.

## Decision

1. Whenever an asset's data products change, or an asset edge is deleted, each product pair it
   touches is recounted from the stored rows (`LineageUtil.recountDataProductsLineage`). The count
   is absolute, so it does not depend on what was stored before, nor on the order of the rows in a
   batch.
2. A `ChildAssets` row takes the new count and is deleted at zero. A pair of one product with itself
   is never written.
3. An edge with any other `source` was drawn between the products. A recount keeps its details and
   only sets `assetEdges`, clearing it at zero. No membership or lineage change deletes it.
4. The 2.1.2 data migration (`DataProductLineageRebuild`) applies the same rule to every stored
   rollup, using SQL only.

## Consequences

Stored counts heal: any recount of a pair writes the true value. Each change costs one indexed
`COUNT` per affected pair. The add path in `LineageRepository` still adds one per new asset edge,
because ingestion adds edges in bulk and a count per edge would be too slow there; it already keeps
a drawn edge's details. Deleting lineage by source, deleting a pipeline and hard-deleting an asset
do not recount yet, so their rollups can still drift until they follow this rule. Domain rollups do
not follow it yet; a change that makes them follow it should cite this record.
