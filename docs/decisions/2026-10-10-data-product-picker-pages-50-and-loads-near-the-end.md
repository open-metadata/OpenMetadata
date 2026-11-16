# Data product pickers page search results 50 at a time and load the next page near the end of the list

- **Status:** Accepted
- **Revisions:** v1 2026-10-10 (initial)
- **Deciders:** anuj-kumary
- **Guard:** `filter-select.test.tsx` (load-more fires near the end, once) and `DataProductsSelectList.test.tsx` (next page on scroll, one request per page, stale responses dropped); the page size itself: reviewer
- **Related:** #35184, #35185

## Context
The data product picker used to load one page of 10 search results, so any data product past the
tenth could be reached only by searching. Moving the picker to the core `FilterSelect` added
infinite scroll, which needs a page size and a point at which to fetch the next page. The design
review suggested pages of 30; a page that does not fill the menu never scrolls, so it can never
ask for more.

## Decision
- Data product pickers (`DataProductsContainer`, `DataProductsSection`) request search results
  `PAGE_SIZE_LARGE` (50) per page, through `fetchDataProductsElasticSearch`'s page-size argument.
- `FilterSelect` asks for the next page (`onLoadMore`) when its menu is scrolled within 40px of
  its end. The threshold lives in `FilterSelect`, not in its callers.
- The picker keeps one page request in flight at a time and drops a response for a search the
  user has already moved past. While a page loads, `FilterSelect` shows a loading row at the end
  of the list.

## Consequences
50 rows always overflow the menu, so scrolling can reach every data product without searching,
and most catalogs fit in one or two requests. It reuses the shared `PAGE_SIZE_LARGE` constant
rather than adding a picker-specific one, so changing that constant changes this page size too.
Revisit if a page of 50 is measurably slow to search or render, or if a caller needs a different
threshold, which would then become a `FilterSelect` option.
