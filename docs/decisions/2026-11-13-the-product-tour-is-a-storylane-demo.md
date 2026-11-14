# The product tour is a Storylane demo, opened full screen in the learning resource player

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** UI team, product
- **Guard:** `openmetadata-ui/src/main/resources/ui/src/components/ProductTour/ProductTourModal.test.tsx`,
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
  button open the product tour: the Learning Center's resource player popup, showing the Storylane
  demo. There is no `/tour` route; the popup opens over the page the user is on.
- The popup asks the browser for full screen as it opens, from the click that opened it. When the
  browser refuses, it stays at the popup's size. The user leaves full screen and closes it as they
  would a learning resource.
- `ProductTourClassBase.getTourUrl()` returns the demo's URL. A distribution overrides it to show its
  own demo. The URL is a Storylane demo link, which keeps pointing at the latest published version of
  the demo, so updating the demo's content needs no code change.
- The tour is not a stored learning resource: the player shows it as given and does not fetch it, and
  it appears in no Learning Center list.
- Tests that open the tour answer the Storylane request themselves rather than reach the network.

## Consequences

- Tour content belongs to whoever edits the demo in Storylane; a UI change needs a new capture
  there, not new fixtures here.
- The tour needs the browser to reach `*.storylane.io`. An instance without internet access, or one
  whose Content-Security-Policy does not allow that origin in frames, shows an empty player. Revisit
  if such deployments need a tour: they would need an offline fallback.
- The demo shows the hosted product, not the user's own data or permissions.
