# The Domains and Data Products overview widgets page by name or by recency, never by relevance

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial)
- **Deciders:** anuj-kumary
- **Guard:** `useDomainOverview.test.tsx` and `useDataProducts.test.tsx` (page size, `name.keyword`
  and `updatedAt` sorts), `DataProductsOverviewWidget.test.tsx` (the card's sort picks the server
  order), and `DomainDataProductsWidgets.spec.ts`; the page size itself: reviewer
- **Related:** #34770, #35396, ADR:2026-10-10-data-product-picker-pages-50-and-loads-near-the-end

## Context
The landing-page Domains and Data Products widgets (#34770) render one search page and let the
card sort it. The page was 10 rows with no sort, so an empty query ranked by the search-settings
boosts (tier, votes, usage). On a large catalog the rows shown were whichever scored highest, and
a new or untiered entity never reached the page. The AUT nightly lanes, with 72 seeded data
products, failed `DomainDataProductsWidgets.spec.ts` on every attempt because of this.

## Decision
- `fetchOverviewPage` (`useDomainOverview.ts`) requests `OVERVIEW_PAGE_SIZE` rows, which is the
  shared `PAGE_SIZE_LARGE` (50). Changing that constant changes this page size too.
- The page is always sorted on the server, by `OverviewOrder`: `NAME` (`name.keyword` ascending,
  the default) or `RECENTLY_UPDATED` (`updatedAt` descending). It is never left to relevance.
- The Data Products card's "Recently updated" sort requests `RECENTLY_UPDATED`. Its other sorts
  (Most assets, Needs attention, A–Z) request `NAME` and reorder that page on the client, because
  asset counts come from `/assets/counts` and are not on the search document.
- The "Empty" bucket fetches the first `OVERVIEW_PAGE_SIZE` empty FQNs, sorted by FQN, and then
  sorts those rows in the requested order.

## Consequences
The page is stable and predictable on any catalog, and Playwright specs can rely on a `0000-`
prefix to put their entities first. "Recently updated" ranks across every entity. On catalogs with
more than 50 entities, "Most assets" and "Needs attention" rank only the first 50 by name. To
revisit, rank across the whole estate: choose the top N from the counts map and fetch those rows
by FQN, the way the "Empty" bucket does. Specs that assume their entity is on the page would then
have to filter or search for it instead.
