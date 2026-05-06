# openmetadata-java-playwright

Java-driven end-to-end scenario suite for OpenMetadata. Boots a real server, seeds data via the SDK, and validates backend behaviour — reindex, search, ingestion, governance — with optional Playwright-Java browser checks.

> Tracks EPIC [#3731](https://github.com/open-metadata/openmetadata-collate/issues/3731). Satisfies open tickets [#3767](https://github.com/open-metadata/openmetadata-collate/issues/3767) (e2e suite for SearchIndexingApplication) and [#3792](https://github.com/open-metadata/openmetadata-collate/issues/3792) (Playwright nightly suite for search scenarios).

## Why a separate module?

| Existing | Gap this module fills |
|---|---|
| `openmetadata-integration-tests` | API CRUD, isolated entity tests. Can't easily express "seed → trigger reindex → assert engine state → verify in UI" scenarios. |
| `openmetadata-ui` Playwright (TS) | Frontend perspective, written by UI engineers. Misses backend edge cases that are obvious to backend engineers (orchestrator failure paths, alias swaps, distributed coordination). |

This module is the backend engineer's scenario suite. Same Testcontainers + SDK harness as `openmetadata-integration-tests` (via test-jar dependency), plus Playwright-Java for the cases that need a browser.

## Modes

The module ships with two execution modes, selected by the `JPW_MODE` environment variable. Backend reindex scenarios use embedded mode (fast, hermetic). UI scenarios use external mode (real UI bundle served).

### Embedded (default — backend scenarios)

`TestSuiteBootstrap` (reused from `openmetadata-integration-tests`) starts MySQL/PostgreSQL + Elasticsearch/OpenSearch via Testcontainers and boots `OpenMetadataApplication` in-JVM via `DropwizardAppExtension`. Tests connect via SDK using JWT-cached `SdkClients.adminClient()`.

- Boot time: ~30–60s
- Debuggable: set a breakpoint in `SearchIndexApp` and the IDE debugger will hit it
- Limitation: no UI bundle is served — UI scenarios skip via `@DisabledIfEnvironmentVariable(named = "JPW_MODE", matches = "external")` running in reverse

### External (UI + future distributed/crash scenarios)

Tests connect to an already-running stack. Phase 1 supports this for UI scenarios; later phases will add distributed reindex, crash recovery, and ingestion E2E here.

When `JPW_MODE=external` is set:
- The embedded `TestSuiteBootstrap` skips its boot (no Testcontainers spin-up)
- Embedded scenarios are skipped via `@DisabledIfEnvironmentVariable`
- UI scenarios are enabled via `@EnabledIfEnvironmentVariable`
- `ExternalServer.fromEnv()` reads `OM_URL` + `OM_ADMIN_TOKEN` and builds the SDK client

## Layout

```
openmetadata-java-playwright/
  src/main/java/org/openmetadata/jpw/
    server/ServerHandle.java          connection details (URL, SDK client, search engine endpoint)
    search/ReindexHelpers.java        trigger SearchIndexingApplication + Awaitility wait
    search/SearchClient.java          stdlib HTTP client to the search engine
    search/SearchAssertions.java      doc count, alias→index, presence/absence assertions
    ui/PlaywrightFixture.java         browser session lifecycle + traces
  src/test/java/org/openmetadata/jpw/
    util/OssTestServer.java           builds a ServerHandle from TestSuiteBootstrap
    scenarios/search/reindex/         Phase 1 scenarios
```

The harness lives in `src/main/java` so the Collate module (`collate-java-playwright`) can depend on it directly.

## Running locally

### One-time setup

```bash
# Build everything the module needs
mvn -DskipTests clean install -pl :openmetadata-java-playwright -am

# Install Playwright browsers (one-time per machine; UI scenarios need it, backend ones don't)
mvn -pl :openmetadata-java-playwright dependency:build-classpath -Dmdep.outputFile=/tmp/cp.txt -q
java -cp "$(cat /tmp/cp.txt)" com.microsoft.playwright.CLI install chromium
```

### Backend scenarios (embedded mode)

```bash
# All backend scenarios, OpenSearch (default)
mvn verify -pl :openmetadata-java-playwright

# Elasticsearch instead
mvn verify -pl :openmetadata-java-playwright \
  -DsearchType=elasticsearch \
  -DsearchImage=docker.elastic.co/elasticsearch/elasticsearch:9.3.0

# Single scenario
mvn verify -pl :openmetadata-java-playwright -Dit.test=FullReindexFromCleanStateIT
```

### UI scenarios

UI scenarios are **transparent** — `mvn verify -Dit.test='*UIIT'` just works. `UiTestServer` auto-picks the right backing stack:

| If you set... | UI tests run against |
|---|---|
| Nothing (default) | A freshly-built containerized stack (MySQL + OpenSearch + the OM server image built from your local `openmetadata-dist` tarball). First run ~5 min for the dist build, ~2 min for image build + container boot. Subsequent runs reuse Docker layer cache. |
| `OM_URL` + `OM_ADMIN_TOKEN` | Whatever stack those vars point at (e.g. a `./docker/run_local_docker.sh` you already have running). |
| `OM_TEST_IMAGE=openmetadata/server:1.11.4` | A containerized stack using that pre-built image instead of building one from local code. Useful for testing against released versions. |

```bash
# 1) Just run it. First time will build the dist tarball (~5 min) and the image.
mvn verify -pl :openmetadata-java-playwright -Dit.test='*UIIT'
```

That's it. The test seeds a table via the SDK, triggers `SearchIndexingApplication`, opens Chromium, navigates to Explore, types the table name, presses Enter, asserts the table appears.

### Iterating against a stack you already have running

If you already have `./docker/run_local_docker.sh -m ui -d mysql` going, point the test at it and skip the rebuild:

```bash
export OM_URL=http://localhost:8585
export OM_ADMIN_TOKEN='<JWT from UI: Settings → Bots → ingestion-bot → Token>'
mvn verify -pl :openmetadata-java-playwright -Dit.test='*UIIT'
```

`UiTestServer` detects the env vars and uses them automatically.

### Watching the browser

Edit `PlaywrightFixture.java` line 51, change `setHeadless(true)` → `setHeadless(false).setSlowMo(300)`. Re-run; Chromium pops up.

### Skipping the wasted embedded boot when only running UI tests

By default, when you run `mvn verify`, the `TestSuiteBootstrap` LauncherSessionListener fires and boots an embedded MySQL+OpenSearch even if you filter to UI tests. Suppress it with:

```bash
mvn verify -pl :openmetadata-java-playwright -Dit.test='*UIIT' -Dskip.embedded.bootstrap=true
```

## Adding a scenario

1. Pick (or create) a sub-package under `src/test/java/org/openmetadata/jpw/scenarios/`.
2. Name the class `<Behaviour>IT.java` so failsafe picks it up.
3. Use `@Execution(SAME_THREAD)` if your scenario triggers the SearchIndexingApplication (it's a shared resource).
4. Build a `ServerHandle` once in `@BeforeAll` via `OssTestServer.defaultHandle()`.
5. Seed via `*TestFactory` classes from `openmetadata-integration-tests` (already on the classpath).
6. Drive search via `ReindexHelpers`, assert via `SearchAssertions`.
7. Reference the EPIC sub-issue(s) the scenario protects against in the class Javadoc.

## CI

| Workflow | Trigger | What it runs |
|---|---|---|
| `java-playwright-pr.yml` | Path-filtered PR + `run-java-playwright` label + dispatch | Embedded mode, OpenSearch only, fast subset |
| `java-playwright-nightly.yml` | Cron `0 2 * * *` + dispatch | Embedded mode, ES + OS matrix; expands in Phase 3 to external mode |

Path filter triggers on changes to `openmetadata-service/src/.../searchIndex/**`, `.../search/**`, the spec, the SDK search service, the integration-tests bootstrap, and this module itself.

## Phasing

- **Phase 1 (this PR)**: skeleton, harness, 3 reindex scenarios, embedded mode, CI wiring.
- **Phase 2**: scenarios for buckets D (stats), E (ES/OS parity), F (query correctness), G (lifecycle), I (column embeddings), J (permissions). UI scenarios (search after reindex appears in Explore).
- **Phase 3**: external mode (`docker-compose-e2e.yml` + `ExternalServer`), distributed reindex (#25058, #3750, #3757), crash recovery, perf smoke (#3961).
- **Phase 4+**: ingestion E2E, governance, lineage.
