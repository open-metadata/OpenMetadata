# UI integration tests (Vitest Browser Mode + MSW)

Real product components, real children, real router/react-query/i18n/styles, in a real
Chromium. Only the network is fake. No backend, no DB, no login.

```bash
yarn test:ui           # watch mode; add --ui to watch the page render live
yarn test:ui:run       # CI / headless
yarn test:ui:coverage  # istanbul -> src/test/browser/coverage (Sonar unions it with Jest)
HEADED=true yarn test:ui:run   # see the browser
```

## Where a test goes

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
- Visual checks: `toMatchScreenshot(name)`; set a viewport tall enough that the element
  fits, and park the pointer so nothing is hovered. Baselines are committed under
  `__screenshots__/`; regenerate with `--update`.
