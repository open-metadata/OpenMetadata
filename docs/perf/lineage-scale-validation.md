# Lineage scale validation

Published p95 for the hierarchical lineage surface (`GET /v1/lineage/scene` and the lineage map
that renders it), plus how to reproduce it.

> **No numbers are published yet.** The harness, the nightly wiring and the trend page have
> landed; the first nightly runs are the measurement. See [Status](#status).

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
| `entity-lineage-by-fqn-depth1`, `entity-lineage-by-fqn-depth3` | `GET /v1/lineage/table/name/{fqn}`: the DB-backed lineage with its per-record reference lookups, at both ends of its `@Max(3)` depth |
| `platform-lineage-service` | `GET /v1/lineage/getPlatformLineage?view=service` |
| `lineage-downstream-depth3` | `GET /v1/lineage/getLineage/Downstream`, the paged directional search |
| `lineage-pagination-info` | `GET /v1/lineage/getPaginationInfo` over three hops each way |
| `lineage-edge-by-name` | `GET /v1/lineage/getLineageEdge/...`, the edge panel's call, on the hub's first real downstream edge |
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
  same-band drill would "finish" instantly. Drills instead wait for the focused scene's own nodes:
  a child of the focused container, or the root badge on a focused asset, which the map renders
  only once that scene is committed and laid out. Every band-based wait refuses to run when the
  band is not changing. An interaction the map cannot complete is recorded in the report
  (`interactionFailures`, `failedInteractions`), and the rest still run. The test fails at the end
  with the list.
- **Drills follow the benchmark graph's own path.** Each drill clicks the next node on the focus
  path (service → database → schema → hub table) when it is on screen. Only otherwise does it take
  the first clickable expandable child. The nightly cluster also holds every other suite's
  services, so "the first node" would be a different service every night, and React Flow keeps
  some nodes in the DOM outside the visible pane, where a click never lands. A trial click
  (Playwright's hit test, no click) filters those out.
- **Every timed drill starts from a settled map.** The untimed setup waits out the map's
  post-render work (the 300ms prefetch of adjacent bands and the semantic-zoom cooldown), so the
  timed drill does not share the browser and the server with it.
- **Semantic zoom clicks until the threshold is crossed.** The threshold is an absolute zoom
  level, and a root scene of a few hundred services fits the view much further out than one of
  twenty. A fixed number of clicks therefore only crosses it on small graphs, so the benchmark
  clicks until the band changes (at most 40 times).
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

Runs in `open-metadata/openmetadata-nightly` `.github/workflows/k8s-java-it.yml` as the **last**
`scale-it` matrix entry, after the destructive `ServiceDeleteSearchCleanupScaleIT`, so it measures a
quiet cluster and its own 50k seed cannot slow the classes after it. It runs with
`-Djpw.lineage.skipCleanup=true` — the cluster is thrown away anyway — and with
`-Djpw.bench.gitSha` set to the OpenMetadata commit (the default, `GITHUB_SHA`, would name the
nightly repository's commit). Metrics land in
`openmetadata-integration-tests/target/benchmark/lineage-scene-scale-<tables>.json` and are
collected as the `scale-metrics-*` artifact, which the `latency-report` job reads (see
[Trends and the regression gate](#trends-and-the-regression-gate)).

```bash
mvn verify -P scale-it -pl :openmetadata-integration-tests -Dskip.embedded.bootstrap=true \
  -Dit.test=LineageScenePerformanceScaleIT -Dfailsafe.failIfNoSpecifiedTests=false
```

### Large cohorts (the #32050 2M target)

Seed once with [`scripts/lineage_seed`](../../scripts/lineage_seed/README.md) — a realistic
platform with descriptions, tags, owners, domains, data products, column lineage and hub
dimensions, resumable across interruptions — then point the benchmark at it as often as needed:

```bash
python3 scripts/lineage_seed/seed_lineage_graph.py seed --server https://om.example.com --assets 2000000
export OM_URL=https://om.example.com OM_ADMIN_TOKEN=...
LINEAGE_SEED_MANIFEST=$HOME/.cache/openmetadata-lineage-seed/acme-2000000-32050/manifest.json \
  ./scripts/lineage-scale-benchmark.sh
```

With a seed manifest (`jpw.lineage.seedManifest`, which the script passes on), the benchmark reads
its focus points and the graph's shape from the manifest, skips seeding and index waits, and never
deletes the graph. The report's `params` carry `graphSource: seed-manifest` and the seeded graph's
own counts in place of the loader's knobs, and so does the published `workload`. The script builds
the IT's modules first; pass `BUILD=false` on later runs.

The IT can still seed a large cohort itself:

```bash
export OM_URL=https://om.example.com OM_ADMIN_TOKEN=...
LINEAGE_TABLES=2000000 LINEAGE_EDGES=2000000 LINEAGE_SCHEMAS_PER_DATABASE=50 \
  ./scripts/lineage-scale-benchmark.sh
```

Publishes to `docs/artifacts/lineage-scale/<date>-<label>/` with a `manifest.json` carrying
`productionCommit`, `outcome` and `workload`, following the `docs/artifacts/rdf-scale/` convention.

**This is hours, not minutes.** There is no bulk lineage endpoint — every edge is one
`PUT /v1/lineage` — and each edge write is expensive on the server (see
[Known risks](#known-risks-this-benchmark-is-expected-to-surface)). The seed script's README has the
measured rates and disk footprint. 2M assets is therefore a deliberate, on-demand run against a
long-lived cluster, not something the scheduled nightly can absorb. `SKIP_CLEANUP` defaults to
`true` in `lineage-scale-benchmark.sh` so a multi-hour corpus survives the run.

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
| `jpw.lineage.seedManifest` | unset | benchmark a `scripts/lineage_seed` graph instead of seeding one |
| `jpw.lineage.*P95Ms` | see below | per-group budgets; `otherApiP95Ms` covers the non-scene lineage reads |
| `jpw.bench.suite` | unset | names the [per-API latency](#per-api-latency-from-every-suite) series of a run |
| `jpw.bench.apiLatency` | true | `false` turns per-API recording off |

Note on sample count: at 20 samples the nearest-rank p99 *is* the max and p95 is the
second-highest. Raise `jpw.lineage.samples` before reading either as a genuine tail.

## Per-API latency from every suite

Every IT JVM records the latency of each OpenMetadata API call it makes and publishes it at the end
of the run as `target/benchmark/api-latency-<suite>.json`, in the same envelope as the benchmark
(`benchmarkId = api-latency`). No test code is involved:

- **SDK calls** — the harness registers `ApiLatencyRecorder` on every client it builds
  (`SdkClients`, `ExternalServer`, `ContainerizedServer`) through the SDK's `RequestListener` hook.
  Time runs from the call starting to its response body being consumed, the time the caller waited.
- **Browser calls** — `UiSessionExtension` attaches the recorder to every Playwright context, so a
  UIIT's page loads report what the UI waited for (`Request.timing().responseEnd`).

Calls are grouped by route, not by entity: `sdk GET /v1/tables/name/{fqn}`, `ui GET
/v1/lineage/scene?band=ASSET&focusFqn`. UUIDs, `/name/` segments and dotted names collapse to
placeholders; query strings are dropped except the parameters that pick a different code path
(search's `index`, the scene's `band` and whether it is focused). Memory is bounded: 400 routes,
each a fixed-size histogram (~1% precision), with an overflow entry that makes a normalisation miss
visible. `ApiLatencyReportListener` writes the file when the JUnit launcher session closes.

These numbers come from whatever the suite happened to do, so they are noisier than the controlled
scenarios above: a test added or removed moves them. They are trended and reported, not gated.

## Trends and the regression gate

The nightly's `latency-report` job runs `.github/scripts/benchmark_trend.py` over every
`scale-metrics-*` and `api-latency-*` artifact of the run:

- **History** — each run's reports are committed to the `benchmark-history` branch of
  `open-metadata/openmetadata-nightly` under `runs/<ref>/<timestamp>-<run id>/`, one file per
  series (the lineage benchmark at a cohort size, or one suite's API traffic). The last 120 runs
  per ref are kept.
- **Trend page** — `TRENDS.md` on that branch is regenerated from the whole history: one small
  chart per scenario and per busy route (p95 per nightly run, light and dark variants) with the
  plotted values in a table under each group.
- **Run summary and Slack** — the job summary lists every scenario's p95 against the median of the
  previous 7 nights, the change, a sparkline and a verdict. CollateBot posts the same verdicts to
  #java-playwrights, where the Java IT alerts go, on scheduled runs and on dispatches of `main`.
- **Gate** — the job fails when a `lineage-scene-scale` scenario's p95 is more than 25% and 25 ms
  above that median. Nothing is judged before a scenario has 5 nights of history, and suite API
  traffic is never gated.

The same script runs locally against downloaded artifacts:

```bash
.github/scripts/benchmark_trend.py --reports ./artifacts --history ./benchmark-history --ref main \
  --write-trends --summary-out summary.md
```

It also tracks local runs. Record each run's output directory into a history of your own, and that
directory gets the same `TRENDS.md`, charts and verdicts, judged from the fifth run on:

```bash
.github/scripts/benchmark_trend.py --reports <run output> --history ~/lineage-bench-history \
  --ref local --record --write-trends --summary-out /dev/stdout
```

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
| Nightly wiring + trend page | landed with the nightly PR; trends live on `openmetadata-nightly@benchmark-history` |
| Regression gate | relative (median of 7 nights, ±25%), active once a scenario has 5 nights |
| Budgets | **placeholders** — `rootSceneP95Ms=10000`, `focusedSceneP95Ms=20000`, `legacyP95Ms=60000`, `otherApiP95Ms=60000`, `firstRenderP95Ms=60000`, `interactionP95Ms=60000` |
| Published p95 | **none yet** |

The budgets above are deliberately generous and are not measurements. They exist so the assertion
is in the test from day one without a red build built on an invented threshold. **Replace them from
the first week of nightly runs** (the trend page has the numbers), then fill in the table below and
record the artifact under `docs/artifacts/lineage-scale/`.

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
- **Found and fixed: a large scene opened on its context nodes.** A scene too big for the canvas at
  its band's minimum readable zoom (0.55 for ASSET, just above the 0.5 zoom-out threshold) used to
  clamp the zoom and keep the centre of the whole graph in view. In the layered layout that centre
  falls between layers, where only the collapsed context nodes sit. So the scene's own nodes opened
  off-screen, and `onlyRenderVisibleElements` kept them out of the DOM:
  - On the 500-table loader graph, a drill into a schema showed its 2 context services and none
    of its 32 tables, even after fit-to-screen.
  - Opened by link at 1440×900, two schemas of the 20k seed showed one context service and none of
    their 120 and 190 tables.

  Such a scene now opens at the minimum zoom on what it was opened for (`getSceneLandingViewport`):
  - its focus node, else its origin node, centred;
  - otherwise the top of its left-most column of real nodes.

  The drill waits caught it, because they need a child of the focused container on screen.
- **Lineage writes do not scale with edge count.** Each `PUT /v1/lineage` runs an Elasticsearch
  `update_by_query` with `refresh=true` on the downstream entity's index
  (`ElasticSearchEntityManager.updateLineage`). Every edge therefore forces a shard refresh. It also
  bumps refcounted service-level and data-product edges (`LineageRepository.addServiceLineage`), and
  edges that share a service pair queue on the same rows. The OpenLineage batch endpoint loops over
  the same call. Measured on a 6-vCPU local Docker stack: 119 edges/s with 24 client threads while
  seeding 20k assets. A 2M-asset graph's ~3M edges are hours of this.
