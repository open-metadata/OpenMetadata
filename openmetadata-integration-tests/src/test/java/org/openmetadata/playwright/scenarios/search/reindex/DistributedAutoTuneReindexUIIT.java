package org.openmetadata.playwright.scenarios.search.reindex;

import static org.assertj.core.api.Assertions.assertThat;

import com.microsoft.playwright.assertions.PlaywrightAssertions;
import java.time.Duration;
import java.util.LinkedHashMap;
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
  private static final Duration POST_REINDEX_REFRESH_GRACE = Duration.ofSeconds(3);
  private static final int PROBE_PAGE_SIZE = 1;

  private static final Map<EntityKind, String> INDEX_ALIAS_PER_KIND =
      Map.of(
          EntityKind.TABLE, "table_search_index",
          EntityKind.TOPIC, "topic_search_index",
          EntityKind.DASHBOARD, "dashboard_search_index",
          EntityKind.PIPELINE, "pipeline_search_index");

  // Name base per kind — matches what EntityLoader uses to prefix entity names. We query
  // by this prefix so the count assertion is strict (== ingested cohort) and immune to
  // any seed data the container image ships with.
  private static final Map<EntityKind, String> NAME_BASE_PER_KIND =
      Map.of(
          EntityKind.TABLE, "table",
          EntityKind.TOPIC, "topic",
          EntityKind.DASHBOARD, "dashboard",
          EntityKind.PIPELINE, "pipeline");

  @Test
  void distributedAutoTunedReindexCountsMatchIngestedCohortPerEntityType(
      final UiSession ui, final TestNamespace ns) throws InterruptedException {
    EntityLoadSummary seeded = ingestMultiTypeCohort(ns);
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
    LOG.info(
        "Reindex terminal — waiting {}ms for ES refresh", POST_REINDEX_REFRESH_GRACE.toMillis());
    Thread.sleep(POST_REINDEX_REFRESH_GRACE.toMillis());

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
    Map<EntityKind, Long> actualPerKind = new LinkedHashMap<>();
    seeded
        .created()
        .forEach(
            (kind, expected) -> {
              String alias = INDEX_ALIAS_PER_KIND.get(kind);
              String namePrefix = ns.prefix(NAME_BASE_PER_KIND.get(kind));
              SearchProbe probe =
                  SearchQueryHelper.probeIndex(server, alias, namePrefix, PROBE_PAGE_SIZE);
              actualPerKind.put(kind, probe.totalHits());
              LOG.info(
                  "Per-type count assertion: kind={} index={} prefix='{}' expected={} actual={}",
                  kind,
                  alias,
                  namePrefix,
                  expected,
                  probe.totalHits());
              assertThat(probe.totalHits())
                  .as(
                      "post-reindex doc count for %s in index %s (prefix '%s') must match"
                          + " ingested cohort exactly",
                      kind, alias, namePrefix)
                  .isEqualTo((long) expected);
            });
  }
}
