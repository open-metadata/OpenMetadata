# UI integration tests (Vitest Browser Mode + MSW)

Real product components, real children, real router/react-query/i18n/styles, in a real
Chromium. Only the network is fake. No backend, no DB, no login.

```bash
yarn test:ui           # watch mode; add --ui to watch the page render live
yarn test:ui:run       # CI / headless
yarn test:ui:coverage  # istanbul -> src/test/browser/coverage (CI job summary; read by the nightly Sonar scan)
HEADED=true yarn test:ui:run   # see the browser
```

## Where a test goes

The rule, and how Playwright tests leave once covered here:
ADR:2026-10-28-page-behaviour-is-tested-in-vitest-browser-mode-and-e2e-tests-leave-by-marking.

| Assertion is about…                                                                                                                             | Layer                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| a pure function, hook, reducer, formatter, leaf component                                                                                       | Jest (`*.test.ts(x)`)                     |
| a page/feature working with its real children: paging, search, sort, URL state, forms, permission-driven rendering, empty/error states, visuals | **UI integration** (`*.browser.test.tsx`) |
| what the API does: CRUD, PATCH, permissions, cursors, search results, propagation                                                               | Java IT                                   |
| a journey across features against a real server                                                                                                 | Playwright E2E                            |

## Writing one

1. `renderApp(url)` mounts the whole signed-in app through the real `AuthenticatedAppRouter`
   (use for pages). `renderWithApp(<Component />, { url, path })` mounts one component.
   List pages: call `describePaginatedList(spec)` from `paginationContract.ts` instead of
   writing the steps again (see `PAGINATION_MIGRATION.md`).
2. `worker.use(http.get(...))` — mock only the endpoints the page calls. Unmocked `/api/*`
   calls fail the run, so nothing silently hits a network.
3. Build responses with the typed factories in `fixtures/`. Mirror the server's real shape
   (see `fixtures/table.ts#pageOf`, which copies `ChildFieldPageReader`'s paging).
4. Assert what a user sees (`page.getByText`, roles, test ids) and what the page sent
   (recorded request params) — never component internals.
5. Do not `vi.mock` our own components. If you need to, the test belongs in Jest.

## Rules

- File name: `<Component>.browser.test.tsx`, next to the component.
- One `describe` per page/feature, tests named after user-visible behaviour.
- Visual checks: `toMatchScreenshot(name)`. Baselines are committed for Linux (CI) only, so
  skip the comparison elsewhere (`test.skipIf(server.platform !== 'linux')`); set a viewport tall enough that the element
  fits, and park the pointer so nothing is hovered. Baselines are committed under
  `__screenshots__/`; regenerate with `--update`.

## Which tests run in CI

A pull request, and a merge-queue entry, runs only the test files that execute
the code it changes.
`scripts/select-browser-tests.mjs` reads a map of the source files each test
file executed (recorded by `impact.ts` and published as a workflow artifact, never
committed: the full run on main writes it, and a passing merge-queue entry
refreshes the entries of the tests it ran). It also follows the test helpers a test imports, and the direct
imports of every executed file (constants, styles, assets). Changed `en-us.json`
keys select the tests whose code names them.

Everything runs when the map is missing, or when a change touches test setup,
the Vitest/Vite config or dependencies. Changed code that no browser test
executes is listed in the job summary of the `UI Browser Tests` run, along with how many of the changed lines
the tests that ran executed. Main runs every test file every 6 hours when the UI
changed since the last full run (and by hand from the Actions tab), which refreshes the map and surfaces anything a
selection missed. This is the only full run. To
see what a branch would run:

```bash
node scripts/select-browser-tests.mjs --map impact-map.json --base origin/main
```

The policy is ADR:2026-11-25-browser-tests-are-selected-before-main-and-run-in-full-on-main.

The static import graph alone cannot do this here: lazy imports tie about
1,000 modules into one import cycle.

**Core components are treated like a library on pull requests.** A change to
`openmetadata-ui-core-components` runs core's own tests and build (the
`core components` job), not the browser tests: core guards its components with
its own tests, and this suite tests the app. The scheduled full run on main
still runs every browser test, so a core change that breaks the app is caught. A core change that alters behaviour
the app depends on needs a core test for that behaviour. A change touching both
core and this UI selects browser tests for the UI part only.
