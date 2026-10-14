# The product tour never sends a request about its mock table

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial)
- **Deciders:** @harsh-vador
- **Guard:** `playwright/e2e/Flow/Tour.spec.ts`, "Tour should work from help section": it records every
  API request naming the mock table and fails if there are any
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
