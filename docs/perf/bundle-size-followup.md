# Bundle-size follow-up plan

Companion to the perceived-latency PR. The wins already shipped target *delivery*
(compression, caching, prefetch). The wins below target *bundle size* — the bytes that
ever reach the browser regardless of how well we cache them.

## Baseline measurements

Run on `harshach/perceived-latency-p1` at commit `ca0d22304d` (after chunk-splitting), via
`yarn build --mode analyze` — full artifact at `dist/bundle-stats.{html,json}`.

| Chunk (after split) | Raw | Brotli | Loaded eagerly? |
|---|---|---|---|
| `AsyncDeleteProvider` (shared) | 4.9 MB | 851 KB | Yes (via NavBar) |
| `vendor-antd` | 2.1 MB | 484 KB | Yes (modulepreload) |
| `vendor-elkjs` | 1.4 MB | 327 KB | No (lineage only) |
| `preset` (`@antv/g6` + `html2canvas`) | 1.4 MB | 320 KB | No (Ontology/KnowledgeGraph) |
| `vendor-recharts` | 398 KB | 85 KB | **Yes** (should be lazy) |
| `vendor-quill` | 400 KB | 90 KB | **Yes** (should be lazy) |
| `vendor-prosemirror` | 397 KB | 108 KB | No |
| `vendor-codemirror` | 277 KB | 80 KB | No |
| `vendor-reactflow` | ~130 KB | ~50 KB | **Yes** (should be lazy) |
| `vendor-datagrid` | ~80 KB | ~32 KB | **Yes** (should be lazy) |
| `vendor-latex` | 262 KB | 62 KB | No |
| `vendor-logviewer` | ~110 KB | ~40 KB | No |

The four marked **Yes / should be lazy** are the highest-ROI gaps. Vite emits a
`<link rel="modulepreload">` tag for each because there's a static-import path from the
entry chunk to the lib. Each one is the same shape of fix — find the static-import path,
move it behind a `React.lazy` or dynamic `import()`.

## Remaining contributors in the `AsyncDeleteProvider` chunk

| Module | Raw | Notes |
|---|---|---|
| `src/jsons/ingestionSchemas/testSuitePipeline.json` | 504 KB | Connection schema imported eagerly |
| `react-dom/server` (CJS + browser builds) | 421 KB | Legitimate — `renderToString` for diff/icon HTML. **Keep.** |
| `src/constants/mockTourData.constants.ts` | 113 KB | Product-tour mock data — only used when `isTourOpen` |
| `src/generated/antlr/EntityLinkLexer.js` | 69 KB | ANTLR-generated lexer for entity-link parsing |
| `src/components/DataContract/ODCSImportModal` | 67 KB | Modal — should be lazy on modal open |
| `src/jsons/connectionSchemas/.../airflowConnection.json` | 65 KB | One of N connection schemas |
| `cronstrue` | 54 KB | Cron-expression formatter — scheduler views only |
| `focus-trap` | 51 KB | Modal focus management |
| Multiple other connection-schema JSONs | ~500 KB total | One per data service |

## Follow-up PRs (ordered by ROI per effort)

### PR-1: Lazy-load Lineage + Workflow Builder (1 day)

Statically-imported files that pull `reactflow` into the entry:
- `src/utils/EntityLineageUtils.tsx`
- `src/utils/NodeUtils.ts`
- `src/utils/ViewportUtils.ts`
- `src/utils/EdgeStyleUtils.ts`
- `src/utils/WorkflowSerializer.ts`
- `src/utils/CanvasUtils.ts`
- `src/utils/EdgeMidpointUtils.ts`
- `src/hooks/useWorkflowLogic.ts`
- `src/hooks/useCanvasEdgeRenderer.ts`
- `src/hooks/useMapBasedNodesEdges.ts`
- `src/hooks/useWorkflowActions.ts`
- `src/context/LineageProvider/LineageProvider.tsx`

`EntityLineageTab.tsx` is *already* dynamic-imported in 10+ entity-utils files, so the
tab itself is lazy. The leak comes from these util/hook modules being statically imported
by code that runs at app boot.

**Fix shape**: convert the static `import` of `reactflow` types to `import type` (erased
at compile-time, zero runtime cost), and split runtime usage out into one file that's
only loaded when the lineage canvas mounts. Most of the reactflow imports in these utils
are actually `import { Edge, Node }` for *types* — those can become `import type` immediately
without behaviour change.

