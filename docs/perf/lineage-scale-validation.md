# Lineage scale validation

Published p95 for the hierarchical lineage surface (`GET /v1/lineage/scene` and the lineage map
that renders it), plus how to reproduce it.

> **No numbers are published yet.** The harness landed first; the first nightly run is the
> measurement. See [Status](#status).

Related: [`open-metadata/OpenMetadata#32050`](https://github.com/open-metadata/OpenMetadata/issues/32050)
(scale validation), [`open-metadata/openmetadata-collate#3016`](https://github.com/open-metadata/openmetadata-collate/issues/3016)
(the benchmark harness), PR #29204 (the surface under test).

## What is measured

`LineageScenePerformanceScaleIT`
(`openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/search/scale/`) seeds a
hierarchy-shaped lineage graph, then samples each scene shape with 5 warmups + 20 measured runs and
reports p50/p95/p99/max.

| Scenario | What it exercises |
|---|---|
| `root-layer-warm`, `root-asset-warm` | the shared root-scene cache on its happy path |
| `root-asset-cold`, `root-asset-wide-cold` | the same scenes with the cache defeated; `-wide-` uses `size=1000`, which fans out to ~40 root-asset searches |
| `focused-service-asset` … `focused-schema-asset` | one scene per level the map drills through |
| `focused-hub-asset`, `focused-hub-field`, `focused-hub-asset-depth3` | the expensive path — a high-degree node, where `enrichFocusedChildLineage` issues up to 50 `searchLineage` calls at 6-way parallelism |
| `focused-leaf-asset` | the cheap end, for contrast |
| `legacy-get-lineage-depth3`, `legacy-entity-count-downstream` | the pre-#29204 endpoints over the same graph — the current-vs-previous axis |
| `lineage-map-first-render-cold` | browser navigate → graph ready |

### Exploration scenarios

First render only covers *arriving* at a scene. These cover *moving between* them, which is where a
user spends their time and where the expensive focused path is hit repeatedly. Each sample runs on a
fresh page — the map keeps a per-instance scene cache that would otherwise make later samples warm —
and getting to the interaction's starting state is untimed.

| Scenario | What it exercises | Reaches the server? |
|---|---|---|
| `interaction-drill-service` | root → click a service → ASSET scene focused on it | yes, new `focusFqn` ⇒ cache miss |
| `interaction-drill-database` | service → click a database → ASSET | yes |
| `interaction-drill-schema` | database → click a schema → ASSET | yes |
| `interaction-drill-table-to-fields` | schema → click a table → FIELD | yes |
| `interaction-breadcrumb-pop-to-layer` | breadcrumb back to the root scene | **no** — see below |
| `interaction-semantic-zoom-in` | zoom past the drill-in threshold | yes |
| `interaction-semantic-zoom-out` | zoom past the pop threshold → parent scene | **no** — see below |
| `interaction-band-switch-prefetched` | band switch on an unchanged focus | **usually not** — see below |
| `interaction-fit-to-screen` | re-frame the graph | **never** |

Three behaviours of the map make these numbers mean something other than what they look like, so
they are worth stating plainly:

- **A band switch on an unchanged focus is usually free.** The map prefetches adjacent bands 300ms
  after every render, reusing the same `focusFqn`. So `interaction-band-switch-prefetched` typically
  serves from the client cache with no HTTP and no loader — it measures **ELK layout, not server
  time**. Same for `interaction-fit-to-screen`, which never fetches. A regression in those two is a
  layout regression. That is useful precisely *because* it is separable from the API's.
- **Going back up is served from the client cache too.** Both `interaction-breadcrumb-pop-to-layer`
  and `interaction-semantic-zoom-out` return to the root scene the page loaded moments earlier in
  setup, and the map keeps a per-instance scene cache keyed on the full request — so the pop is a
  cache hit and, like the band switch, measures layout. (A pop to a scene the page never visited
  would fetch; the benchmark does not measure that case.)
- **The drill hierarchy is deeper than the bands.** The map's `getDrillBand` keeps container nodes
  in the ASSET band — service → database → schema are three separate ASSET scenes — and only a
  table drills into FIELD. That is why each level is its own scenario. It also rules out the rail's
  active band dot as a ready signal for drills: it cannot tell one ASSET scene from the next, so a
  same-band drill would "finish" instantly. Drills instead wait for the root badge on the clicked
  node, which the map renders only on the focused node of a committed, laid-out scene; every
  band-based wait refuses to run when the band is not changing.
- **Zoom-in is not a band toggle.** Crossing the zoom-in threshold makes the map pick the expandable
  node nearest the viewport centre and *drill into it*, so focus changes as well as band. Zoom-out
  pops to the parent scene via the breadcrumb.
- **The zoom gesture has a 1.2s dead window.** Semantic zoom is suppressed for
  `PROGRAMMATIC_ZOOM_SUPPRESSION_MS` after every scene load and every navigation, and the
  zoom-crossing baseline is rebased when it closes. The benchmark waits that out in untimed setup —
  it is the map's own cooldown, not its latency. (This is also why the TS suite's
  `performZoomOut(page, 10)` never changes band: all ten clicks land inside the window.)

Zoom is driven through the `zoom-in`/`zoom-out` controls rather than a wheel gesture. That is not a
shortcut: `handleMove` ignores the event source, so React Flow's programmatic zoom reaches the same
semantic-zoom path a wheel does.

### Cold vs warm is not a detail

`LineageSceneCache` is a process-wide singleton (`maximumSize(50)`, TTL `cacheTTLSeconds`, default
300s) keyed on `(lens, band, upstreamDepth, downstreamDepth, size, queryFilter, includeDeleted)`.
`focusFqn` is **not** in the key, and the cache is only populated for unfocused scenes requested by
a caller needing no per-entity authorization. So root scenes go warm from the second sample, while
every focused scene is always cold. **Comparing a `-warm` p95 against a `-cold` one is
meaningless.** The `-cold` root scenarios vary `size` per sample specifically to defeat the key.

### What "first render" means

The map defers `setLoading(false)` until *after* ELK has positioned the nodes, deliberately, so
that "loader gone" means "graph ready" rather than "HTTP response received". `LineageMapPage`
therefore waits on three conditions together: the `lineage-map-canvas` testid visible (it only
renders once the scene has at least one node), zero `loader` elements, and at least one
`lineage-node-*` attached. Only the visible subset of nodes is ever in the DOM
(`onlyRenderVisibleElements`), so waiting for all of them would hang.

Two things sit just outside the measurement and are worth knowing when reading it: the map fires
prefetch requests for adjacent bands 300ms after render, and fit-view is triple-`requestAnimationFrame`'d.

## Reproducing

### Nightly (default cohort)

Runs in `open-metadata/openmetadata-nightly` `.github/workflows/k8s-java-it.yml`, `scale-it` job.
Metrics land in `openmetadata-integration-tests/target/benchmark/lineage-scene-scale-<tables>.json`
and are collected as the `scale-metrics-*` artifact.

```bash
mvn verify -P scale-it -pl :openmetadata-integration-tests -Dskip.embedded.bootstrap=true \
  -Dit.test=LineageScenePerformanceScaleIT -Dfailsafe.failIfNoSpecifiedTests=false
```

### Large cohorts (the #32050 2M target)

```bash
export OM_URL=https://om.example.com/api OM_ADMIN_TOKEN=...
LINEAGE_TABLES=2000000 LINEAGE_EDGES=2000000 LINEAGE_SCHEMAS_PER_DATABASE=50 \
  ./scripts/lineage-scale-benchmark.sh
```

Publishes to `docs/artifacts/lineage-scale/<date>-<label>/` with a `manifest.json` carrying
`productionCommit`, `outcome` and `workload`, following the `docs/artifacts/rdf-scale/` convention.

**This is hours, not minutes.** There is no bulk lineage endpoint — every edge is one
`PUT /v1/lineage` — and table creation measured ~56/s at the nightly's 8 workers. 2M assets is
therefore a deliberate, on-demand run against a long-lived cluster, not something the scheduled
nightly can absorb. `SKIP_CLEANUP` defaults to `true` here so a multi-hour corpus survives the run.

### Knobs

All `-Djpw.lineage.*`, matching the `jpw.scale.tables` convention of the sibling scale ITs.

| Property | Default | |
|---|---:|---|
| `jpw.lineage.tables` | 50000 | clears `mediumGraphThreshold` (50000) in `LineageGraphConfiguration` |
| `jpw.lineage.edges` | 50000 | |
| `jpw.lineage.services` | 20 | |
| `jpw.lineage.databasesPerService` | 5 | |
| `jpw.lineage.schemasPerDatabase` | 5 | ⇒ 500 schemas, 100 tables each at the default |
| `jpw.lineage.depth` | 8 | DAG layers |
| `jpw.lineage.hubCount` / `.hubFanout` | 10 / 500 | the high-degree nodes the focused scenarios target |
| `jpw.lineage.columnsPerTable` | 5 | |
| `jpw.lineage.columnEdgeRatio` | 0.2 | fraction of edges carrying column lineage, for the FIELD band |
| `jpw.lineage.warmups` / `.samples` | 5 / 20 | API scenarios |
| `jpw.lineage.renderSamples` | 5 | first render |
| `jpw.lineage.interactionWarmups` / `.interactionSamples` | 1 / 5 | exploration scenarios; each sample is a fresh page load, so raising this is expensive |
| `jpw.lineage.seed` | 20260923 | the graph is deterministic for a given seed |
| `jpw.lineage.skipCleanup` | false | |
| `jpw.lineage.*P95Ms` | see below | per-group budgets |

Note on sample count: at 20 samples the nearest-rank p99 *is* the max and p95 is the
second-highest. Raise `jpw.lineage.samples` before reading either as a genuine tail.

## Comparing two runs

```bash
.github/scripts/compare_benchmark_metrics.py --baseline ./run-1.13 --candidate ./run-2.0
```

Emits a per-scenario delta table. Regression detection is a **signal**: `--fail-on-regression` must
be passed explicitly for a non-zero exit, matching `evaluate_playwright_performance.py`. Two
different nightly runs are not a controlled experiment — treat a flagged scenario as something to
reproduce, not as proof. `schemaVersion` guards the pairing: the script refuses to diff across a
published-field rename rather than silently comparing fields that no longer mean the same thing.

## Status

| | |
|---|---|
| Harness | landed |
| Budgets | **placeholders** — `rootSceneP95Ms=10000`, `focusedSceneP95Ms=20000`, `legacyP95Ms=60000`, `firstRenderP95Ms=60000`, `interactionP95Ms=60000` |
| Published p95 | **none yet** |

The budgets above are deliberately generous and are not measurements. They exist so the assertion
is in the test from day one without a red build built on an invented threshold. **Replace them from
the first nightly run**, then fill in the table below and record the artifact under
`docs/artifacts/lineage-scale/`.

### Published results

_(empty — first run pending)_

| date | commit | assets | edges | scenario | p95 | artifact |
|---|---|---|---|---|---|---|

## Known risks this benchmark is expected to surface

- `LineageSceneQuery` builds **case-insensitive wildcard queries** (`fieldClause`,
  `parentFieldQuery`, and `searchFeederDocuments` wildcarding `focusFqn + ".*"`) against
  high-cardinality keyword fields. That is the most likely scaling cliff.
- `LineageSceneTasks.runBounded` cancels child-lineage lookups after 15s and flips the scene's
  `sampled` flag rather than failing. `sampled` and the node counts are published as counters for
  exactly this reason — a p95 that improved because the response got smaller must be visible, not
  celebrated.
- `LineageRepository.getUpstream/DownstreamLineage` resolves an entity reference per record inside
  its recursion (an N+1), bounded only by the endpoint's `@Max(3)`.
