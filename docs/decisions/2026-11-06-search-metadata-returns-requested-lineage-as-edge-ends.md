# search_metadata returns a requested upstreamLineage as edge ends, capped like other bulk fields

- **Status:** Accepted
- **Revisions:** v1 2026-11-06 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `SearchMetadataCleanTest#aRequestedUpstreamLineageKeepsOnlyTheEdgeEnds`,
  `SearchMetadataCleanTest#upstreamLineageIsCappedLikeEveryBulkField`
- **Related:** openmetadata-collate#8303, ADR:2026-10-29-search-metadata-hits-show-their-place-in-a-hierarchy

## Context
`upstreamLineage` is not in a search hit unless the caller names it in `fields`. When named, every
edge came back as the index stores it: ids, hashes, column mappings, SQL, audit fields, and the whole
pipeline or stored procedure entity. One edge ran to several KB, so a page shrank to a few hits, and
a hit with many edges could pass the response limit even at `size=1`. Callers mostly wanted to know
which assets feed this one.

## Decision
- Each edge keeps `fromEntity` as `{fullyQualifiedName, type}` and, when the edge has one,
  `pipeline` as `{fullyQualifiedName, type}`. The pipeline's type comes from the edge's
  `pipelineEntityType`, because the indexed pipeline entity has no type of its own. Everything else
  on the edge is dropped.
- `fromEntity` keeps its key, so `upstreamLineage.fromEntity.fullyQualifiedName` reads the same in a
  hit as in a queryFilter.
- The list is capped per hit like `columns`, `charts` and `tasks` (60), with
  `upstreamLineageTotal` and `upstreamLineageTruncated`.
- Every edge, column lineage and SQL come from `get_entity_lineage`, which already pages edges with
  `nextCursor`. search_metadata does not add a second lineage paging mechanism.

## Consequences
- A requested lineage costs about a hundred bytes per edge instead of kilobytes.
- Edge metadata such as `source` (Manual, QueryLineage, ...) is no longer in the hit. Add it back
  here if agents need it.
- A caller that read column mappings or SQL from search hits now calls get_entity_lineage.
