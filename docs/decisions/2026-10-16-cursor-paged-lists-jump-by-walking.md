# Cursor-paged settings lists reach any page number by walking cached cursors

- **Status:** Accepted
- **Revisions:** v1 2026-10-16 (initial)
- **Deciders:** Rohit Jain (settings modal design review)
- **Guard:** `useCursorPagedList.test.ts` (jump, back-navigation and restart cases) and `PersonasLanding.test.tsx` (jump case)
- **Related:** open-metadata/openmetadata-collate#7531, open-metadata/OpenMetadata#35630

## Context
The settings modal's Applications and Personas landings show the design-system pager (page
input, numbered pages, records). Their list endpoints are cursor-paged: a response carries only
`before`/`after` for its neighbours, so a page number can't be requested directly. Before this,
Applications showed prev/next only, and Personas silently ignored a click on a page it had not
visited.

## Decision
- Each loaded page's paging is cached, keyed by page number, **at most 100 pages**
  (`MAX_CACHED_PAGES` / `MAX_CURSOR_CACHE_PAGES`); past the cap, a jump walks again.
- **Page 1** is fetched without a cursor.
- **Going back** to page N uses page N+1's `before`.
- **Going forward** to page N uses page N-1's `after`. If page N-1 was never loaded, the pages
  from the highest cached page below N up to N-1 are fetched first with `after` (their cursors
  are cached), then page N is loaded.
- If the walk runs out of pages, or the list restarts mid-walk (filter or page-size change), the
  jump is dropped and the current page stays: rows are never shown under the wrong page number.
- Only the latest request may write to the cache; a list restart clears it.

## Consequences
Numbered jumps and the page input work on cursor endpoints without a server change. A jump to an
unvisited page costs one extra request per skipped page; acceptable for settings lists, which are
short. Revisit if a list here can grow to many pages — at that point the endpoint should take an
offset, and this walk should be replaced rather than tuned.
