---
description: Which UI test layer a check belongs in, and how to write a Vitest browser test
paths: "openmetadata-ui/src/main/resources/ui/{src/**/*.browser.test.tsx,src/test/browser/**,playwright/e2e/**}"
---

# UI tests: pick the layer, then write a browser test

Applies to browser tests (`*.browser.test.tsx`, `src/test/browser/**`) and to Playwright specs, because
most checks people write in Playwright belong in a browser test.
The rule: ADR:2026-10-28-page-behaviour-is-tested-in-vitest-browser-mode-and-e2e-tests-leave-by-marking.

## Pick the layer

| The assertion is about… | Layer |
|---|---|
| A pure function, hook, reducer, formatter or leaf component | Jest (`*.test.ts(x)`) |
| A page or feature with its real children: paging, search, sort, URL state, forms and validation, permission-driven controls, pickers, empty/error states, visuals | **Browser test** (`*.browser.test.tsx`) |
| What the API does: CRUD, PATCH semantics, permissions, cursors, search results, propagation | Java IT (`openmetadata-integration-tests`) |
| A journey across features against a real server; the real search index, cross-page state, auth/SSO, async jobs, the production build | Playwright (`playwright/e2e/**`) |

A Playwright test must fail for a reason no cheaper layer could catch. If the assertion would still mean
something with the backend mocked, write a browser test. If it would still mean something without a
browser, write a Java IT.

## Writing a browser test

Real Chromium (Vitest browser mode), real components and providers. Only the network is mocked (MSW).
`src/test/browser/README.md` has the details and commands (`yarn test:ui`, `yarn test:ui:run`).

- Mount with `renderApp(url)` (the whole signed-in app) or `renderWithApp(<Component />)`.
- Mock only what the page calls (`worker.use(...)`). An unmocked `/api/*` call fails the test, so never
  leave one to pass silently.
- Build responses with the typed factories in `src/test/browser/fixtures/`, shaped like the server's
  real response. Reuse `serveEntity` (PATCH applies the JSON patch), `servePersona` (permissions from the
  seeded policies) and `serveSearch` rather than writing new handlers.
- Assert what the user sees **and** what the page sent (`server.patches`, query params, request count).
- Never `vi.mock` our own components; a test that needs it belongs in Jest.
- Long cold-load waits use `scaled(ms)` / `suiteTimeout(ms)` from `src/test/browser/timeouts.ts`;
  coverage runs are about 2× slower.
- A click a re-render can drop (pickers, panel tabs) goes through `openPicker(trigger, ready)`; a pick
  is confirmed from the DOM's own state (`setSelected`). Do not add sleeps or retries.

## Moving a Playwright test

Do not delete it in the same change. Tag it with its replacement and leave it running until the
replacement is validated:

```ts
import { migratedTo } from '../../constant/migration';

test('Tier add, update and remove', migratedTo.browser('src/test/browser/…/X.browser.test.tsx'), async …);
test('PATCH keeps owners', migratedTo.javaIT('TableResourceIT#patch_owners_200'), async …);
test('…', migratedTo.split('src/…/X.browser.test.tsx', 'Class#method'), async …);
```

`npx playwright test --list --grep @migrated-browser` (or `@migrated-java-it`) lists what moved.
