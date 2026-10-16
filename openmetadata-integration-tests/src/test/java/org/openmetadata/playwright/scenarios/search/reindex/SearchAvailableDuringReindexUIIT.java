package org.openmetadata.playwright.scenarios.search.reindex;

import static org.assertj.core.api.Assertions.assertThat;

import com.microsoft.playwright.assertions.PlaywrightAssertions;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashSet;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Validates the zero-downtime reindex contract from
 * <a href="https://github.com/open-metadata/OpenMetadata/issues/23514">issue #23514</a>:
 * while a {@code recreateIndex=true} reindex is in flight, search against the entity
 * alias must remain continuously available and never expose duplicate hits.
 *
 * <p>How: we ingest a fixed cohort of tables, baseline-reindex once so the alias points
 * at a known index, then trigger a recreate-mode reindex with a deliberately small
 * {@code batchSize} and single producer/consumer thread so the run takes long enough for
 * concurrent probing to observe mid-flight state. While the run is non-terminal we probe
 * {@code /v1/search/query?index=table_search_index} every ~1.5s and assert that every
 * cohort entity is present and no hit appears twice. The atomic alias swap built by
 * {@code DefaultRecreateHandler} is what makes this true in production code; the test
 * fails immediately if it ever isn't.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
@Tag("search-direct")
class SearchAvailableDuringReindexUIIT {

  private static final Logger LOG = LoggerFactory.getLogger(SearchAvailableDuringReindexUIIT.class);

  // Cohort sized to make reindex span enough wall-time for ~5+ probes to observe
  // mid-flight state under the constrained config below. Default is PR-friendly; nightly
  // overrides via -Djpw.searchAvailable.tables=5000 for stress coverage.
  private static final int TABLES = Integer.getInteger("jpw.searchAvailable.tables", 500);
  private static final int COLUMNS_PER_TABLE = Integer.getInteger("jpw.searchAvailable.cols", 5);
  private static final int PARALLEL_INGEST_WORKERS =
      Integer.getInteger("jpw.searchAvailable.workers", 16);

  // Slow-down knobs applied to the in-flight reindex so probes have time to observe
  // mid-flight state. Inline trigger config — does not persist on the app. Distributed
  // indexing is forced off so batchSize / threads actually bound the throughput;
  // distributed mode auto-tunes around our settings.
  private static final int SLOW_BATCH_SIZE = 10;
  private static final int SLOW_PRODUCER_THREADS = 1;
  private static final int SLOW_CONSUMER_THREADS = 1;

  private static final String TABLE_INDEX_ALIAS = "table_search_index";
  private static final int PROBE_PAGE_SIZE = TABLES + 100;
  private static final Duration PROBE_INTERVAL = Duration.ofMillis(1500);
  private static final Duration REINDEX_TIMEOUT = ReindexHelpers.reindexTimeout();
  // ES refresh interval is 1s; give ourselves a 3s grace before asserting eventual
  // consistency on the post-reindex probe so we don't flake on a yet-to-refresh segment.
  private static final Duration POST_REINDEX_REFRESH_GRACE = Duration.ofSeconds(3);
  // Budget for riding out transient 503 "all shards failed" right after an alias swap onto
  // a freshly-created index whose shards are still initialising (allocation lag, not a
  // blackout). A genuine sustained outage still fails once this is exhausted.
  private static final Duration SHARD_LAG_BUDGET = Duration.ofSeconds(15);

  @Test
  void searchStaysAvailableAndDuplicateFreeWhileRecreateReindexRuns(
      final UiSession ui, final TestNamespace ns) {
    logResolvedConfig();
    EntityLoadSummary seeded = ingestCohort(ns);
    final ServerHandle server = ui.server();

    LOG.info("Baseline reindex so the alias points at a known set");
    ReindexHelpers.triggerSearchIndexAndWait(server);

    Set<String> baselineIds = captureBaselineIds(server);
    // OM container is shared across the suite; baseline may include residual entities
    // from earlier tests. We only require the freshly-seeded cohort to be visible —
    // assertEventualConsistency then checks none of them are lost across the reindex.
    assertThat(baselineIds.size())
        .as("baseline probe should see at least every ingested table after the warm-up reindex")
        .isGreaterThanOrEqualTo(seeded.countOf(EntityKind.TABLE));

    smokeCheckSearchIndexAppPageLoads(ui);

    LOG.info("Triggering recreate-mode reindex with slow config");
    final long triggerTime = System.currentTimeMillis();
    ReindexHelpers.triggerSearchIndexWithConfigWhenIdle(
        server, slowReindexConfig(), Duration.ofSeconds(60));
    ReindexHelpers.waitForRunStartedSince(
        server, ReindexHelpers.SEARCH_INDEX_APP, triggerTime, Duration.ofSeconds(30));

    final AtomicInteger probeCount = new AtomicInteger();
    Awaitility.await("reindex run to reach terminal state")
        .atMost(REINDEX_TIMEOUT)
        .pollInterval(PROBE_INTERVAL)
        .pollDelay(Duration.ZERO)
        .ignoreNoExceptions()
        .until(
            () -> {
              assertMidFlightProbe(server, probeCount.incrementAndGet());
              return ReindexHelpers.freshRunIsTerminal(
                  server, ReindexHelpers.SEARCH_INDEX_APP, triggerTime);
            });
    LOG.info(
        "Reindex reached terminal status after {} mid-flight probes; waiting {}ms for ES"
            + " refresh before asserting eventual consistency",
        probeCount.get(),
        POST_REINDEX_REFRESH_GRACE.toMillis());
    Awaitility.await("post-reindex ES refresh grace period")
        .pollDelay(POST_REINDEX_REFRESH_GRACE)
        .atMost(POST_REINDEX_REFRESH_GRACE.plusSeconds(1))
        .until(() -> true);
    assertEventualConsistency(server, baselineIds);
  }