Expected win: `vendor-reactflow` drops out of modulepreload. Cold first paint loses ~50 KB
brotli + the chunk-discovery round-trip.

### PR-2: Lazy-load chart components (4 hours)

`recharts` is statically imported by ~10 chart components. The components themselves can
stay statically imported in their parent files, but each component should be wrapped in
`React.lazy` at its consumption site (the dashboard widget, the profiler page, etc.).

**Expected win**: `vendor-recharts` drops out of modulepreload. ~85 KB brotli saved on first
paint for users who don't immediately hit a chart view.

### PR-3: Lazy-load FeedEditor (Quill) (4 hours)

`FeedEditor.tsx` statically imports `quill` and is rendered in the activity-feed widget on
`/my-data`. Wrap `FeedEditor` in `React.lazy` at the widget level and gate the eager mount
behind user interaction (clicking the "comment" trigger).

**Expected win**: `vendor-quill` drops out of modulepreload. ~90 KB brotli saved.

### PR-4: Lazy-load mockTourData (4 hours)

Five consumers (`TableDetailsPageV1`, `DashboardDetailsPage`, etc.) statically import
`mockDatasetData` from `mockTourData.constants.ts`. Each use is gated on `isTourOpen`,
so the static import is pure waste in the 99% non-tour case.

Pattern: replace the static import with an async loader cached at module level. The
consumer becomes:

```ts
const [tourData, setTourData] = useState(null);
useEffect(() => {
  if (!isTourOpen) return;
  import('../../constants/mockTourData.constants').then(m => setTourData(m.mockDatasetData));
}, [isTourOpen]);
```

**Expected win**: 113 KB raw / ~25 KB brotli removed from the always-loaded
`AsyncDeleteProvider` chunk.

### PR-5: Lazy-load `react-data-grid` (2 hours)

Used by `BulkImportVersionSummary` and CSV utility code. Wrap the consuming components in
`React.lazy`.

**Expected win**: `vendor-datagrid` drops out of modulepreload. ~32 KB brotli saved.

### PR-6: Lazy connection schemas (1-2 days)

The connection-schema JSONs (`testSuitePipeline.json`, `airflowConnection.json`,
`hiveConnection.json`, ...) total ~620 KB raw in the AsyncDeleteProvider chunk. They're
imported via a registry that maps service-type → schema.

Refactor: change the registry from `{ snowflake: snowflakeSchema, ... }` (static imports)
to `{ snowflake: () => import('./snowflake.json'), ... }` (dynamic). Resolve the schema
only when the connection form mounts for that service type.

**Expected win**: ~150 KB brotli removed from `AsyncDeleteProvider`. Each service's schema
loads only when its form is opened — typical user touches 1-2 schemas per session.

### PR-7: Lazy-load `cronstrue` (2 hours)

Used in `DateTimeUtils` + 4 settings/scheduler views. Convert to async loader at the call
site.

**Expected win**: ~15 KB brotli removed.

## Other knobs worth measuring

### Rolldown

Vite 7 has experimental Rolldown support via the `rolldown-vite` package. Rolldown is
Rollup's Rust-based replacement; same config, faster builds, somewhat smaller output. Worth
swapping in once Rolldown reaches GA. Spec'd by Vite team as "drop-in" but worth a
dedicated soak.

### `vite-imagetools` for image conversion

Many of the in-repo PNGs (governance.png, data-collaboration.png, the various favicons)
could ship as `.webp` or `.avif` for 30-50% size reduction. The `vite-imagetools` plugin
applies the conversion at build time.

### Drop duplicate icon libraries

We use `@ant-design/icons`, `@untitledui/icons`, AND various inline SVGs. A consolidation
audit might find substantial duplication.

### Antd subset

Antd 5 supports per-component imports (e.g., `import { Button } from 'antd/es/button'`).
The current code does barrel imports (`import { Button, Modal } from 'antd'`) which tree-shake
*okay* in modern bundlers but not perfectly. Direct paths would shave ~10-20% off
`vendor-antd`.

## Measurement protocol for each follow-up PR

1. Baseline: `yarn build --mode analyze`, save `dist/bundle-stats.json` to `docs/perf/`.
2. Apply change.
3. Re-run analyzer, diff the two JSONs.
4. Commit message includes the numeric delta: before/after raw KB, before/after brotli KB,
   chunks removed from modulepreload list.

This makes regressions detectable: a future PR that grows the bundle by 100 KB shows up as
a numeric delta in CI, not a vague "feels slower."
