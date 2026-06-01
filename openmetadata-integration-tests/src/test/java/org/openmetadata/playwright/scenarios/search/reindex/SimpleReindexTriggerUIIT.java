package org.openmetadata.playwright.scenarios.search.reindex;

import java.time.Duration;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.EntityLoadSpec;
import org.openmetadata.it.factories.EntityLoadSpec.EntityKind;
import org.openmetadata.it.factories.EntityLoadSummary;
import org.openmetadata.it.factories.EntityLoader;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.playwright.ui.UiSession;
import org.openmetadata.playwright.ui.UiSessionExtension;
import org.openmetadata.playwright.ui.pages.ExplorePage;
import org.openmetadata.playwright.ui.pages.ExplorePage.Tab;
import org.openmetadata.playwright.ui.pages.SearchIndexAppPage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Drives the SearchIndexingApplication's reindex via the Settings UI and verifies, through
 * the Explore page, that every ingested entity ends up indexed and discoverable.
 *
 * <p>Flow:
 * <ol>
 *   <li>Pre-ingest a mixed batch of entities (tables / topics / dashboards / pipelines)
 *       via {@link EntityLoader}'s parallel SDK loader — sized by the constants below.
 *   <li>Open {@code /settings/apps/SearchIndexingApplication} and click {@code Run Now}.
 *   <li>Block until the runs-history table's status badge transitions to {@code Success}
 *       (server pushes status over WebSocket; Playwright observes the DOM mutation).
 *   <li>For each Explore tab, search for the namespace-unique base prefix and assert the
 *       count badge matches what the loader actually created — proves every ingested
 *       entity is searchable post-reindex.
 * </ol>
 *
 * <p>Tagged {@link ResourceLock} on {@code SEARCH_INDEX_APP} so any future test that also
 * touches the global search-index app serializes against this one.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class SimpleReindexTriggerUIIT {

  private static final Logger LOG = LoggerFactory.getLogger(SimpleReindexTriggerUIIT.class);

  // Scale knobs — defaults are PR-friendly. Override via system properties
  // (-Djpw.simpleReindex.tables=5000 ...) for nightly stress runs.
  private static final int TABLES = Integer.getInteger("jpw.simpleReindex.tables", 200);
  private static final int TOPICS = Integer.getInteger("jpw.simpleReindex.topics", 100);
  private static final int DASHBOARDS = Integer.getInteger("jpw.simpleReindex.dashboards", 100);
  private static final int PIPELINES = Integer.getInteger("jpw.simpleReindex.pipelines", 100);
  private static final int COLUMNS_PER_TABLE = Integer.getInteger("jpw.simpleReindex.cols", 5);
  private static final int PARALLEL_WORKERS = Integer.getInteger("jpw.simpleReindex.workers", 16);

  private static final Duration REINDEX_TIMEOUT = Duration.ofMinutes(10);
  private static final String STATUS_SUCCESS = "Success";
  // After Run Now reports Success the alias has swapped, but ES refresh on the new index
  // can lag by a refresh interval (default 1s) plus aggregation cache TTL. We re-issue
  // the search aggregation on each retry rather than relying on DOM polling alone.
  private static final Duration EXPLORE_COUNT_TIMEOUT = Duration.ofMinutes(2);
  private static final Duration EXPLORE_COUNT_POLL_INTERVAL = Duration.ofSeconds(3);

  // Entity name base for each kind — must match what EntityLoader uses internally.
  private static final Map<EntityKind, String> NAME_BASE_PER_KIND =
      Map.of(
          EntityKind.TABLE, "table",
          EntityKind.TOPIC, "topic",
          EntityKind.DASHBOARD, "dashboard",
          EntityKind.PIPELINE, "pipeline");

  private static final Map<EntityKind, Tab> EXPLORE_TAB_PER_KIND =
      Map.of(
          EntityKind.TABLE, Tab.TABLES,
          EntityKind.TOPIC, Tab.TOPICS,
          EntityKind.DASHBOARD, Tab.DASHBOARDS,
          EntityKind.PIPELINE, Tab.PIPELINES);

  @Test
  void reindexTriggerFromUiMakesIngestedEntitiesDiscoverable(
      final UiSession ui, final TestNamespace ns) {
    EntityLoadSummary seeded = ingest(ns);

    SearchIndexAppPage app = SearchIndexAppPage.open(ui);
    LOG.info("Triggering reindex via Run Now");
    app.triggerAndWaitForStatus(STATUS_SUCCESS, REINDEX_TIMEOUT);
    LOG.info("Reindex completed");

    seeded
        .created()
        .forEach((kind, expectedCount) -> assertExploreCount(ui, ns, kind, expectedCount));
  }

  private static EntityLoadSummary ingest(final TestNamespace ns) {
    EntityLoadSpec spec =
        EntityLoadSpec.builder()
            .parallelWorkers(PARALLEL_WORKERS)
            .columnsPerTable(COLUMNS_PER_TABLE)
            .count(EntityKind.TABLE, TABLES)
            .count(EntityKind.TOPIC, TOPICS)
            .count(EntityKind.DASHBOARD, DASHBOARDS)
            .count(EntityKind.PIPELINE, PIPELINES)
            .build();
    return EntityLoader.load(spec, ns);
  }

  private static void assertExploreCount(
      final UiSession ui, final TestNamespace ns, final EntityKind kind, final int expected) {
    final String namePrefix = ns.prefix(NAME_BASE_PER_KIND.get(kind));
    final Tab tab = EXPLORE_TAB_PER_KIND.get(kind);
    LOG.info("Asserting Explore[{}] count == {} for prefix '{}'", tab, expected, namePrefix);

    // Re-open Explore on each tick to re-issue the search aggregation against the (now
    // possibly more refreshed) new index. DOM-only polling can wedge against a stale
    // aggregation cache and never converge.
    Awaitility.await(
            "Explore[" + tab + "] count == " + expected + " for prefix '" + namePrefix + "'")
        .atMost(EXPLORE_COUNT_TIMEOUT)
        .pollInterval(EXPLORE_COUNT_POLL_INTERVAL)
        .pollDelay(Duration.ZERO)
        .ignoreNoExceptions()
        .untilAsserted(
            () -> {
              final ExplorePage explore = ExplorePage.openWithSearch(ui, tab, namePrefix);
              if (explore.countForTab(tab) != expected) {
                throw new AssertionError(
                    "Explore["
                        + tab
                        + "] expected "
                        + expected
                        + " got "
                        + explore.countForTab(tab));
              }
            });
  }
}
