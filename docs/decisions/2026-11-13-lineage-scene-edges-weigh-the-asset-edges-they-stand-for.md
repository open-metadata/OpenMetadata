# Lineage scene edges weigh the asset edges they stand for

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `LineageSceneResolverTest` (`rollupWeightCountsTheAssetEdgesItsStoredEdgesStandFor`,
  `domainRootDropsDomainlessAssetsAndGivesDomainsNoServiceType`); `LineageSceneQueryTest`
  (`searchEngineBadRequestsAnywhereInTheCauseChainAreRejectedFilters`); `LineageResourceIT`
  (`testLineageSceneRejectsMalformedQueryFilter`, `testFocusedLineageSceneRejectsMalformedQueryFilter`);
  the virtualisation threshold is `reviewer`
- **Related:** #37678, #37685

## Context
2.1 release testing found the same lineage reported with different edge weights depending on how
it was loaded: a stored container edge already carries the number of asset edges it represents
(`assetEdges`), but a rollup counted the stored edges instead. A rollup also copied the first
underlying edge's SQL and source, so a combined edge read as one of its parts. The Domain and Data
Product roots showed assets outside every domain as loose cards, and a `query_filter` the search
engine rejected surfaced as a 500.

## Decision
- A scene edge's `weight` is the sum of `assetEdges` over the stored edges it rolls up (1 when a
  stored edge has none). An edge with weight above 1 carries no `source`, `sqlQuery`,
  `description` or `pipeline`; the UI shows its edge count instead.
- The Domain and Data Product root scenes omit assets outside every domain or data product; a
  focused scene still shows such an asset as itself.
- A `query_filter` that fails to parse returns 400 `Invalid query_filter` on every scene. On a root
  scene, where the filter reaches the search engine, an engine-rejected filter also returns 400. A
  focused scene applies node filters in memory through the shared lineage builder (used by the
  asset Lineage tab too), which ignores clauses it does not support and returns 200.
- The map virtualises cards only above 200 nodes (`VIRTUALIZE_NODE_THRESHOLD`), so smaller scenes
  mount every card and every card can take keyboard focus.

## Consequences
Weights agree however a scene is loaded, and a combined edge cannot be mistaken for a single
one. Rejecting engine-invalid filters on focused scenes would need the shared lineage builder to
stop ignoring unsupported clauses, which also changes the asset Lineage tab. Revisit the 200-node
threshold if large scenes regress in rendering time or keyboard reach becomes required above it.
