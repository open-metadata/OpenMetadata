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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Fan-out of {@link SearchAvailableDuringReindexUIIT}'s zero-downtime contract across
 * every kind {@link EntityLoader} produces (tables, topics, dashboards, pipelines).
 * Mirrors the same alias-swap guarantees from
 * <a href="https://github.com/open-metadata/OpenMetadata/issues/23514">issue #23514</a>
 * but probes each per-kind alias independently — a recreate handler that breaks the swap
 * for, say, only the topic alias would pass the single-kind test and fail this one.
 *
 * <p>Flow:
 * <ol>
 *   <li>Ingest a mixed cohort covering all four kinds.
 *   <li>Baseline reindex so each per-kind alias points at a known set.
 *   <li>Trigger a recreate-mode reindex for all four entity types with a deliberately
 *       small batch + single-thread config so the run spans wall-time long enough for the
 *       probe loop to observe mid-flight state.
 *   <li>While the run is non-terminal, probe every per-kind alias on each tick and assert
 *       (a) {@code total > 0} (no search blackout) and (b) no duplicates (alias swap
 *       didn't expose both old and staged indices simultaneously).
 *   <li>After terminal + an ES refresh grace, assert every baseline entity from each
 *       kind is still visible — recreate must not lose docs.
 * </ol>
 *
 * <p>Defaults are PR-friendly. Stress runs override per-kind sizes via
 * {@code -Djpw.searchAvailableAllKinds.<kind>=N}; e.g.
 * {@code -Djpw.searchAvailableAllKinds.tables=100000} mirrors the scale of
 * {@code Scale100kEntitiesIT} but with multi-kind alias-swap coverage.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class SearchAvailableAllKindsDuringReindexUIIT {

  private static final Logger LOG =
      LoggerFactory.getLogger(SearchAvailableAllKindsDuringReindexUIIT.class);

  private static final int TABLES = Integer.getInteger("jpw.searchAvailableAllKinds.tables", 200);
  private static final int TOPICS = Integer.getInteger("jpw.searchAvailableAllKinds.topics", 100);
  private static final int DASHBOARDS =
      Integer.getInteger("jpw.searchAvailableAllKinds.dashboards", 100);
  private static final int PIPELINES =
      Integer.getInteger("jpw.searchAvailableAllKinds.pipelines", 100);
  private static final int COLUMNS_PER_TABLE =
      Integer.getInteger("jpw.searchAvailableAllKinds.cols", 5);
  private static final int PARALLEL_INGEST_WORKERS =
      Integer.getInteger("jpw.searchAvailableAllKinds.workers", 16);

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

  private static final int PROBE_PAGE_SIZE = Math.max(TABLES, 1000) + 100;
  private static final Duration PROBE_INTERVAL = Duration.ofMillis(1500);
  private static final Duration REINDEX_TIMEOUT = Duration.ofMinutes(15);
  // ES refresh interval is 1s; give a 3s grace before post-reindex assertions so we
  // don't flake on a yet-to-refresh segment.
  private static final Duration POST_REINDEX_REFRESH_GRACE = Duration.ofSeconds(3);

  @Test
  void searchStaysAvailableAcrossAllKindsWhileRecreateReindexRuns(
      final UiSession ui, final TestNamespace ns) {
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

  private static EntityLoadSummary ingestCohort(final TestNamespace ns) {
    final EntityLoadSpec spec =
        EntityLoadSpec.builder()
            .parallelWorkers(PARALLEL_INGEST_WORKERS)
            .columnsPerTable(COLUMNS_PER_TABLE)
            .count(EntityKind.TABLE, TABLES)
            .count(EntityKind.TOPIC, TOPICS)
            .count(EntityKind.DASHBOARD, DASHBOARDS)
            .count(EntityKind.PIPELINE, PIPELINES)
            .build();
    return EntityLoader.load(spec, ns);
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
   * While reindex is still running, only the zero-downtime guarantees from the issue must
   * hold for this kind — the alias must always return some hits (no blackout) and never
   * expose duplicates from the swap. We deliberately do not assert "every baseline ID
   * present" mid-flight: a probe taken in the brief refresh window after the alias swap
   * can legitimately miss a few docs that the new index has but hasn't refreshed yet.
   */
  private static void assertMidFlightProbe(
      final ServerHandle server, final EntityKind kind, final String alias, final int sweep) {
    final Instant probedAt = Instant.now();
    final SearchProbe probe = SearchQueryHelper.probeIndex(server, alias, PROBE_PAGE_SIZE);

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
