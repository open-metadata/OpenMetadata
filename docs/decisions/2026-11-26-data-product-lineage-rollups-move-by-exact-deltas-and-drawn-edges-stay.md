# A data product lineage rollup moves by the exact asset edges a change adds or removes, and an edge drawn between the products stays

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `DataProductLineageRollupIT` (the drawn-edge, PATCH, delete, domain-move and CSV cases), `LineageUtilTest` (the `adjust` and `recount` cases) and `DataProductLineageRebuildMigrationIT`
- **Related:** #38260, PR #38271, ADR:2026-11-11-a-data-migration-carries-its-own-logic

## Context

A data product lineage edge P -> Q stands for the lineage edges from P's assets to Q's assets, and
`assetEdges` counts them. The server writes these rows with `source` `ChildAssets`; an admin can also
draw an edge between two products, with another `source`. Released versions left the counts wrong
(self edges, counts lost on session-consolidated edits, CSV imports that never touched them), and
every writer treated a drawn edge like a rollup row: a PATCH replaced it, and removing the last asset
edge under it deleted it.

Recounting a pair from the stored rows heals any wrong count, but it reads the lineage of every asset
of the source product. A single change only moves the count by a known amount, which costs the
changed asset's own lineage to compute.

## Decision

1. **A single change applies the exact delta** (`LineageUtil.adjustDataProductLineage`):
   - adding an asset edge adds one to each pair of its ends' products (the add path in
     `LineageRepository`), and deleting it removes one;
   - an asset that gains or loses a product P changes the pair (P, Q) by its own edges to assets
     holding Q, read from `findDownstreamDataProducts` / `findUpstreamDataProducts`.
   A sequence of such changes, each applied after the previous one is stored, stays exact.
2. **A batch that rewrites many assets' products at once (CSV import) recounts** the pairs it
   touches from the stored rows (`LineageUtil.recountDataProductsLineage`), because a delta read
   after the whole batch is rewritten would count an edge whose two ends both moved twice.
3. **The data migration recounts every pair** (`DataProductLineageRebuild`), so the deltas start
   from true counts.
4. **A `ChildAssets` row** takes the new count and is deleted at zero. **An edge with any other
   `source`** keeps its details, only `assetEdges` changes, and it is cleared at zero: no count
   deletes or replaces it. A pair of one product with itself is never written.

## Consequences

A change costs the changed asset's lineage, not the product's. A count that goes wrong stays wrong
until a recount of that pair: a write path that changes asset edges or products without applying its
delta drifts the counts. Deleting lineage by source, deleting a pipeline and hard-deleting an asset
do not apply theirs yet; each should call `adjustDataProductLineage`. Concurrent writes to one pair
can still lose an update, as they could before. Domain rollups do not follow this rule yet; a change
that makes them follow it should cite this record.
