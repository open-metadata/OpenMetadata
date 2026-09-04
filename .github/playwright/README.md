# Playwright CI planning

`playwright-postgresql-e2e.yml` has two execution modes:

- Pull requests, merge queue, scheduled, and manual full-suite runs execute all projects covered by this workflow. Merge-queue and scheduled runs are unconditionally full; every other event is full whenever the caller passes `full_suite: true`, which the PR gate does. Manual runs can select HTTP/1.1 or HTTP/2.
- Targeted mode — the Basic smoke list, directly changed specs, and suites selected by `impact-map.json`, plus one canary from every supported project when shared test infrastructure or an unmapped path changes — runs when the caller passes `full_suite: false`. Point the PR gate's `full_suite` input back at `false` to restore impact-mapped PR selection.
- PR and merge-queue runs skip the pipeline outright when the change touches no Playwright-relevant path. `check-changes` computes that `e2e` paths filter and `cache-keys`, `build`, and `detect-changes` are gated on it; everything downstream skips by dependency. The three guards must stay in lockstep — gating only some of them leaves a build burning a runner for a summary that has nothing to report. Schedule and dispatch runs never evaluate the filter and stay unconditionally full.
- The `playwright-summary` required check stays green on such a run: `render_playwright_summary.cjs` returns early when the filter reports no relevant change *and* the build was skipped, instead of failing on "the shard matrix was unexpectedly skipped". The build condition is deliberate — any run that did build and test is always reported in full, whatever the filter said. Widen the filter in `check-changes` to change what counts as Playwright-relevant; both sides read the same output.

The manual HTTP/2 benchmark applies to browser/server lanes. Dedicated Airflow shards stay on HTTP/1.1 because the fixture's self-signed browser certificate is not part of generated ingestion workflow configuration.

SSO stays in its dedicated workflow, while knowledge graph and ontology share one RDF workflow and environment. HTTP/2-specific, data-insight application, and nightly specs are explicitly recorded as delegated rather than being silently misclassified as common Chromium coverage. Add new production-to-test relationships to `impact-map.json`; do not make an unmapped source path trigger the full suite.

## Duration-balanced plans

`build_playwright_shards.py` discovers stable Playwright test IDs and assigns hook-inclusive p75 duration from the latest three successful full runs. It uses longest-processing-time-first balancing and computes the common shard count as:

```text
ceil(total weighted worker time / (3 workers * 21 minutes * 0.85))
```

The common matrix is bounded to 5–24 runners and uses a 21-minute allocation budget. Dedicated lanes use a 20-minute allocation budget. The common lane previously sat a minute below the dedicated lanes, but the chromium suite outgrew what 24 runners could hold at 19 minutes, so full-mode planning aborted outright; 21 minutes restores headroom while staying inside the 25-minute `timeout` wrapper around `npx playwright test` and the 35-minute `playwright-ci` job clock. Note that the allocation budget bounds a whole *shard*, whereas the strict 20-minute ceiling below bounds a single *atomic unit*, so the two are independent. Planner weights use the hook-inclusive observed duration, including retries. Only an exact stable test ID explicitly reported as skipped may retain a zero weight; every other zero-duration observation and every unseen test uses the conservative fallback, and zero weights never transfer through the file/title identity fallback. The versioned bootstrap baseline uses stable expected and skipped observations from the coverage-complete but failed full run `29984209316`, while unexpected and flaky tests retain their prior duration weights from run `29980474263`. It is bootstrap data, not a fabricated successful history; normal planning still uses p75 from the latest three successful full runs when those artifacts exist. This keeps expensive internally parallel suites together instead of multiplying their shared setup across runners. Serial/global behavior stays in one-worker lanes. Large suites listed in `AUDITED_PARALLEL_SUITES` are split at test granularity only after confirming that they are not serial and do not depend on earlier tests. The planner fails when any remaining atomic unit or bounded lane exceeds the 20-minute ceiling.

The `Basic` and `chromium` projects share that common 24-runner cap and are balanced together; they are not separate pools of standard hosted runners. Isolated ingestion, search, reindex, permission, and global-state lanes are additional because they cannot safely share mutable server state with the common matrix.

Impact-mapped targeted CI runs the representative Table-source scenario from `DataAssetLineage.spec.ts`. A direct change to that spec, full CI, and local runs retain every source-entity scenario in the same file. This preserves stable IDs and lets the duration planner distribute the full matrix instead of concentrating it in an unsharded stress project. Custom Properties keeps the complete widget contract on Table and one String CRUD smoke per remaining entity.

The `@ingestion` project is excluded from common Chromium only when the dynamic planner is active. Its source-matched Airflow image is restored only for ingestion shards, so other workflows that invoke the regular Chromium project keep their existing behavior.

## Golden fixture

The preparation job runs migrations, sample ingestion, reindexing, authentication setup, and shared entity prerequisites once. The fixture manifest records the source commit, schema hash, seed hash/version, Playwright-state hash, PostgreSQL and OpenSearch image digests, search cluster alias, and the ingestion image ID. Each shard validates the manifest, extracts database/search/auth state under `/dev/shm`, verifies the seeded search indexes, and starts the built OpenMetadata distribution directly on the host with the recorded alias. The pre-seeded response manifest keeps the randomly named shared entities stable across the fixture builder and shard processes.

Standard shards do not build Docker images, run migrations, start Airflow, ingest sample data, reindex, repeat authentication, or recreate shared entity prerequisites. PostgreSQL durability is disabled for the disposable clone, OpenSearch uses a 2 GiB heap and zero replicas, and routine logs are bounded.

## Measurements and gates

Every shard publishes stable-ID timing, retries/outcome, request totals and bytes, application boot count, hot API endpoints, and phase timing. E2E builds give the single HTML entry bundle an `app-entry-*.js` name so manual runtime and schema chunks cannot be mistaken for entry requests. The CI-only application entry emits one same-origin diagnostic request on every application boot and marks the first request in each page session as a new UI scenario; session storage persists the scenario marker across reloads. The performance gate therefore measures at most one application boot per UI scenario while retaining entry requests and boots per test attempt as observations. A measurement-integrity gate requires boot diagnostics to cover every UI scenario and every server-visible entry request; boot counts may exceed entry requests because the browser or service worker can serve a cached entry. Full runs fail on missing/duplicate IDs and blocking setup, execution, upload, stability, static-request, or measurement-integrity targets. Common-shard skew, total requests per attempt, and application boots per UI scenario remain explicit convergence targets: their original booleans and aggregate `targetsMet` result stay strict, while unmet values are reported as non-blocking warnings during the optimization rollout. The merged report artifact includes the reusable timing history and performance/coverage summaries.

Use `workflow_dispatch` on the same commit for baseline comparisons:

- `coarse_bundle=false` versus `coarse_bundle=true`
- `protocol=http` versus `protocol=h2`

The local cold-shell bundle benchmark on the same source tree reduced static requests from 144 to 22 (84.7%) and median DOM-content-loaded time from 109 ms to 57 ms (47.7%). The first hosted fixture smoke exposed a circular chunk-initialization failure before React mounted, so the CI-only coarse bundle remains opt-in while its chunking strategy is corrected. HTTP/2 is also opt-in until hosted runs establish its result. Keep a variant enabled only after three consecutive full runs meet the thresholds in `evaluate_playwright_performance.py`.
