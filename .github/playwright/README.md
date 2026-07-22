# Playwright CI planning

`playwright-postgresql-e2e.yml` has two execution modes:

- Pull requests run the Basic smoke list, directly changed specs, and suites selected by `impact-map.json`. Shared test infrastructure and unmapped changes add one canary from every supported project.
- Merge queue, scheduled, and manual full-suite runs execute all projects covered by this workflow. Manual runs can opt out of the full suite and can select HTTP/1.1 or HTTP/2.

The manual HTTP/2 benchmark applies to browser/server lanes. Dedicated Airflow shards stay on HTTP/1.1 because the fixture's self-signed browser certificate is not part of generated ingestion workflow configuration.

SSO stays in its dedicated workflow, while knowledge graph and ontology share one RDF workflow and environment. HTTP/2-specific, data-insight application, and nightly specs are explicitly recorded as delegated rather than being silently misclassified as common Chromium coverage. Add new production-to-test relationships to `impact-map.json`; do not make an unmapped source path trigger the full suite.

## Duration-balanced plans

`build_playwright_shards.py` discovers stable Playwright test IDs and assigns hook-inclusive p75 duration from the latest three successful full runs. It uses longest-processing-time-first balancing and computes the common shard count as:

```text
ceil(total weighted worker time / (3 workers * 20 minutes * 0.85))
```

The common matrix is bounded to 5–24 runners. Serial/global behavior stays in one-worker lanes. Large suites listed in `AUDITED_PARALLEL_SUITES` are split at test granularity only after confirming that they are not serial and do not depend on earlier tests. The planner fails when any remaining atomic unit exceeds 20 minutes.

The `Basic` and `chromium` projects share that common 24-runner cap and are balanced together; they are not separate pools of standard hosted runners.

Impact-mapped targeted CI runs the representative Table-source scenario from `DataAssetLineage.spec.ts`. A direct change to that spec, full CI, and local runs retain every source-entity scenario in the same file. This preserves stable IDs and lets the duration planner distribute the full matrix instead of concentrating it in an unsharded stress project. Custom Properties keeps the complete widget contract on Table and one String CRUD smoke per remaining entity.

The `@ingestion` project is excluded from common Chromium only when the dynamic planner is active. Its source-matched Airflow image is restored only for ingestion shards, so other workflows that invoke the regular Chromium project keep their existing behavior.

## Golden fixture

The preparation job runs migrations, sample ingestion, reindexing, authentication setup, and shared entity prerequisites once. The fixture manifest records the source commit, schema hash, seed hash/version, Playwright-state hash, PostgreSQL and OpenSearch image digests, and the ingestion image ID. Each shard validates the manifest, extracts database/search/auth state under `/dev/shm`, and starts the built OpenMetadata distribution directly on the host. The pre-seeded response manifest keeps the randomly named shared entities stable across the fixture builder and shard processes.

Standard shards do not build Docker images, run migrations, start Airflow, ingest sample data, reindex, repeat authentication, or recreate shared entity prerequisites. PostgreSQL durability is disabled for the disposable clone, OpenSearch uses a 2 GiB heap and zero replicas, and routine logs are bounded.

## Measurements and gates

Every shard publishes stable-ID timing, retries/outcome, request totals and bytes, application boot count, hot API endpoints, and phase timing. E2E builds give the single HTML entry bundle an `app-*.js` name so server-side metrics count cold application boots without mistaking Vite's unrelated `index-*.js` chunks for entries. Full runs fail on missing/duplicate IDs or when any performance target is missed. The merged report artifact includes the reusable timing history and performance/coverage summaries.

Use `workflow_dispatch` on the same commit for baseline comparisons:

- `coarse_bundle=false` versus `coarse_bundle=true`
- `protocol=http` versus `protocol=h2`

The local cold-shell bundle benchmark on the same source tree reduced static requests from 144 to 22 (84.7%) and median DOM-content-loaded time from 109 ms to 57 ms (47.7%). The first hosted fixture smoke exposed a circular chunk-initialization failure before React mounted, so the CI-only coarse bundle remains opt-in while its chunking strategy is corrected. HTTP/2 is also opt-in until hosted runs establish its result. Keep a variant enabled only after three consecutive full runs meet the thresholds in `evaluate_playwright_performance.py`.
