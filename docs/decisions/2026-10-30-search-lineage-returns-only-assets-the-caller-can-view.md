# Search lineage returns only the assets the caller can view

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `SubResourceAuthorizationIT` (`lineageSearch_leavesOutNeighboursTheCallerCannotView`,
  `platformLineage_isAdminOnly`)
- **Related:** open-metadata/openmetadata-collate#7795

## Context
The search-lineage endpoints authorized only the root. Every neighbour came back as its search
document — name, description, owners, columns — and each node's `upstreamLineage` named its upstream
assets and the SQL between them, whatever the caller's policies. The entity lineage graph
(`LineagePermissionFilter`) and the lineage scene already pruned what the caller could not view.

## Decision
- For non-admins, `SearchLineagePermissionFilter` prunes the results of `/getLineage`,
  `/getLineage/{direction}`, `/getLineageByEntityCount`, the CSV exports (sync and async, decided as
  the requesting user) and data quality lineage. It removes nodes the caller cannot `VIEW_BASIC`,
  nodes reachable from the root only through them, edges to them, pipelines on kept edges the caller
  cannot view, and `upstreamLineage` entries naming assets the caller cannot view.
- It authorizes at most **1000** referenced assets per response, the default lineage layer size.
  Anything past that is hidden unchecked, never returned unchecked.
- `/getPlatformLineage`, every asset's lineage at once, is admin only; the lineage scene serves the
  platform view per caller.
- `/getPaginationInfo` still counts unpruned nodes: it returns numbers only.

## Consequences
A non-admin's lineage response costs one batched load and policy evaluation per referenced asset
type. Raising the 1000 ceiling trades that cost against how much of a very large graph a non-admin
sees.
