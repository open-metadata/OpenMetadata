# search_metadata counts exactly and pages only within the 10,000-hit window

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `SearchMetadataToolTest#testSearchAsksForExactTotals`,
  `SearchMetadataToolTest#anEmptyPageStillReportsTheRealTotal`,
  `SearchMetadataToolTest#pagingStopsAtTheResultWindowWhenTheTotalIsHigher`,
  `SearchMetadataToolTest#aPageThatWouldCrossTheResultWindowIsShortened`,
  `SearchMetadataToolTest#aRequestPastTheResultWindowIsRejectedByName`
- **Related:** #37173, ADR:2026-11-05-search-metadata-default-scope-includes-ai-governance-assets

## Context
Agents answer "how many" questions with `totalFound`. Without `track_total_hits` the engine stops
counting at 10,000 and reports that as the total, so a large catalog read as exactly 10,000 assets.
An empty page, including a `size: 0` count, reported 0, because the total was read only from a page
that had hits.

Exact totals expose the engine's result window: `from + size` may not pass
`index.max_result_window` (default 10,000). With a capped total, paging happened to stop at 10,000.
With an exact total, the tool would hand out a `nextCursor` the engine then refuses, and a `from`
past the window would come back as an empty page that reads as no matches.

## Decision
- Every `search_metadata` request sets `trackTotalHits(true)`, so `totalFound` is exact past 10,000.
  It is read even when the page is empty.
- Paging stops at `EntityBuilderConstant.MAX_RESULT_HITS` (10,000). A page that would cross it is
  shortened, no `nextCursor` is returned at or past it, and a `from` at or past it is rejected with
  an error that names the limit and asks the caller to narrow the query.

## Consequences
- Every call counts its hits exactly, including the default search over the `all` alias. Explore
  already asks for exact totals on the same searches (`trackTotalHits: true` in `ExploreUtils`).
- Matches past the first 10,000 can only be reached by narrowing the query. Raising the window
  means raising `index.max_result_window` and `MAX_RESULT_HITS` together.
- An admin-lowered `maxResultHits` search setting is not read here, so paging past that lower limit
  returns repeated rows. That predates this record; revisit if admins lower it in practice.
