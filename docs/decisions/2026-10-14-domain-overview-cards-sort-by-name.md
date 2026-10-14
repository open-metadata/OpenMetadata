# The Domains and Data Products landing cards list their page in name order

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial)
- **Deciders:** shrabantipaul-collate
- **Guard:** `useDomainOverview.test.tsx` — "requests the %s page in name order"
- **Related:** #35408, #35409, #34770

## Context
The Domains and Data Products cards on the landing page (#34770) show one 10-row page fetched with
an empty query. Every document scores the same for an empty query, so with no sort the rows came
back in index order: they reshuffled between reloads, and on a large estate an entity created a
moment ago was not on the page at all. The nightly AUT run failed `DomainDataProductsWidgets.spec.ts`
on both MySQL and Postgres because the spec's new domain never rendered on the card.

## Decision
`fetchOverviewPage` requests every bucket's page (All, No owner, Empty) sorted by `name.keyword`
ascending. This matches the Empty bucket, whose FQN list is already sorted alphabetically before it
is fetched.

## Consequences
The ten rows are deterministic and read A–Z on every chip. A newly created entity appears only if
its name sorts into the first page, which is why the spec prefixes its domain and data product with
`0000-`. Ordering by recency or relevance instead would need a new record, and the spec would have
to stop depending on the name prefix.
