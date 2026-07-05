package org.openmetadata.playwright.scenarios.search.reindex;

import static org.assertj.core.api.Assertions.assertThat;

import com.microsoft.playwright.assertions.PlaywrightAssertions;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.EntityLoadSpec;
import org.openmetadata.it.factories.EntityLoadSpec.EntityKind;
import org.openmetadata.it.factories.EntityLoadSummary;
import org.openmetadata.it.factories.EntityLoader;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.SearchQueryHelper;
import org.openmetadata.it.search.SearchQueryHelper.SearchProbe;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.playwright.ui.UiSession;
import org.openmetadata.playwright.ui.UiSessionExtension;
import org.openmetadata.playwright.ui.pages.SearchIndexAppPage;
import org.openmetadata.sdk.network.HttpMethod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Whole-platform stability check while a recreate-mode reindex covers every kind
 * {@link EntityLoader} produces. Generalises the single-table zero-downtime contract from
 * <a href="https://github.com/open-metadata/OpenMetadata/issues/23514">issue #23514</a>
 * across all 18 alias-bearing entity types so a regression in one alias swap surfaces
 * here instead of being masked by the others.
 *
 * <p>Flow:
 * <ol>
 *   <li>Ingest a mixed cohort spanning every kind in {@link #PER_KIND_BASE} (asset
 *       entities, taxonomy, governance, quality). Per-kind counts scale with
 *       {@link #SCALE} so the same test runs at PR scale (~3k entities) and at nightly
 *       stress scale (~100k entities when {@code -Djpw.searchAvailableAllKinds.scale=40}).
 *   <li>Baseline reindex so each per-kind alias points at a known set.
 *   <li>Trigger a recreate-mode reindex for every entity type with a deliberately small
 *       batch + single-thread config so the run spans wall-time long enough for the probe
 *       loop to observe mid-flight state.
 *   <li>While the run is non-terminal, sweep through every per-kind alias on each tick
 *       and assert (a) {@code total > 0} (no search blackout), (b) no duplicates (alias
 *       swap atomicity), and (c) {@code GET /v1/system/version} still answers 200 so we
 *       know the API plane stays healthy under the indexer's load.
 *   <li>After terminal + an ES refresh grace, assert every baseline entity per kind is
 *       still visible — recreate must not lose docs.
 * </ol>
 *
 * <p>Defaults are PR-friendly. Stress runs override via system properties: every per-kind
 * count is multiplied by {@code -Djpw.searchAvailableAllKinds.scale=N} (default 1.0), or
 * any individual kind can be set explicitly via
 * {@code -Djpw.searchAvailableAllKinds.<kind>=N}. {@code scale=40} produces roughly the
 * 100k-entity load of {@code Scale100kEntitiesIT} but spread across all 18 alias-bearing
 * kinds so every per-kind index gets exercised. Allow ~45 minutes for that scale.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
@Tag("search-direct")
class SearchAvailableAllKindsDuringReindexUIIT {

  private static final Logger LOG =
      LoggerFactory.getLogger(SearchAvailableAllKindsDuringReindexUIIT.class);

  private static final String SCALE_PROP = "jpw.searchAvailableAllKinds.scale";
  private static final String PER_KIND_PROP_PREFIX = "jpw.searchAvailableAllKinds.";
  private static final String COLS_PROP = PER_KIND_PROP_PREFIX + "cols";
  private static final String WORKERS_PROP = PER_KIND_PROP_PREFIX + "workers";

  private static final double SCALE = Double.parseDouble(System.getProperty(SCALE_PROP, "1.0"));
  private static final int COLUMNS_PER_TABLE = Integer.getInteger(COLS_PROP, 5);
  private static final int PARALLEL_INGEST_WORKERS = Integer.getInteger(WORKERS_PROP, 16);

  // PR-scale baseline per kind. Each entry sets the floor at {@code scale=1.0}; total ≈ 2750
  // entities runs in ~30s ingest + ~60s reindex on a healthy stack. {@code scale=40} ≈ 110k
  // total which matches Scale100kEntitiesIT's bar while exercising every per-kind alias.
  private static final Map<EntityKind, Integer> PER_KIND_BASE = new LinkedHashMap<>();

  static {
    PER_KIND_BASE.put(EntityKind.TABLE, 400);
    PER_KIND_BASE.put(EntityKind.TOPIC, 200);
    PER_KIND_BASE.put(EntityKind.DASHBOARD, 200);
    PER_KIND_BASE.put(EntityKind.PIPELINE, 200);
    PER_KIND_BASE.put(EntityKind.CHART, 200);
    PER_KIND_BASE.put(EntityKind.ML_MODEL, 100);
    PER_KIND_BASE.put(EntityKind.CONTAINER, 100);
    PER_KIND_BASE.put(EntityKind.SEARCH_INDEX, 100);
    PER_KIND_BASE.put(EntityKind.API_COLLECTION, 50);
    PER_KIND_BASE.put(EntityKind.API_ENDPOINT, 100);
    PER_KIND_BASE.put(EntityKind.STORED_PROCEDURE, 100);
    PER_KIND_BASE.put(EntityKind.QUERY, 200);
    PER_KIND_BASE.put(EntityKind.DASHBOARD_DATA_MODEL, 100);
    PER_KIND_BASE.put(EntityKind.GLOSSARY_TERM, 200);
    PER_KIND_BASE.put(EntityKind.TAG, 200);
    PER_KIND_BASE.put(EntityKind.DOMAIN, 50);
    PER_KIND_BASE.put(EntityKind.DATA_PRODUCT, 50);
    PER_KIND_BASE.put(EntityKind.TEST_CASE, 200);
  }

  // Resolved counts: per-kind explicit override (e.g. -Djpw...tables=100000) wins;
  // otherwise base * SCALE. Stored once so PROBE_PAGE_SIZE can size off the largest kind.
  private static final Map<EntityKind, Integer> PER_KIND_COUNT = resolvePerKindCounts();

  // Slow-down knobs applied to the in-flight reindex so probes have time to observe
  // mid-flight state. Inline trigger config — does not persist on the app. Distributed
  // indexing is forced off so batchSize / threads actually bound throughput.
  private static final int SLOW_BATCH_SIZE = 10;
  private static final int SLOW_PRODUCER_THREADS = 1;
  private static final int SLOW_CONSUMER_THREADS = 1;

  // Order is the probe sweep order — LinkedHashMap so logs are deterministic. Aliases sourced
  // from openmetadata-spec/src/main/resources/elasticsearch/indexMapping.json; entity type
  // strings are the values the SearchIndexingApplication accepts in its `entities` config.
  private static final Map<EntityKind, String> ALIAS_BY_KIND = new LinkedHashMap<>();
  private static final Map<EntityKind, String> ENTITY_TYPE_BY_KIND = new LinkedHashMap<>();

  static {
    ALIAS_BY_KIND.put(EntityKind.TABLE, "table_search_index");
    ALIAS_BY_KIND.put(EntityKind.TOPIC, "topic_search_index");
    ALIAS_BY_KIND.put(EntityKind.DASHBOARD, "dashboard_search_index");
    ALIAS_BY_KIND.put(EntityKind.PIPELINE, "pipeline_search_index");
    ALIAS_BY_KIND.put(EntityKind.CHART, "chart_search_index");
    ALIAS_BY_KIND.put(EntityKind.ML_MODEL, "mlmodel_search_index");
    ALIAS_BY_KIND.put(EntityKind.CONTAINER, "container_search_index");
    ALIAS_BY_KIND.put(EntityKind.SEARCH_INDEX, "search_entity_search_index");
    ALIAS_BY_KIND.put(EntityKind.API_COLLECTION, "api_collection_search_index");
    ALIAS_BY_KIND.put(EntityKind.API_ENDPOINT, "api_endpoint_search_index");
    ALIAS_BY_KIND.put(EntityKind.STORED_PROCEDURE, "stored_procedure_search_index");
    ALIAS_BY_KIND.put(EntityKind.QUERY, "query_search_index");
    ALIAS_BY_KIND.put(EntityKind.DASHBOARD_DATA_MODEL, "dashboard_data_model_search_index");
    ALIAS_BY_KIND.put(EntityKind.GLOSSARY_TERM, "glossary_term_search_index");
    ALIAS_BY_KIND.put(EntityKind.TAG, "tag_search_index");
    ALIAS_BY_KIND.put(EntityKind.DOMAIN, "domain_search_index");
    ALIAS_BY_KIND.put(EntityKind.DATA_PRODUCT, "data_product_search_index");
    ALIAS_BY_KIND.put(EntityKind.TEST_CASE, "test_case_search_index");

    ENTITY_TYPE_BY_KIND.put(EntityKind.TABLE, "table");
    ENTITY_TYPE_BY_KIND.put(EntityKind.TOPIC, "topic");
    ENTITY_TYPE_BY_KIND.put(EntityKind.DASHBOARD, "dashboard");
    ENTITY_TYPE_BY_KIND.put(EntityKind.PIPELINE, "pipeline");
    ENTITY_TYPE_BY_KIND.put(EntityKind.CHART, "chart");
    ENTITY_TYPE_BY_KIND.put(EntityKind.ML_MODEL, "mlmodel");
    ENTITY_TYPE_BY_KIND.put(EntityKind.CONTAINER, "container");
    ENTITY_TYPE_BY_KIND.put(EntityKind.SEARCH_INDEX, "searchIndex");
    ENTITY_TYPE_BY_KIND.put(EntityKind.API_COLLECTION, "apiCollection");
    ENTITY_TYPE_BY_KIND.put(EntityKind.API_ENDPOINT, "apiEndpoint");
    ENTITY_TYPE_BY_KIND.put(EntityKind.STORED_PROCEDURE, "storedProcedure");
    ENTITY_TYPE_BY_KIND.put(EntityKind.QUERY, "query");
    ENTITY_TYPE_BY_KIND.put(EntityKind.DASHBOARD_DATA_MODEL, "dashboardDataModel");
    ENTITY_TYPE_BY_KIND.put(EntityKind.GLOSSARY_TERM, "glossaryTerm");
    ENTITY_TYPE_BY_KIND.put(EntityKind.TAG, "tag");
    ENTITY_TYPE_BY_KIND.put(EntityKind.DOMAIN, "domain");
    ENTITY_TYPE_BY_KIND.put(EntityKind.DATA_PRODUCT, "dataProduct");
    ENTITY_TYPE_BY_KIND.put(EntityKind.TEST_CASE, "testCase");
  }

  private static final int LARGEST_KIND_COUNT =
      PER_KIND_COUNT.values().stream().mapToInt(Integer::intValue).max().orElse(1000);
  private static final int PROBE_PAGE_SIZE = LARGEST_KIND_COUNT + 100;
  private static final Duration PROBE_INTERVAL = Duration.ofMillis(1500);
  // Reindex timeout scales loosely with total entities — at scale=40 (~100k) the slow
  // single-thread config can take 30 min. Allow generous headroom; the test exits as soon
  // as the run reaches terminal so the timeout is a safety net, not a target.
  private static final Duration REINDEX_TIMEOUT = ReindexHelpers.reindexTimeout();
  // ES refresh interval is 1s; give a 3s grace before post-reindex assertions so we
  // don't flake on a yet-to-refresh segment.
  private static final Duration POST_REINDEX_REFRESH_GRACE = Duration.ofSeconds(3);
  // Ride out transient 503 "all shards failed" right after an alias swap onto a freshly-
  // created index whose shards are still initialising. A sustained outage still fails.
  private static final Duration SHARD_LAG_BUDGET = Duration.ofSeconds(15);
  private static final String VERSION_PATH = "/v1/system/version";

  @Test
  void searchStaysAvailableAcrossAllKindsWhileRecreateReindexRuns(
      final UiSession ui, final TestNamespace ns) {
    logResolvedConfig();
    final EntityLoadSummary seeded = ingestCohort(ns);
    final ServerHandle server = ui.server();

    LOG.info("Baseline reindex so each per-kind alias points at a known set");
    ReindexHelpers.triggerSearchIndexAndWait(server);

    final Map<EntityKind, Set<String>> baselineByKind = captureBaselineByKind(server, seeded);

    smokeCheckSearchIndexAppPageLoads(ui);

    LOG.info(
        "Triggering recreate-mode reindex for {} with slow config", ENTITY_TYPE_BY_KIND.values());
    final long triggerTime = System.currentTimeMillis();
    ReindexHelpers.triggerSearchIndexWithConfigWhenIdle(
        server, slowAllKindsReindexConfig(), Duration.ofSeconds(60));
    ReindexHelpers.waitForRunStartedSince(
        server, ReindexHelpers.SEARCH_INDEX_APP, triggerTime, Duration.ofSeconds(30));

    final AtomicInteger probeSweep = new AtomicInteger();
    Awaitility.await("reindex run to reach terminal state")
        .atMost(REINDEX_TIMEOUT)
        .pollInterval(PROBE_INTERVAL)
        .pollDelay(Duration.ZERO)
        .ignoreNoExceptions()
        .until(
            () -> {
              final int sweep = probeSweep.incrementAndGet();
              assertPlatformResponsive(server, sweep);
              for (Map.Entry<EntityKind, String> entry : ALIAS_BY_KIND.entrySet()) {
                if (seeded.countOf(entry.getKey()) == 0) {
                  continue;
                }
                assertMidFlightProbe(server, entry.getKey(), entry.getValue(), sweep);
              }
              return ReindexHelpers.freshRunIsTerminal(
                  server, ReindexHelpers.SEARCH_INDEX_APP, triggerTime);
            });
    LOG.info(
        "Reindex reached terminal status after {} mid-flight probe sweeps; waiting {}ms for ES"
            + " refresh before asserting eventual consistency",
        probeSweep.get(),
        POST_REINDEX_REFRESH_GRACE.toMillis());

    Awaitility.await("post-reindex ES refresh grace period")
        .pollDelay(POST_REINDEX_REFRESH_GRACE)
        .atMost(POST_REINDEX_REFRESH_GRACE.plusSeconds(1))
        .until(() -> true);

    baselineByKind.forEach(
        (kind, baselineIds) ->
            assertEventualConsistency(server, kind, ALIAS_BY_KIND.get(kind), baselineIds));
  }

  private static void logResolvedConfig() {
    LOG.info(
        "Resolved config: scale={} workers={} total={} per-kind={} (override with"
            + " -Djpw.searchAvailableAllKinds.scale/.workers or per-kind .<kind>)",
        SCALE,
        PARALLEL_INGEST_WORKERS,
        PER_KIND_COUNT.values().stream().mapToInt(Integer::intValue).sum(),
        PER_KIND_COUNT);
    final boolean foreignProps =
        System.getProperties().keySet().stream()
            .map(Object::toString)
            .anyMatch(
                key ->
                    key.startsWith("jpw.searchAvailable.")
                        && !key.startsWith("jpw.searchAvailableAllKinds."));
    if (foreignProps) {
      LOG.warn(
          "Detected -Djpw.searchAvailable.* properties, but this test reads"
              + " jpw.searchAvailableAllKinds.* — those overrides are IGNORED here. Run"
              + " SearchAvailableDuringReindexUIIT for the single-table knobs.");
    }
  }

  private static EntityLoadSummary ingestCohort(final TestNamespace ns) {
    final EntityLoadSpec.Builder builder =
        EntityLoadSpec.builder()
            .parallelWorkers(PARALLEL_INGEST_WORKERS)
            .columnsPerTable(COLUMNS_PER_TABLE);
    PER_KIND_COUNT.forEach(
        (kind, count) -> {
          if (count > 0) {
            builder.count(kind, count);
          }
        });
    return EntityLoader.load(builder.build(), ns);
  }

  private static Map<EntityKind, Integer> resolvePerKindCounts() {
    final Map<EntityKind, Integer> resolved = new LinkedHashMap<>();
    PER_KIND_BASE.forEach(
        (kind, base) -> {
          final String override = System.getProperty(PER_KIND_PROP_PREFIX + propKeyFor(kind));
          final int count =
              (override != null && !override.isBlank())
                  ? Integer.parseInt(override)
                  : (int) Math.round(base * SCALE);
          resolved.put(kind, Math.max(0, count));
        });
    return Map.copyOf(resolved);
  }

  private static String propKeyFor(final EntityKind kind) {
    // Plural-camelCase to match the convention perf-test.sh + earlier overrides used:
    // TABLE → "tables", ML_MODEL → "mlmodels", GLOSSARY_TERM → "glossaryTerms".
    final String[] parts = kind.name().toLowerCase().split("_");
    final StringBuilder out = new StringBuilder(parts[0]);
    for (int i = 1; i < parts.length; i++) {
      out.append(Character.toUpperCase(parts[i].charAt(0))).append(parts[i].substring(1));
    }
    out.append('s');
    return out.toString();
  }

  private static Map<EntityKind, Set<String>> captureBaselineByKind(
      final ServerHandle server, final EntityLoadSummary seeded) {
    final Map<EntityKind, Set<String>> baselines = new LinkedHashMap<>();
    for (Map.Entry<EntityKind, String> entry : ALIAS_BY_KIND.entrySet()) {
      final EntityKind kind = entry.getKey();
      if (seeded.countOf(kind) == 0) {
        continue;
      }
      final SearchProbe probe =
          SearchQueryHelper.probeIndex(server, entry.getValue(), PROBE_PAGE_SIZE);
      LOG.info("Baseline probe[{}]: total={}, unique={}", kind, probe.total(), probe.unique());
      // OM container is shared across the suite; baseline may include residual entities
      // from earlier tests. Only require the freshly-seeded cohort to be visible.
      assertThat(probe.total())
          .as(
              "baseline probe for %s should see at least the seeded count %d (alias=%s)",
              kind, seeded.countOf(kind), entry.getValue())
          .isGreaterThanOrEqualTo(seeded.countOf(kind));
      baselines.put(kind, new LinkedHashSet<>(probe.uniqueIds()));
    }
    return baselines;
  }

  private static void smokeCheckSearchIndexAppPageLoads(final UiSession ui) {
    final SearchIndexAppPage page = SearchIndexAppPage.open(ui);
    PlaywrightAssertions.assertThat(page.runNowButton()).isVisible();
  }

  private static Map<String, Object> slowAllKindsReindexConfig() {
    final Map<String, Object> config = new HashMap<>();
    config.put("entities", List.copyOf(ENTITY_TYPE_BY_KIND.values()));
    config.put("recreateIndex", true);
    config.put("batchSize", SLOW_BATCH_SIZE);
    config.put("producerThreads", SLOW_PRODUCER_THREADS);
    config.put("consumerThreads", SLOW_CONSUMER_THREADS);
    config.put("useDistributedIndexing", false);
    config.put("autoTune", false);
    return config;
  }

  /**
   * Lightweight liveness probe that does not touch search at all — confirms the dropwizard
   * API plane stays responsive while the indexer thrashes the ES connection pool. A reindex
   * that blocks request threads or starves the connection pool would surface here even if
   * the per-kind search probes happen to still answer.
   */
  private static void assertPlatformResponsive(final ServerHandle server, final int sweep) {
    try {
      server.sdk().getHttpClient().execute(HttpMethod.GET, VERSION_PATH, null, Object.class);
    } catch (final RuntimeException e) {
      throw new AssertionError(
          "sweep #"
              + sweep
              + ": "
              + VERSION_PATH
              + " failed during reindex — API plane is unhealthy: "
              + e.getMessage(),
          e);
    }
  }

  /**
   * While reindex is still running, only the zero-downtime guarantees from the issue must
   * hold for this kind — the alias must always return some hits (no blackout) and never
   * expose duplicates from the swap. We deliberately do not assert "every baseline ID
   * present" mid-flight: a probe taken in the brief refresh window after the alias swap
   * can legitimately miss a few docs that the new index has but hasn't refreshed yet.
   */
  private static void assertMidFlightProbe(
      final ServerHandle server, final EntityKind kind, final String alias, final int sweep) {
    final Instant probedAt = Instant.now();
    final SearchProbe probe =
        SearchQueryHelper.probeIndexToleratingShardLag(
            server, alias, PROBE_PAGE_SIZE, SHARD_LAG_BUDGET);

    assertThat(probe.total())
        .as(
            "sweep #%d at %s for %s: zero hits during reindex would mean a search blackout"
                + " on alias %s",
            sweep, probedAt, kind, alias)
        .isGreaterThan(0);
    assertThat(probe.hasDuplicates())
        .as(
            "sweep #%d at %s for %s: duplicates indicate the alias swap exposed both old"
                + " and staged indices simultaneously (total=%d, unique=%d, alias=%s)",
            sweep, probedAt, kind, probe.total(), probe.unique(), alias)
        .isFalse();
  }

  /**
   * After the run is terminal AND refresh has had time to propagate, every baseline
   * entity for this kind must be visible again — recreate-mode reindex must not lose docs.
   */
  private static void assertEventualConsistency(
      final ServerHandle server,
      final EntityKind kind,
      final String alias,
      final Set<String> baselineIds) {
    final SearchProbe probe = SearchQueryHelper.probeIndex(server, alias, PROBE_PAGE_SIZE);
    LOG.info("Final probe[{}]: total={}, unique={}", kind, probe.total(), probe.unique());
    assertThat(probe.uniqueIds())
        .as(
            "post-reindex probe for %s: every baseline entity must remain visible after"
                + " recreate (got total=%d, unique=%d, baseline=%d, alias=%s)",
            kind, probe.total(), probe.unique(), baselineIds.size(), alias)
        .containsAll(baselineIds);
  }
}
