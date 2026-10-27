# The product tour walks the real pages and serves them from recorded fixtures

- **Status:** Accepted
- **Revisions:** v1 2026-10-23 (initial) · v2 2026-10-26 (no recorder or seed script in the repo; starting a tour drops server data cached before it)
- **Deciders:** UI team
- **Guard:** `openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ProductTour.spec.ts` (no tour page request reaches the server),
  `openmetadata-ui/src/main/resources/ui/src/utils/product-tour/productTourMock.utils.test.ts`
- **Related:** supersedes ADR:2026-10-13-the-product-tour-never-requests-its-mock-entity

## Context
The old tour rendered three pages inside `/tour` and fed them mock data through `TourProvider`.
Every component that fetched data on those pages had to check `isTourPage` and read the mock
instead. Components added later did not, and their requests for the mock table returned 404s on
customer instances. When the landing page was redesigned, the tour stopped starting at all. A tour
that covers more of the product would need that check in every data-fetching component on every
page it visits, and would break the same way each time a page changes.

## Decision
- The tour navigates the real routes and highlights one section per step. Steps come from
  `ProductTourClassBase.getTour(mode)`: `{ mode, steps, loadFixtures }`. A distribution adds its
  own pages and fixtures by overriding the class.
- While a tour runs, one request interceptor on the shared axios client serves its pages:
  - A request that matches a recorded fixture is answered from it and never reaches the server.
    Matching is by method, path and query. Volatile parameters (time windows) are ignored, and
    when no fixture has the same query, the first one for the same path is used.
  - An update (`PUT`, `PATCH`, `DELETE`) without a fixture is dropped with an empty `200`. `POST`
    is not treated as a write: searches, aggregations and report batches read with it.
  - Anything else, such as the signed-in user (by name or by id, with their follows and
    preferences), their permissions and the app config, goes to the server. A user by id is only
    ever the signed-in one, and ids differ per instance, so a recorded one could never match.
- Fixtures are real API responses captured from a clean sample-data instance, not written by
  hand, so they match what the pages request and render. The repo keeps no recorder or seed
  script for this: the fixtures change rarely, and a script that runs a few times a year is not
  worth maintaining. Re-capture them when a page or its API changes. Content that sample data does
  not ingest but a step shows (a glossary with related terms, Context Center articles and
  memories) is created on that instance first, so no step is captured as an empty state.
- Starting a tour drops what pages visited before it cached from the server (Explore's search
  cache, inactive queries), or a tour step would open on those assets and request their details,
  which no fixture holds. Ending the tour reloads the page, so nothing the fixtures put into
  in-memory caches or stores outlives it. Code that writes fixture-derived data to persistent storage (localStorage) checks
  `isTourMockActive()` and skips the write, as pruning dismissed announcements does.
- Components no longer check `isTourPage`.
- The tour scrolls each target into view before react-tour measures it, and react-tour never
  scrolls: when its own scroll ends it positions the popover from a ref that may be gone by then,
  and throws.

## Consequences
The tour shows the same content on every instance. A page needs no tour-specific code to take
part, so adding a step costs a selector, copy and its captured fixtures. The old record rejected an
interceptor because a blanket *block* would turn every leak into a component error. This one
*serves* recorded responses. A request without a fixture still reaches the server, and the
Playwright spec fails on any such request from a tour page that is not on the pass-through list.
The cost is capturing: fixtures drift from the API as it changes, and a stale fixture shows wrong or
missing data in the tour. Re-capturing them is the remedy, and the spec catches requests that go
unserved.
