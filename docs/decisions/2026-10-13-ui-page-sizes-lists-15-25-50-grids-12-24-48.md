# Paged UI lists step 15/25/50 and paged card grids step 12/24/48

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial)
- **Deciders:** Sweta Agarwalla
- **Guard:** `PaginationUtils.test.ts` (`view page sizes` describe block)
- **Related:** —

## Context
Page sizes had drifted page by page: 10, 9, 20 and 5 sat beside the app-wide 15/25/50, a card grid
offered 15/25/50 (rows that never fill), and one list offered 12/24/48. The core-components
`PaginationCardWithControls` defaulted to 10 with 10/25/50, so any page that did not pass its own
options showed a scale no other page used. The `pageSize` URL param and the `globalPageSize`
preference are shared across pages, so a size from one scale could land in a picker with no
matching entry.

## Decision
- A paged **list or table** defaults to 15 and offers 15/25/50 (`LIST_PAGE_SIZE_OPTIONS`,
  `PAGE_SIZE_BASE` in `src/constants/constants.ts`).
- A paged **card grid** defaults to 12 and offers 12/24/48 (`GRID_PAGE_SIZE_OPTIONS`,
  `GRID_PAGE_SIZE_BASE`), so rows of 2, 3 or 4 cards fill evenly.
- A page with a table/card toggle takes its scale from the view it is in
  (`getViewPageSizeOptions` / `getViewPageSize` in `utils/PaginationUtils.ts`)
  and returns to page 1 when the view changes.
- A grid page passes `GRID_PAGE_SIZE_OPTIONS` to `usePaging` so a list-scale size from the shared
  URL is reconciled to its own scale.
- The size the user picks is remembered per scale (`useSavedPageSize`): list sizes in
  `globalPageSize`, grid sizes in `globalGridPageSize`. A page that switches views comes back to
  the size last picked in each, and a grid size never lands in a list picker.
- `usePaging` treats a caller that declares no options as on the list scale, so a grid size left
  in the shared URL param, or an off-scale size an older build stored in the preference, never
  reaches a 15/25/50 picker.
- Shared defaults (core `PaginationCardWithControls`, `TableV2` client paging, the atoms listing
  hooks) are 15.
- Out of scope: fetch limits that are not a paged view — typeahead/suggestion searches, tree-select
  batches, count-only queries, bulk fetches, and "show more" previews.

## Consequences
A new paged view picks one of the two scales instead of inventing a size. The two scales share no
value, so switching a page between list and grid changes its size to the one last picked on the
new scale (its first step until the user picks one). Playwright specs that wait on a list request's `limit`/`size` must use the scale of the page
they open. Adding a third scale, or a page size outside these, means amending this record.
