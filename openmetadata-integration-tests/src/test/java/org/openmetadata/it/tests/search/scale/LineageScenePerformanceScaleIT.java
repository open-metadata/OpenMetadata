/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests.search.scale;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.IntUnaryOperator;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.condition.EnabledIf;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bench.BenchmarkInteraction;
import org.openmetadata.it.bench.BenchmarkMetrics;
import org.openmetadata.it.bench.Latency;
import org.openmetadata.it.bench.LatencySampler;
import org.openmetadata.it.bench.LatencySampler.StagedAction;
import org.openmetadata.it.bench.LatencySampler.StagedSetup;
import org.openmetadata.it.factories.LineageFocusPoints;
import org.openmetadata.it.factories.LineageGraphLoader;
import org.openmetadata.it.factories.LineageGraphSpec;
import org.openmetadata.it.factories.LineageGraphSummary;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.SearchAssertions;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.playwright.ui.UiSession;
import org.openmetadata.playwright.ui.UiSessionExtension;
import org.openmetadata.playwright.ui.pages.LineageMapPage;
import org.openmetadata.schema.api.lineage.LineageBand;
import org.openmetadata.schema.api.lineage.LineageLens;
import org.openmetadata.schema.api.lineage.LineageScene;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Scale benchmark for the hierarchical lineage surface added in PR #29204 — {@code
 * GET /v1/lineage/scene} and the lineage map that renders it.
 *
 * <p>Three things are measured, in order: the scene API across every shape it serves; first render
 * of the map; and the exploration loop a user actually performs — drilling down the hierarchy,
 * zooming across the semantic bands, and navigating back up. Each publishes a p95 and fails when it
 * exceeds its budget.
 *
 * <p>Seeds once in {@code @BeforeAll} and shares the corpus across all three tests: at these cohort
 * sizes a second seed would cost as much again, and a recursive hard delete of the first keeps
 * cascading server-side long after the namespace reports gone, which is exactly what makes the
 * nightly's class ordering load-bearing.
 *
 * <p><b>Cold vs warm matters here.</b> {@code LineageSceneCache} is a process-wide singleton keyed
 * on {@code (lens, band, depths, size, queryFilter, includeDeleted)} — {@code focusFqn} is
 * deliberately absent, and it is only populated for unfocused scenes requested by a user needing no
 * per-entity authorization. So root scenes go warm from the second sample while every focused scene
 * is always cold. Scenarios are labelled accordingly; comparing a {@code -warm} p95 against a
 * {@code -cold} one is meaningless.
 *
 * <p>Sizing and budgets are all {@code -Djpw.lineage.*} system properties; see
 * {@link LineageGraphSpec}. The 2M-asset target of issue #32050 is this class with
 * {@code -Djpw.lineage.tables=2000000}, which is hours of seeding and belongs in the tier-2 script
 * rather than the scheduled nightly.
 */
@Tag("scale")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(OrderAnnotation.class)
@Execution(ExecutionMode.SAME_THREAD)
class LineageScenePerformanceScaleIT {