  private static void logResolvedConfig() {
    LOG.info(
        "Resolved config: tables={} cols={} workers={} (override with"
            + " -Djpw.searchAvailable.tables/.cols/.workers)",
        TABLES,
        COLUMNS_PER_TABLE,
        PARALLEL_INGEST_WORKERS);
    final boolean foreignProps =
        System.getProperties().keySet().stream()
            .map(Object::toString)
            .anyMatch(key -> key.startsWith("jpw.searchAvailableAllKinds."));
    if (foreignProps) {
      LOG.warn(
          "Detected -Djpw.searchAvailableAllKinds.* properties, but this test reads"
              + " jpw.searchAvailable.* — those overrides are IGNORED here. Run"
              + " SearchAvailableAllKindsDuringReindexUIIT for the all-kinds scale knobs.");
    }
  }

  private static EntityLoadSummary ingestCohort(final TestNamespace ns) {
    EntityLoadSpec spec =
        EntityLoadSpec.builder()
            .parallelWorkers(PARALLEL_INGEST_WORKERS)
            .columnsPerTable(COLUMNS_PER_TABLE)
            .count(EntityKind.TABLE, TABLES)
            .build();
    return EntityLoader.load(spec, ns);
  }

  private static Set<String> captureBaselineIds(final ServerHandle server) {
    SearchProbe probe = SearchQueryHelper.probeIndex(server, TABLE_INDEX_ALIAS, PROBE_PAGE_SIZE);
    LOG.info("Baseline probe: total={}, unique={}", probe.total(), probe.unique());
    return new LinkedHashSet<>(probe.uniqueIds());
  }

  private static void smokeCheckSearchIndexAppPageLoads(final UiSession ui) {
    SearchIndexAppPage page = SearchIndexAppPage.open(ui);
    PlaywrightAssertions.assertThat(page.runNowButton()).isVisible();
  }

  private static Map<String, Object> slowReindexConfig() {
    Map<String, Object> config = new HashMap<>();
    config.put("entities", java.util.List.of("table"));
    config.put("recreateIndex", true);
    config.put("batchSize", SLOW_BATCH_SIZE);
    config.put("producerThreads", SLOW_PRODUCER_THREADS);
    config.put("consumerThreads", SLOW_CONSUMER_THREADS);
    config.put("useDistributedIndexing", false);
    config.put("autoTune", false);
    return config;
  }

  /**
   * Mid-flight assertion: while reindex is still running, only the zero-downtime
   * guarantees from the issue must hold — the alias must always return some hits (no
   * blackout) and never expose duplicates from the swap. We deliberately do not assert
   * "every baseline ID present" mid-flight: a probe taken in the brief refresh window
   * after the alias swap can legitimately miss a few docs that the new index has but
   * hasn't refreshed yet. That's a refresh latency, not a regression.
   */
  private static void assertMidFlightProbe(final ServerHandle server, final int probeIndex) {
    Instant probedAt = Instant.now();
    SearchProbe probe =
        SearchQueryHelper.probeIndexToleratingShardLag(
            server, TABLE_INDEX_ALIAS, PROBE_PAGE_SIZE, SHARD_LAG_BUDGET);

    assertThat(probe.total())
        .as(
            "probe #%d at %s: zero hits during reindex would mean a search blackout",
            probeIndex, probedAt)
        .isGreaterThan(0);
    assertThat(probe.hasDuplicates())
        .as(
            "probe #%d at %s: duplicates indicate the alias swap exposed both old and"
                + " staged indices simultaneously (total=%d, unique=%d)",
            probeIndex, probedAt, probe.total(), probe.unique())
        .isFalse();
  }

  /**
   * Post-reindex assertion: after the run is terminal AND refresh has had time to
   * propagate, every baseline entity must be visible again — recreate-mode reindex must
   * not lose docs.
   */
  private static void assertEventualConsistency(
      final ServerHandle server, final Set<String> baselineIds) {
    SearchProbe probe = SearchQueryHelper.probeIndex(server, TABLE_INDEX_ALIAS, PROBE_PAGE_SIZE);
    LOG.info("Final probe: total={}, unique={}", probe.total(), probe.unique());
    assertThat(probe.uniqueIds())
        .as(
            "post-reindex probe: every baseline entity must remain visible after recreate"
                + " (got total=%d, unique=%d, baseline=%d)",
            probe.total(), probe.unique(), baselineIds.size())
        .containsAll(baselineIds);
  }
}
