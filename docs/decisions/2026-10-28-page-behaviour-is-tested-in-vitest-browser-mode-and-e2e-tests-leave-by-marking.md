# Page behaviour is tested in Vitest browser mode, and E2E tests leave by marking

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `src/test/browser/setup.ts` fails any browser test that makes an unmocked `/api/*`
  call; `playwright/constant/migration.ts` tags (`@migrated-browser`, `@migrated-java-it`) list
  what moved; reviewer for the layer a new test lands in
- **Related:** open-metadata/OpenMetadata#35623, open-metadata/OpenMetadata#36198,
  open-metadata/OpenMetadata#36327

## Context
Most Playwright time goes to checks of one page's behaviour (paging, URL state, pickers,
permission-driven controls) that need a full server stack only because Playwright has no other
way to render the page. They are slow, need seeded data, and fail for reasons unrelated to the
page. Rendering the real page in a real Chromium with only the network mocked gives the same UI
confidence at a fraction of the cost.

## Decision
- A page or feature working with its real children is tested in Vitest browser mode with MSW
  (`*.browser.test.tsx`), never with `vi.mock` of our own components. Every `/api/*` call must
  have a handler, and handlers mirror the server's real response shape.
- What the API does (CRUD, PATCH semantics, permissions, cursors, search results) is tested in a
  Java integration test.
- Playwright keeps journeys that cross features against a real server, and anything that needs
  the real search index or cross-page state.
- A Playwright test whose coverage moved is not deleted in the same change. It is tagged with
  `migratedTo.browser(file)`, `migratedTo.javaIT('Class#method')` or `migratedTo.split(...)`
  and keeps running until the replacement is validated; then it is deleted. Before a test that
  exercised a real-server contract is deleted, a Java IT must cover that contract.

## Consequences
Playwright shrinks to genuine flows and the browser suite runs without a backend on UI changes.
Browser tests can only check that the UI agrees with handlers the author wrote, so the handlers
must copy the server's shape, and the server half of any deleted E2E check must live in a Java
IT. Revisit if the mocked shapes drift from the server often enough that browser tests pass
against behaviour the server no longer has.