  private static final Logger LOG = LoggerFactory.getLogger(LineageScenePerformanceScaleIT.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private static final String SCENE_PATH = "/v1/lineage/scene";
  private static final String SEARCH_LINEAGE_PATH = "/v1/lineage/getLineage";
  private static final String ENTITY_COUNT_LINEAGE_PATH = "/v1/lineage/getLineageByEntityCount";
  private static final String TABLE_ENTITY_TYPE = "table";
  private static final String DATABASE_SERVICE_ENTITY_TYPE = "databaseService";
  private static final String DATABASE_ENTITY_TYPE = "database";
  private static final String DATABASE_SCHEMA_ENTITY_TYPE = "databaseSchema";
  private static final int DEFAULT_SCENE_SIZE = 200;
  private static final int WIDE_SCENE_SIZE = 1000;

  private static final int WARMUPS = Integer.getInteger("jpw.lineage.warmups", 5);
  private static final int SAMPLES = Integer.getInteger("jpw.lineage.samples", 20);
  private static final int RENDER_SAMPLES = Integer.getInteger("jpw.lineage.renderSamples", 5);

  // Deliberately generous. The point of the first nightly run is to MEASURE these; a tight bound
  // invented here would only produce a red build nobody can interpret. Tighten in a follow-up from
  // the published numbers — see docs/perf/lineage-scale-validation.md.
  private static final long ROOT_SCENE_P95_LIMIT_MS =
      Long.getLong("jpw.lineage.rootSceneP95Ms", 10_000);
  private static final long FOCUSED_SCENE_P95_LIMIT_MS =
      Long.getLong("jpw.lineage.focusedSceneP95Ms", 20_000);
  private static final long LEGACY_P95_LIMIT_MS = Long.getLong("jpw.lineage.legacyP95Ms", 60_000);
  private static final long FIRST_RENDER_P95_LIMIT_MS =
      Long.getLong("jpw.lineage.firstRenderP95Ms", 60_000);
  private static final long INTERACTION_P95_LIMIT_MS =
      Long.getLong("jpw.lineage.interactionP95Ms", 60_000);

  private static final int INTERACTION_WARMUPS =
      Integer.getInteger("jpw.lineage.interactionWarmups", 1);
  private static final int INTERACTION_SAMPLES =
      Integer.getInteger("jpw.lineage.interactionSamples", 5);
  private static final String INTERACTION_PREFIX = "interaction-";
  private static final String LAYER_BAND = LineageBand.LAYER.value();
  private static final String ASSET_BAND = LineageBand.ASSET.value();
  private static final String FIELD_BAND = LineageBand.FIELD.value();
  private static final int ROOT_BREADCRUMB_INDEX = 0;

  private static final boolean SKIP_CLEANUP = Boolean.getBoolean("jpw.lineage.skipCleanup");
  private static final Duration INDEXING_TIMEOUT =
      Duration.ofMinutes(Integer.getInteger("jpw.lineage.indexTimeoutMin", 30));

  private final Map<String, Latency> latencies = new LinkedHashMap<>();
  private final Map<String, Object> counters = new LinkedHashMap<>();

  private LineageGraphSpec spec;
  private OpenMetadataClient client;
  private TestNamespace namespace;
  private LineageGraphSummary graph;

  @BeforeAll
  void seedLineageGraph() {
    spec = LineageGraphSpec.fromSystemProperties();
    client = SdkClients.adminClient();
    namespace = new TestNamespace(getClass().getSimpleName());
    namespace.setMethodId("lineageScenePerformance");
    graph = LineageGraphLoader.load(spec, namespace);
    awaitIndexed();
    recordGraphCounters();
  }

  /**
   * Publishes before cleaning up, and publishes even when a budget assertion failed — a run that
   * breached its budget is precisely the run whose numbers someone needs to read.
   */
  @AfterAll
  void publishMetricsThenCleanUp() throws IOException {
    if (namespace == null) {
      // Seeding threw before it created anything. Publishing here would NPE and bury the real
      // failure under a teardown error.
      return;
    }
    if (graph != null) {
      publishMetrics();
    }
    if (SKIP_CLEANUP) {
      LOG.warn("jpw.lineage.skipCleanup=true — leaving the seeded corpus on the cluster");
      return;
    }
    NamespaceCleanup.deleteRoots(namespace.drainTrackedRoots());
  }

  @Test
  @Order(1)
  void sceneApiLatencyStaysWithinBudget() throws Exception {
    final List<Scenario> scenarios = scenarios();
    for (final Scenario scenario : scenarios) {
      latencies.put(
          scenario.id(), LatencySampler.measure(WARMUPS, SAMPLES, scenario.interaction()));
      LOG.info("Scenario {} -> {}", scenario.id(), latencies.get(scenario.id()));
    }
    assertWithinBudget(scenarios);
  }

  @Test
  @Order(2)
  /**
   * Gated on external mode because the browser and the seeded graph must be the same server, and
   * only {@code OM_URL} + {@code OM_ADMIN_TOKEN} guarantee it: without them the graph is seeded into
   * the embedded in-JVM stack while {@code UiTestServer} launches a separate containerized one for
   * the browser, which would render an empty map and publish a flatteringly fast number.
   *
   * <p>A JUnit condition rather than a check inside the test, so the skip happens before
   * {@code UiSessionExtension} launches that container stack. A misconfigured nightly shows up as
   * the {@code lineage-map-*} keys missing from the published metrics.
   */
  @EnabledIf("org.openmetadata.it.util.OssTestServer#isExternalMode")
  @ExtendWith(UiSessionExtension.class)
  void lineageMapFirstRenderStaysWithinBudget(final UiSession ui) throws Exception {
    final LineageFocusPoints focus = graph.focusPoints();
    LineageMapPage.suppressOnboarding(ui);
    final Latency latency =
        LatencySampler.measure(1, RENDER_SAMPLES, iteration -> renderScene(ui, focus));
    latencies.put("lineage-map-first-render-cold", latency);
    LOG.info("Lineage map first render -> {}", latency);
    assertThat(latency.p95Millis())
        .as("lineage map first render p95 over %d assets", graph.tables())
        .isLessThan(FIRST_RENDER_P95_LIMIT_MS);
  }

  /**
   * The exploration loop, measured at scale: drill down the hierarchy, zoom across the semantic
   * bands, and navigate back up. First render only covers arriving at a scene; this covers moving
   * between them, which is where a user actually spends their time and where the scene API's
   * expensive focused path is hit over and over.
   */
  @Test
  @Order(3)
  /**
   * Gated on external mode because the browser and the seeded graph must be the same server, and
   * only {@code OM_URL} + {@code OM_ADMIN_TOKEN} guarantee it: without them the graph is seeded into
   * the embedded in-JVM stack while {@code UiTestServer} launches a separate containerized one for
   * the browser, which would render an empty map and publish a flatteringly fast number.
   *
   * <p>A JUnit condition rather than a check inside the test, so the skip happens before
   * {@code UiSessionExtension} launches that container stack. A misconfigured nightly shows up as
   * the {@code lineage-map-*} keys missing from the published metrics.
   */
  @EnabledIf("org.openmetadata.it.util.OssTestServer#isExternalMode")
  @ExtendWith(UiSessionExtension.class)
  void lineageMapExplorationStaysWithinBudget(final UiSession ui) throws Exception {
    LineageMapPage.suppressOnboarding(ui);
    measureDrillInteractions(ui);
    measureZoomInteractions(ui);
    measureViewInteractions(ui);
    assertInteractionsWithinBudget();
  }

  /**
   * Click-driven drilling down the whole hierarchy, one level per scenario, and the breadcrumb back
   * up. Every drill changes focus, so every one is a cache miss. The container levels stay in the
   * ASSET band — the map only moves to FIELD when the drilled node is a table — which is why each
   * level is measured separately instead of as one "asset to field" hop.
   */
  private void measureDrillInteractions(final UiSession ui) throws Exception {
    measureInteraction(ui, "drill-service", iteration -> openDrilled(ui, 0), this::drillIntoChild);
    measureInteraction(ui, "drill-database", iteration -> openDrilled(ui, 1), this::drillIntoChild);
    measureInteraction(ui, "drill-schema", iteration -> openDrilled(ui, 2), this::drillIntoChild);
    measureInteraction(
        ui, "drill-table-to-fields", iteration -> openDrilled(ui, 3), this::drillTableIntoFields);
    measureInteraction(
        ui,
        "breadcrumb-pop-to-layer",
        iteration -> openDrilled(ui, 1),
        map -> map.popBreadcrumb(ROOT_BREADCRUMB_INDEX, LAYER_BAND));
  }

  private void drillIntoChild(final LineageMapPage map) {
    map.drillIntoNode(map.firstDrillableChildFqn());
  }

  /** The post-check keeps the scenario honest: it must really have reached the FIELD band. */
  private void drillTableIntoFields(final LineageMapPage map) {
    drillIntoChild(map);
    if (!FIELD_BAND.equals(map.currentBand())) {
      throw new IllegalStateException(
          "Drilling a schema's child landed on band "
              + map.currentBand()
              + ", not FIELD — the scenario would be mislabelled");
    }
  }

  /** Opens the root scene and drills {@code levels} deep — the untimed setup of an interaction. */
  private LineageMapPage openDrilled(final UiSession ui, final int levels) {
    final LineageMapPage map = LineageMapPage.openPlatformScene(ui, LAYER_BAND);
    for (int level = 0; level < levels; level++) {
      drillIntoChild(map);
    }
    return map;
  }

  /**
   * Semantic zoom. Note what zoom-in actually does: it drills into the expandable node nearest the
   * viewport centre, so it changes focus as well as band. The suppression window is waited out in
   * setup, outside the timed region — it is the map's own cooldown, not its latency.
   */
  private void measureZoomInteractions(final UiSession ui) throws Exception {
    measureInteraction(
        ui,
        "semantic-zoom-in",
        iteration -> LineageMapPage.openPlatformScene(ui, LAYER_BAND).settle(),
        map -> map.semanticZoomIn(ASSET_BAND));
    measureInteraction(
        ui,
        "semantic-zoom-out",
        iteration -> openDrilled(ui, 1).settle(),
        map -> map.semanticZoomOut(LAYER_BAND));
  }

  /**
   * The two interactions that do not necessarily reach the server. A band switch on an unchanged
   * focus is usually served by the map's own prefetch of adjacent bands, and fit-to-screen never
   * fetches at all — so both isolate client-side ELK layout cost from the API's. A regression here
   * is a layout regression, not a backend one.
   */
  private void measureViewInteractions(final UiSession ui) throws Exception {
    measureInteraction(
        ui,
        "band-switch-prefetched",
        iteration -> LineageMapPage.openPlatformScene(ui, ASSET_BAND).settle(),
        map -> map.switchBand(LAYER_BAND));
    measureInteraction(
        ui,
        "fit-to-screen",
        iteration -> LineageMapPage.openPlatformScene(ui, ASSET_BAND),
        LineageMapPage::fitToScreen);
  }

  private void measureInteraction(
      final UiSession ui,
      final String name,
      final StagedSetup<LineageMapPage> setup,
      final StagedAction<LineageMapPage> action)
      throws Exception {
    final String id = INTERACTION_PREFIX + name;
    latencies.put(
        id, LatencySampler.measureStaged(INTERACTION_WARMUPS, INTERACTION_SAMPLES, setup, action));
    LOG.info("Interaction {} -> {}", id, latencies.get(id));
  }

  private void assertInteractionsWithinBudget() {
    latencies.entrySet().stream()
        .filter(entry -> entry.getKey().startsWith(INTERACTION_PREFIX))
        .forEach(
            entry ->
                assertThat(entry.getValue().p95Millis())
                    .as(
                        "%s p95 over %d assets / %d edges",
                        entry.getKey(), graph.tables(), graph.edges())
                    .isLessThan(INTERACTION_P95_LIMIT_MS));
  }

  // ---------------- scenarios ----------------

  private record Scenario(String id, BenchmarkInteraction interaction, long limitMillis) {}

  private List<Scenario> scenarios() {
    final List<Scenario> scenarios = new ArrayList<>();
    scenarios.addAll(rootScenarios());
    scenarios.addAll(focusedScenarios());
    scenarios.addAll(legacyScenarios());
    return List.copyOf(scenarios);
  }

  /**
   * The unfocused scenes. {@code -warm} samples hit the shared root cache from the second request
   * on; {@code -cold} varies {@code size}, which is part of the cache key, so every sample pays the
   * full aggregation and root-asset fan-out.
   */
  private List<Scenario> rootScenarios() {
    return List.of(
        root("root-layer-warm", LineageBand.LAYER, iteration -> DEFAULT_SCENE_SIZE),
        root("root-asset-warm", LineageBand.ASSET, iteration -> DEFAULT_SCENE_SIZE),
        root("root-asset-cold", LineageBand.ASSET, iteration -> DEFAULT_SCENE_SIZE + iteration),
        root("root-asset-wide-cold", LineageBand.ASSET, iteration -> WIDE_SCENE_SIZE - iteration));
  }

  /**
   * One scene per level the map drills through, plus the two shapes whose cost differs most: a hub
   * node in the FIELD band (widest {@code _source} per hit) and the same hub at maximum depth.
   */
  private List<Scenario> focusedScenarios() {
    final LineageFocusPoints focus = graph.focusPoints();
    return List.of(
        focused(
            "focused-service-asset",
            focus.serviceFqn(),
            DATABASE_SERVICE_ENTITY_TYPE,
            LineageBand.ASSET,
            1),
        focused(
            "focused-database-asset",
            focus.databaseFqn(),
            DATABASE_ENTITY_TYPE,
            LineageBand.ASSET,
            1),
        focused(
            "focused-schema-asset",
            focus.schemaFqn(),
            DATABASE_SCHEMA_ENTITY_TYPE,
            LineageBand.ASSET,
            1),
        focused("focused-hub-asset", focus.hubTableFqn(), TABLE_ENTITY_TYPE, LineageBand.ASSET, 1),
        focused("focused-hub-field", focus.hubTableFqn(), TABLE_ENTITY_TYPE, LineageBand.FIELD, 1),
        focused(
            "focused-hub-asset-depth3",
            focus.hubTableFqn(),
            TABLE_ENTITY_TYPE,
            LineageBand.ASSET,
            3),
        focused(
            "focused-leaf-asset", focus.leafTableFqn(), TABLE_ENTITY_TYPE, LineageBand.ASSET, 1));
  }

  /**
   * The pre-#29204 endpoints over the same graph. This is the current-vs-previous axis: the scene
   * API caps depth at 3 and size at 1000, while these default both to 10000, so the comparison is
   * what a release-over-release benchmark is actually measuring.
   */
  private List<Scenario> legacyScenarios() {
    final String hubFqn = graph.focusPoints().hubTableFqn();
    return List.of(
        new Scenario(
            "legacy-get-lineage-depth3",
            iteration -> requestLegacy(SEARCH_LINEAGE_PATH, legacySearchRequest(hubFqn)),
            LEGACY_P95_LIMIT_MS),
        new Scenario(
            "legacy-entity-count-downstream",
            iteration -> requestLegacy(ENTITY_COUNT_LINEAGE_PATH, legacyEntityCountRequest(hubFqn)),
            LEGACY_P95_LIMIT_MS));
  }

  private Scenario root(final String id, final LineageBand band, final IntUnaryOperator size) {
    return new Scenario(
        id,
        iteration ->
            requestScene(
                sceneRequest(band)
                    .queryParam("size", String.valueOf(size.applyAsInt(iteration)))
                    .build()),
        ROOT_SCENE_P95_LIMIT_MS);
  }

  private Scenario focused(
      final String id,
      final String focusFqn,
      final String entityType,
      final LineageBand band,
      final int depth) {
    return new Scenario(
        id,
        iteration -> requestScene(focusedRequest(focusFqn, entityType, band, depth)),
        FOCUSED_SCENE_P95_LIMIT_MS);
  }

  // ---------------- requests ----------------

  private static RequestOptions.Builder sceneRequest(final LineageBand band) {
    return RequestOptions.builder()
        .queryParam("lens", LineageLens.SERVICE.value())
        .queryParam("band", band.value())
        .queryParam("upstreamDepth", "1")
        .queryParam("downstreamDepth", "1")
        .queryParam("includeDeleted", "false");
  }

  private static RequestOptions focusedRequest(
      final String focusFqn, final String entityType, final LineageBand band, final int depth) {
    return RequestOptions.builder()
        .queryParam("focusFqn", focusFqn)
        .queryParam("entityType", entityType)
        .queryParam("lens", LineageLens.SERVICE.value())
        .queryParam("band", band.value())
        .queryParam("upstreamDepth", String.valueOf(depth))
        .queryParam("downstreamDepth", String.valueOf(depth))
        .queryParam("size", String.valueOf(DEFAULT_SCENE_SIZE))
        .queryParam("includeDeleted", "false")
        .build();
  }

  private static RequestOptions legacySearchRequest(final String fqn) {
    return RequestOptions.builder()
        .queryParam("fqn", fqn)
        .queryParam("upstreamDepth", "3")
        .queryParam("downstreamDepth", "3")
        .queryParam("includeDeleted", "false")
        .build();
  }

  private static RequestOptions legacyEntityCountRequest(final String fqn) {
    return RequestOptions.builder()
        .queryParam("fqn", fqn)
        .queryParam("direction", "Downstream")
        .queryParam("from", "0")
        .queryParam("size", String.valueOf(WIDE_SCENE_SIZE))
        .queryParam("includeDeleted", "false")
        .build();
  }

  private LineageScene requestScene(final RequestOptions options) throws IOException {
    final String response =
        client.getHttpClient().executeForString(HttpMethod.GET, SCENE_PATH, null, options);
    return MAPPER.readValue(response, LineageScene.class);
  }

  private void requestLegacy(final String path, final RequestOptions options) {
    client.getHttpClient().executeForString(HttpMethod.GET, path, null, options);
  }

  private void renderScene(final UiSession ui, final LineageFocusPoints focus) {
    final LineageMapPage map =
        LineageMapPage.openScene(
            ui, focus.hubTableFqn(), TABLE_ENTITY_TYPE, LineageBand.ASSET.value());
    counters.put("renderedNodeCount", map.renderedNodeCount());
    counters.put("navigationDurationMillis", map.navigationDurationMillis());
    map.close();
  }

  // ---------------- assertions, indexing, publishing ----------------

  private void assertWithinBudget(final List<Scenario> scenarios) {
    for (final Scenario scenario : scenarios) {
      assertThat(latencies.get(scenario.id()).p95Millis())
          .as("%s p95 over %d assets / %d edges", scenario.id(), graph.tables(), graph.edges())
          .isLessThan(scenario.limitMillis());
    }
  }

  /**
   * Waits for the seeded cohort to reach the table index. The scene API is search-backed end to
   * end, so measuring before the corpus is indexed would benchmark an empty graph and report a
   * flattering number.
   */
  private void awaitIndexed() {
    final ServerHandle server = OssTestServer.defaultHandle();
    final SearchAssertions search = new SearchAssertions(server);
    final String tableAlias = new IndexAliasInspector(server).indexNameFor(Entity.TABLE);
    Awaitility.await("lineage benchmark corpus indexed")
        .atMost(INDEXING_TIMEOUT)
        .pollInterval(Duration.ofSeconds(10))
        .ignoreExceptions()
        .until(() -> search.count(tableAlias) >= graph.tables());
    assertSceneIsPopulated();
  }

  /**
   * The doc count alone is not enough — a scene also needs its aggregations to see the new services,
   * which lags the table index.
   */
  private void assertSceneIsPopulated() {
    Awaitility.await("root lineage scene populated")
        .atMost(INDEXING_TIMEOUT)
        .pollInterval(Duration.ofSeconds(5))
        .ignoreExceptions()
        .until(
            () ->
                !requestScene(sceneRequest(LineageBand.LAYER).queryParam("size", "200").build())
                    .getNodes()
                    .isEmpty());
  }

  private void recordGraphCounters() {
    counters.put("services", graph.services());
    counters.put("databases", graph.databases());
    counters.put("schemas", graph.schemas());
    counters.put("tables", graph.tables());
    counters.put("edges", graph.edges());
    counters.put("columnEdges", graph.columnEdges());
    counters.put("seedTableMillis", graph.tableDuration().toMillis());
    counters.put("seedEdgeMillis", graph.edgeDuration().toMillis());
    counters.put("seedTablesPerSecond", graph.tablesPerSecond());
    counters.put("seedEdgesPerSecond", graph.edgesPerSecond());
  }

  private void publishMetrics() throws IOException {
    recordSceneShape();
    BenchmarkMetrics.publish(
        BenchmarkMetrics.report(client, "lineage-scene-scale", params(), latencies, counters),
        "lineage-scene-scale-" + spec.tables() + ".json");
  }

  /**
   * Records what the scene actually returned, so a p95 that improved because the response got
   * smaller is visible rather than celebrated. {@code sampled} is the server's own flag for "this
   * scene is a subset" — note it is also set when a child-lineage lookup hits its 15s timeout, so a
   * true reading needs both it and the node count.
   */
  private void recordSceneShape() {
    try {
      final LineageScene scene =
          requestScene(
              focusedRequest(
                  graph.focusPoints().hubTableFqn(), TABLE_ENTITY_TYPE, LineageBand.ASSET, 1));
      counters.put("focusedHubNodeCount", scene.getNodes().size());
      counters.put("focusedHubEdgeCount", scene.getEdges().size());
      counters.put("focusedHubHiddenNodeCount", scene.getHiddenNodeCount());
      counters.put("focusedHubSampled", scene.getSampled());
    } catch (final IOException e) {
      LOG.warn("Could not record scene shape; metrics will omit it", e);
    }
  }

  private Map<String, Object> params() {
    final Map<String, Object> params = new LinkedHashMap<>();
    params.put("tables", spec.tables());
    params.put("edges", spec.edges());
    params.put("services", spec.services());
    params.put("databasesPerService", spec.databasesPerService());
    params.put("schemasPerDatabase", spec.schemasPerDatabase());
    params.put("depth", spec.depth());
    params.put("hubCount", spec.hubCount());
    params.put("hubFanout", spec.hubFanout());
    params.put("columnsPerTable", spec.columnsPerTable());
    params.put("columnEdgeRatio", spec.columnEdgeRatio());
    params.put("warmups", WARMUPS);
    params.put("samples", SAMPLES);
    params.put("renderSamples", RENDER_SAMPLES);
    params.put("randomSeed", spec.randomSeed());
    return params;
  }
}
