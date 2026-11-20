# The product tour never sends a request about its mock table

- **Status:** Superseded by ADR:2026-10-23-the-product-tour-serves-its-pages-from-recorded-fixtures
- **Revisions:** v1 2026-10-13 (initial) · v2 2026-10-15 (Tour spec removed; guard is `reviewer`
  until the redesigned tour ships its own spec) · v3 2026-10-23 (superseded)
- **Deciders:** @harsh-vador
- **Guard:** `reviewer` — see the v2 amendment
- **Related:** #34473, #35090

## Context

`/tour` renders the real My Data, Explore and table pages. On the Explore and table steps it feeds
them mock data seeded by `TourPage` into `TourProvider` (`mockTourData.constants.ts`): the table
`sample_data.ecommerce_db.shopify.dim_address`, id `9d664bbd-8c9e-4068-9112-9ab0457d4c52`. Those
pages contain many components that fetch their own data. Each one must recognise the tour itself,
and the ones added after the tour was written did not. They requested the mock table, its id,
lineage, contract, change summary and query count from the server.

The mock id exists on no server. The FQN exists only where the sample data was ingested, and CI
always ingests it. So the requests succeeded in CI. On a customer instance without that data they
returned 404, which showed as error toasts during the tour and as "Something went wrong" on the
lineage step. Neither the specs nor the unit tests could see this.

## Decision

- On `/tour` (`useTourProvider().isTourPage`), no component sends a request for the mock table, by
  FQN or id. Nor does any send one with an entity link or FQN left empty because the tour has no
  route params, such as `<#E::table::>`.
- A component that fetches entity data checks `isTourPage` and does one of two things:
  - render from `tourMockDatasetData`, which is what `LineageMap` does with `lineageScene`;
  - skip the request and show its empty state, which is what change summary, contract, asset
    health, knowledge pages and query count do.
- Gate on `isTourPage`, not on `isTourOpen`. The pages stay on mock data after the overlay closes
  while the user is still on `/tour`.
- Mock grants come from `mockTourPermission.constants.ts`, not `mockTourData.constants.ts`. Any page
  can then import them without bundling the whole mock dataset.
- The Explore summary panel gets a view-only grant on the tour (`mockTourSummaryPanelPermission`).
  A tour edit would PATCH a table that does not exist, and the panel's data quality tab would
  query it by FQN.

## Consequences

- The tour shows the same content on every instance, with or without the sample data.
- Any new data-fetching component reachable from the tour's pages needs the same `isTourPage`
  check. Without it, the Tour spec's request check fails and lists the URL. That check does not
  depend on the sample data: it tests whether a request is sent, not whether it fails.
- The guards live in each component rather than in one interceptor. A blanket block in the REST
  layer would turn every leak into a component error state, which is the failure this record
  removes. It would also require the REST layer to depend on UI routing.

## Amendment (v2, 2026-10-15)

The new landing page (#34770) no longer renders `#feedWidgetData`, the anchor `TourPage` waits for
before it opens the tour, so `/tour` renders the landing page and the tour never starts. The tour is
being redesigned, and every test in `playwright/e2e/Flow/Tour.spec.ts` walked the old steps, so the
spec was deleted rather than kept quarantined (the AUT nightly ran it regardless and failed on it).
That removed the request check this record named as its guard.

The decision is unchanged: `/tour` still renders on mock data, and the `isTourPage` gates stay. The
redesigned tour's spec must restore the request check — record every API request naming the mock
table's FQN or id, or an empty entity link, and fail if there are any — and this record's `Guard`
must point at it again in the same PR.
