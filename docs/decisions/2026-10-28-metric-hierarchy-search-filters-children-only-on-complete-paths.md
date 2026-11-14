# Metric hierarchy search narrows children only when the match paths are complete

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** karanh37
- **Guard:** `getMetricSearchPaths` tests in `openmetadata-ui/src/main/resources/ui/src/rest/metricsAPI.test.ts`; the `search paths` tests in `src/hooks/useMetricHierarchy.test.tsx`
- **Related:** #36424

## Context
`GET /v1/metrics/hierarchy?q=` keeps a root when any descendant matches, but listing a parent's
children has no search. Without help, expanding a matched root shows every child, and the match is
lost among them. The UI narrows children with search-index results instead, and the index can
both be larger than one page and lag the hierarchy endpoint.

## Decision
`getMetricSearchPaths` fetches at most **100** search hits (one page) and walks their parent chains
at most **6** levels up. It reports `complete` only when there was at least one hit, all hits fit
in that page, and every chain reached a root within the depth cap.

`useMetricHierarchy` narrows an expanded parent's children to match ids and ancestor ids only when
`complete` is true and the parent is not itself a match or below one. Otherwise, and whenever the
narrowed set would be empty, the expanded parent shows all its children.

## Consequences
- A match the server found is never made unreachable by a capped or stale index: the worst case is
  an unfiltered branch, never an empty one.
- Searches with more than 100 hits, or hierarchies deeper than 6 levels, fall back to unfiltered
  children. Raising either cap trades more search requests per keystroke for narrower trees.
- The 6-level cap bounds sequential search requests; it would need revisiting if metric
  hierarchies routinely grow deeper.
