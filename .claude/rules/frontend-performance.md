---
description: Frontend performance — request waterfalls, import bloat, re-render discipline, virtualization, bundle size
paths: "openmetadata-ui/src/main/resources/ui/**/*.{ts,tsx}"
---

# Frontend performance

Applies to UI `*.{ts,tsx}`. Component/hook conventions in `frontend-react.md`; styling in
`frontend-styling.md`; library choice in `component-library.md`.

## Data fetching — no request waterfalls

- **Fire independent requests in parallel.** Never `await` one call then `await` an unrelated one in
  the same effect/handler — use `Promise.all` / `Promise.allSettled` (`allSettled` when one failure
  must not blank the whole view).
  ```ts
  const [table, lineage] = await Promise.all([getTable(fqn), getLineage(fqn)]);
  ```
- **Only sequence when the second call needs the first call's data.** If it needs one field, fetch
  that field's source first and parallelize everything else against it.
- **Hoist the fetch to the owner of the data.** A parent that renders N children must not let each
  child fetch its own slice of the same resource — fetch once, pass down. N sibling components
  each firing the same GET is a waterfall bug, not caching.
- Prefer `@tanstack/react-query` (`useQuery`/`useQueries`) for server state so dedupe + cache are
  free; `useQueries` for a dynamic list of parallel fetches.
- **Never fetch inside a render body or inside a `map`.** Fetch in an effect/handler/query hook.
- Cancel or ignore stale responses on unmount / fast param changes (`AbortController` or a query key)
  so a slow first response can't overwrite a fast second one.

## Imports & bundle

- **Import from deep paths, not app-internal `index.ts` barrels.** A barrel re-export pulls every
  sibling module into the graph, defeating tree-shaking and inflating chunks.
  ```ts
  import { MyThing } from './MyThing/MyThing.component'; // yes
  import { MyThing } from './MyThing';                   // no (barrel)
  ```
  Exception: `@openmetadata/ui-core-components` is consumed by bare package name — keep that.
- **Never `import _ from 'lodash'` or `import * as _ from 'lodash'`.** Use named members only:
  `import { isEmpty, groupBy } from 'lodash';`.
- **Lazy-load routes and heavy widgets** with `React.lazy`. Every lazy component must be passed to
  an approved helper from `components/AppRouter/withSuspenseFallback`, or rendered in a real React
  `Suspense` boundary with an explicit `fallback`. Anything importing a graph, editor, chart, diff,
  or markdown renderer must be lazy — never in a route's top-level import.
- **Router modules must not statically import page modules.** Runtime imports whose path contains
  `pages/` must use `import()` so the page stays in a deferred chunk. Type-only imports are allowed.
- Keep critical entity headers eager, then defer secondary tabs and expensive visualizations behind
  the nearest useful loading boundary. Preserve `ref` behavior when wrapping a ref-sensitive lazy
  component.
- Prefer direct imports for pure utilities. Code splitting a small utility creates request overhead
  without reducing meaningful render work.
- Do not add a new dependency for something the repo already has, and never add a second UI
  component library (see `component-library.md`).

## Loading and prefetching

- Loading fallbacks belong at the smallest boundary that can render independently; avoid replacing
  an entire page when only a secondary panel is deferred.
- Prefetch only from a clear user signal or an established high-confidence navigation path. Do not
  indiscriminately idle-prefetch settings, admin, graph, or editor chunks.
- React Query prefetching is intentional cache warming: use the same query key and stale-time policy
  as the destination query so it does not become a duplicate fetch.
- When deferring extension or plugin requests, validate that no synchronous render path still needs
  their data; moving the request later must not introduce a render-time waterfall.

## Re-renders

- **Inline object/array/function props defeat `React.memo`** — a new identity every render makes the
  memo comparison always fail. `style={{ margin: 8 }}`, `options={[...]}`, `onClick={() => …}` on a
  memoized child are all bugs. Hoist constants to module scope; wrap the rest.
- `useMemo` / `useCallback` pay off when the value is (a) a dep of another hook, (b) a prop to a
  memoized child, or (c) genuinely expensive to compute. Everywhere else they are noise that costs
  allocations and obscures the code — do not wrap scalars, string concatenation, or a handler passed
  to a plain DOM element.
- **Fix the dependency, not the symptom.** Memoizing a value whose deps change every render does
  nothing; find the unstable dep first.
- Context value objects must be memoized — an unmemoized `value={{ a, b }}` re-renders every consumer
  on every provider render. Split contexts when fast-changing and slow-changing state share one.
- Keep state as local as possible; lifting state up re-renders the whole subtree. Do not put
  high-frequency values (input text, scroll, hover, drag position) in a global Zustand store or a
  top-level context.
- Use stable `key`s from entity ids/FQNs — never the array index for reorderable or filterable lists.

## Rendering work

- **No expensive work in the render body**: sorting/filtering/mapping large arrays, `JSON.parse`,
  regex compilation, date formatting per row, or building lookup maps. Precompute in `useMemo` or
  outside the component.
- **Virtualize any list that can exceed ~100 rows** (or any list with rich row content over ~50).
  Paginate server-side where the API supports it — prefer paging over rendering-then-hiding.
- Never render the full result set and hide overflow with CSS.
- Debounce/throttle search inputs, `resize`, and `scroll` handlers; passive listeners for scroll.
- Guard against layout thrash: don't read `getBoundingClientRect` in a loop that also writes styles.

## Caches

- Every module-level `Map` or `Set` used as a cache must have an explicit numeric or named uppercase
  size limit and an eviction path using `delete` or `clear`. Prefer LRU behavior when stale entries
  are inexpensive to recreate.
- Cache hits and misses both consume capacity. Bound negative-result caches as carefully as successful
  results, and dispose retained browser resources such as textures when evicting them.
- Before adding a UI cache, check whether the API client, React Query, or a lower layer already owns
  the same data. Avoid parallel caches with different invalidation rules.

## Mechanically enforced rules

ESLint blocks these zero-backlog invariants:

- `openmetadata-performance/no-eager-page-imports` in AppRouter modules.
- `openmetadata-performance/require-suspense-fallback` for every React lazy call.
- `openmetadata-performance/no-unbounded-module-cache` for module-level cache-like `Map` and `Set`
  bindings.

ESLint also reports these backlog-bearing invariants as non-blocking warnings:

- Pure utilities cannot contain JSX or depend on React, UI/state layers, pages, hooks, or REST.
- Lower layers cannot import pages; page features cannot import other page features; REST and hooks
  cannot depend upward on UI layers.
- Runtime circular imports and app-internal barrel imports are reported; type-only imports do not
  create runtime cycle/barrel findings.
- Lodash default/namespace imports, REST calls inside iteration, and potentially sequential REST
  calls are reported for direct-import, bulk-fetch, or parallelization review.

The exact rule names, measured baselines, and CI visibility are documented in
`docs/ui-code-quality-gate.md`.

Use a narrow `eslint-disable-next-line` only when a test deliberately exercises the boundary helper
itself and therefore owns the fallback in the test case. Include the reason beside the suppression.
