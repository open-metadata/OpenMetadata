# The search query endpoint accepts a POST body alongside the GET query string

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** Detail
- **Guard:** `SearchResourceTest#searchPostRejectsNegativePaginationWithoutSearching`,
  `SearchQueryPostIT#postSearchQueryReturnsSearchResponse`,
  `SearchQueryPostIT#postSearchQueryRejectsNegativePagination`,
  `SearchQueryPostIT#postSearchQueryAcceptsIdsFilterTooLargeForGet`
- **Related:** {{detail_github_issue_ref}}

## Context
`GET /v1/search/query` carries every input as a `@QueryParam`, including the Elasticsearch
`query_filter` serialized as JSON. Jetty caps the request line + headers at 8 KiB (`conf/
openmetadata.yaml` → `maxRequestHeaderSize`), so a metric Assets tab that embeds every linked
asset id in an `ids` filter overflows the URL at ~140–170 ids and the request fails with
HTTP 414 (or 400/431 behind a fronting proxy). Metrics can legitimately link thousands of
assets (the bulk-add API is unbounded and `GET /v1/metrics/{id}/assets` is paginated for that
case), so this is a supported state with no working search path.

## Decision
`SearchResource` exposes a sibling `POST /v1/search/query` that accepts a
`SearchRequest` JSON body for every input the GET path takes as a query parameter
(`query`, `index`, `from`, `size`, `queryFilter`, `postFilter`, `sortFieldParam`,
`sortOrder`, `trackTotalHits`, `fetchSource`, `explain`, `includeSourceFields`,
`excludeSourceFields`, `deleted`, `searchAfter`, `isHierarchy`,
`includeAggregations`). The POST handler:

- reuses the same `cachedSearch` + `filterTestCaseResponses` pipeline as the GET, so caching,
  test-case masking, and aggregations are byte-identical;
- derives `domains` and `applyDomainFilter` from the caller's `SecurityContext` (same as
  GET) — never from the body — so the authorization contract is preserved;
- normalizes `body.getIndex()` through `Entity.getSearchRepository().getIndexOrAliasName(...)`
  so a caller cannot read a raw index by name;
- validates `from`/`size` with the same `requireNonNegative` guard `previewSearch` uses,
  returning `BadRequestException` with the same `<field> must be greater than or equal to 0`
  message.

The UI's `searchAPI.ts` gains `rawSearchQueryPost` / `searchQueryPost` that mirror the GET
helpers and JSON-stringify `queryFilter` / `postFilter` into the body, matching the GET path's
`query_filter` JSON-string semantics. A `useQueryPost?: boolean` flag on `AssetsTabs` and
`useAssetSelectionState` toggles a consumer onto the POST path; the metric callers
(`MetricAssetsTab`, `MetricDetails` → `AssetSelectionModal`) set it. `getMetricAssetsQueryFilter`
and `getMetricAssetSelectionQueryFilter` are unchanged.

Non-metric callers keep the GET path; the flag defaults to `false`.

## Consequences
Clients with a filter that fits the URL may continue to use GET; the POST variant is the
escape hatch for oversized filters. The GET endpoint is unchanged, so no SDK or downstream
distribution is forced to migrate. Clients that move to POST must send the body in the
`SearchRequest` shape the server expects and accept that the server (not the body) controls
domain scoping. A future caller that needs an `ids` filter of thousands of ids (the metric
flow today, any otherAssets-of-* tab that switches to id enumeration tomorrow) routes through
POST rather than truncating, chunking, or persisting a new search-document field.
