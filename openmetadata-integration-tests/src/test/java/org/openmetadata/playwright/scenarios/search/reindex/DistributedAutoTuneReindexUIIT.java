package org.openmetadata.playwright.scenarios.search.reindex;

import static org.assertj.core.api.Assertions.assertThat;

import com.microsoft.playwright.assertions.PlaywrightAssertions;
import java.time.Duration;
import java.util.Map;
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
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.SearchAssertions;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.playwright.ui.UiSession;
import org.openmetadata.playwright.ui.UiSessionExtension;
import org.openmetadata.playwright.ui.pages.SearchIndexAppPage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Validates that {@code SearchIndexingApplication} run with {@code useDistributedIndexing
 * =true} and {@code autoTune=true} produces ES doc counts that match the SDK-ingested
 * cohort across every entity type. Complements {@link SimpleReindexTriggerUIIT} (which
 * asserts via UI count badges) by going directly to per-type indices through the OM
 * search API — that's the same surface the reindex job writes against, so any drift
 * between what the job claims it indexed and what's actually searchable shows up here.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
@Tag("search-direct")
class DistributedAutoTuneReindexUIIT {

  private static final Logger LOG = LoggerFactory.getLogger(DistributedAutoTuneReindexUIIT.class);

  // Cohort distributed across four entity types — exercises the per-type partitioning
  // logic distributed reindex relies on rather than just a single-type happy path.
  private static final int TABLES = 1_500;
  private static final int TOPICS = 800;
  private static final int DASHBOARDS = 800;
  private static final int PIPELINES = 800;
  private static final int COLUMNS_PER_TABLE = 5;
  private static final int PARALLEL_INGEST_WORKERS = 16;

  private static final Duration REINDEX_TIMEOUT = ReindexHelpers.reindexTimeout();
  // Run terminal swaps the alias, but engine refresh on the new index lags a beat (longer on a
  // loaded cluster under the parallel ui-it profile). Poll until the strict cohort count converges.
  private static final Duration COUNT_TIMEOUT = ReindexHelpers.searchPropagationTimeout();
  private static final Duration COUNT_POLL_INTERVAL = Duration.ofSeconds(3);

  // Name base per kind — matches what EntityLoader uses to prefix entity names. We query
  // by this prefix so the count assertion is strict (== ingested cohort) and immune to
  // any seed data the container image ships with, or to entities other parallel ui-it tests
  // ingest into the same shared index.
  private static final Map<EntityKind, String> NAME_BASE_PER_KIND =
      Map.of(
          EntityKind.TABLE, "table",
          EntityKind.TOPIC, "topic",
          EntityKind.DASHBOARD, "dashboard",
          EntityKind.PIPELINE, "pipeline");

  @Test
  void distributedAutoTunedReindexCountsMatchIngestedCohortPerEntityType(
      final UiSession ui, final TestNamespace ns) {
    final EntityLoadSummary seeded = ingestMultiTypeCohort(ns);
    final ServerHandle server = ui.server();

    smokeCheckSearchIndexAppPageLoads(ui);

    LOG.info("Triggering distributed + auto-tuned reindex");
    final long triggerTime = System.currentTimeMillis();
    ReindexHelpers.triggerSearchIndexWithConfigWhenIdle(
        server, distributedAutoTuneConfig(), Duration.ofSeconds(60));
    ReindexHelpers.waitForRunStartedSince(
        server, ReindexHelpers.SEARCH_INDEX_APP, triggerTime, Duration.ofSeconds(30));

    Awaitility.await("distributed reindex to complete")
        .atMost(REINDEX_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () ->
                ReindexHelpers.freshRunIsTerminal(
                    server, ReindexHelpers.SEARCH_INDEX_APP, triggerTime));
    LOG.info("Reindex terminal — asserting per-type cohort counts (polling out refresh lag)");

    assertPerTypeCounts(server, ns, seeded);
  }

  private static EntityLoadSummary ingestMultiTypeCohort(final TestNamespace ns) {
    EntityLoadSpec spec =
        EntityLoadSpec.builder()
            .parallelWorkers(PARALLEL_INGEST_WORKERS)
            .columnsPerTable(COLUMNS_PER_TABLE)
            .count(EntityKind.TABLE, TABLES)
            .count(EntityKind.TOPIC, TOPICS)
            .count(EntityKind.DASHBOARD, DASHBOARDS)
            .count(EntityKind.PIPELINE, PIPELINES)
            .build();
    EntityLoadSummary summary = EntityLoader.load(spec, ns);
    LOG.info("Ingested cohort: {}", summary.created());
    return summary;
  }

  private static void smokeCheckSearchIndexAppPageLoads(final UiSession ui) {
    SearchIndexAppPage page = SearchIndexAppPage.open(ui);
    PlaywrightAssertions.assertThat(page.runNowButton()).isVisible();
  }

  private static Map<String, Object> distributedAutoTuneConfig() {
    return Map.of(
        "entities", java.util.List.of("table", "topic", "dashboard", "pipeline"),
        "recreateIndex", true,
        "useDistributedIndexing", true,
        "autoTune", true);
  }

  private static void assertPerTypeCounts(
      final ServerHandle server, final TestNamespace ns, final EntityLoadSummary seeded) {
    final SearchAssertions search = new SearchAssertions(server);
    final IndexAliasInspector indices = new IndexAliasInspector(server);
    seeded
        .created()
        .forEach((kind, expected) -> awaitExactCohortIndexed(search, indices, ns, kind, expected));
  }

  /**
   * Strict cohort count: docs whose {@code name.keyword} starts with this run's unique prefix must
   * equal the ingested count. A {@code name.keyword} prefix is exact and run-scoped — unlike a
   * relevance {@code q=} query, which fuzzy-matches and would also count entities other parallel
   * ui-it tests ingest into the same shared index. The index name is resolved cluster-alias-aware
   * via {@link IndexAliasInspector} rather than hardcoded, and the count is polled to ride out the
   * post-swap refresh lag.
   */
  private static void awaitExactCohortIndexed(
      final SearchAssertions search,
      final IndexAliasInspector indices,
      final TestNamespace ns,
      final EntityKind kind,
      final long expected) {
    final String type = NAME_BASE_PER_KIND.get(kind);
    final String index = indices.indexNameFor(type);
    final String namePrefix = ns.prefix(type) + "_";
    LOG.info("Asserting index[{}] cohort count == {} for prefix '{}'", index, expected, namePrefix);
    Awaitility.await("index[" + index + "] cohort count for '" + namePrefix + "' == " + expected)
        .atMost(COUNT_TIMEOUT)
        .pollInterval(COUNT_POLL_INTERVAL)
        .pollDelay(Duration.ZERO)
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertThat(search.countByNamePrefix(index, namePrefix))
                    .as(
                        "post-reindex doc count for %s in index %s (prefix '%s') must match"
                            + " ingested cohort exactly",
                        kind, index, namePrefix)
                    .isEqualTo(expected));
  }
}
