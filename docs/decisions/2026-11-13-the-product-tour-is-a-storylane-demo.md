# The product tour is a Storylane demo in its own modal, opened full screen

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial) · v2 2026-11-18 (OpenMetadata's own demo replaces the placeholder; a distribution may show a demo per app mode)
- **Deciders:** UI team, product
- **Guard:** `openmetadata-ui/src/main/resources/ui/src/components/ProductTour/ProductTourModal.test.tsx`,
  `openmetadata-ui/src/main/resources/ui/src/components/ProductTour/ProductTour.test.tsx`,
  `openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/WelcomeScreen.spec.ts` (the Welcome
  screen's tour button opens the demo)
- **Related:** supersedes ADR:2026-10-23-the-product-tour-serves-its-pages-from-recorded-fixtures

## Context

The in-app tour walked the real pages on recorded API fixtures. It needed a step list, a target
marker on every page it visited, a request mock, and fixtures re-recorded whenever a page changed;
a distribution added its own steps, pages and fixtures on top. When the landing page was redesigned
its first step lost its target and the tour no longer started, and it was removed. The team already
publishes interactive Storylane demos in the Learning Center, and product preferred one for the
tour: a designer updates it without a release, and it shows populated pages on an empty instance.

## Decision

- Help > Tour (in both the classic navbar and the AI-mode user menu) and the Welcome screen's tour
  button open the product tour through `useProductTourStore`. There is no `/tour` route: the tour
  opens over the page the user is on, and signing out closes it.
- The tour is its own modal, `ProductTourModal`, not the Learning Center's resource player: a
  full-screen modal (`presentation="fullscreen"`) titled after the tour, with a close button, that
  shows the demo in the Learning Center's `StorylaneTour` frame. It opens filling the window rather
  than asking the browser for full screen, so it never depends on the opening click's permission. A
  header button switches it to a popup the size of the Learning Center player and back.
- The app shell mounts only `ProductTour`, which loads `ProductTourModal` when the tour opens.
- `ProductTourClassBase.getTourUrl()` returns the demo's URL, OpenMetadata's own demo. A
  distribution overrides it to show its own demo, and may pick one per app mode: the modal reads the
  URL each time it opens. The URL is a Storylane demo link, which keeps pointing at the latest
  published version of the demo, so updating the demo's content needs no code change.
- Tests that open the tour answer the Storylane request themselves rather than reach the network.

## Consequences

- Tour content belongs to whoever edits the demo in Storylane; a UI change needs a new capture
  there, not new fixtures here.
- The tour needs the browser to reach `*.storylane.io`. An instance without internet access, or one
  whose Content-Security-Policy does not allow that origin in frames, shows an empty player. Revisit
  if such deployments need a tour: they would need an offline fallback.
- The demo shows the hosted product, not the user's own data or permissions.

## Amendment

v2 (2026-11-18): OpenMetadata's demo is published, so `PRODUCT_TOUR_URL` points at it instead of
the placeholder Collate demo. Collate publishes one demo for Classic mode and one for AI mode, and
shows the one for the mode the user is in; `getTourUrl()` already runs each time the tour opens, so
that needed no change to the class base or the modal.
