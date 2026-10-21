# The landing page's Domains and Data Quality cards count what the pages they open count

- **Status:** Accepted
- **Revisions:** v1 2026-10-16 (initial)
- **Deciders:** Landing page owners
- **Guard:** `useDomainOverview.test.tsx` (sub-domains left out of the count map and the queries), `useDataQualitySummary.test.tsx`, `dataQualityFilters.test.ts`; Playwright `DomainDataProductsWidgets.spec.ts`
- **Related:** ADR:2026-10-14-overview-widgets-page-by-name-or-recency

## Context

Each topic card's footer opens a full page — Domains, Data Quality — and readers compared the two.
They disagreed. The Domains card counted and listed every domain, sub-domains included, while the
Domains page lists only top-level domains and nests the rest under their parent; a root's asset
count from `/domains/assets/counts` already includes its sub-domains', so a sub-domain row counted
those assets twice. The Data Quality card defaulted to a 7-day window while the Data Quality page
defaults to 30 days, so the card read "0 passed, 0 failed" beside a page showing both.

## Decision

- **Domains card scope is top-level domains.** The list, the unowned count and the empty count all
  filter on `must_not: exists(parent)` (`ROOT_DOMAIN_CLAUSE`); the total and the empty bucket drop
  any FQN with more than one segment from the count map. A root's asset count is the server's
  rolled-up count, unchanged.
- **Data Quality card defaults to 30 days**, the Data Quality page's own default
  (`DEFAULT_DATA_QUALITY_FILTERS.range`). The card still offers 7, 30 and 90.

## Consequences

- A sub-domain never appears as its own row on the landing page; it is reached through its parent.
- If the Domains page starts listing sub-domains beside their parents, or the Data Quality page
  changes its default window, this card follows it — change both together.
- The ownership chips on the Domains and Data Products cards remain independent filters, not a
  partition: an unowned, empty entity is in both, so they do not sum to "All".
