package org.openmetadata.playwright.scenarios.search.reindex;

import com.microsoft.playwright.assertions.PlaywrightAssertions;
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
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.SearchAssertions;
import org.openmetadata.it.server.ServerHandle;
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
 * Drives the SearchIndexingApplication's reindex via the Settings UI and verifies that every
 * ingested entity ends up indexed and discoverable.
 *
 * <p>Flow:
 * <ol>
 *   <li>Ingest a mixed batch of entities (tables / topics / dashboards / pipelines) via
 *       {@link EntityLoader}'s parallel SDK loader — sized by the constants below. Each name is
 *       {@code <namespace-unique-prefix>_<n>}.
 *   <li>Open {@code /settings/apps/SearchIndexingApplication} and click {@code Run Now}; block
 *       until the runs-history status badge reads {@code Success}.
 *   <li>Assert the search index holds <b>exactly</b> this run's entities — an exact
 *       {@code name.keyword} prefix count == ingested. This scopes the assertion to the run's
 *       entities, so it's correct on a shared/external cluster that already holds other data
 *       (the relevance-ranked Explore count badge fuzzy-matches the whole index and can't).
 *   <li>Spot-check the UI: search Explore for one ingested entity per kind by exact name and
 *       assert it surfaces — proving the reindexed entities are discoverable through the UI.
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

  private static final Duration REINDEX_TIMEOUT = ReindexHelpers.reindexTimeout();
  private static final String STATUS_SUCCESS = "Success";
  // After Run Now reports Success the alias has swapped, but the ES refresh on the new index can
  // lag by a refresh interval. Poll the count until it converges rather than asserting once.
  private static final Duration INDEX_COUNT_TIMEOUT = Duration.ofMinutes(2);
  private static final Duration INDEX_COUNT_POLL_INTERVAL = Duration.ofSeconds(3);

  // Entity name base for each kind — must match what EntityLoader uses internally. The base
  // doubles as the entity type used to resolve the search index.
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
    final EntityLoadSummary seeded = ingest(ns);

    final SearchIndexAppPage app = SearchIndexAppPage.open(ui);
    LOG.info("Triggering reindex via Run Now");
    app.triggerAndWaitForStatus(STATUS_SUCCESS, REINDEX_TIMEOUT);
    LOG.info("Reindex completed");

    final ServerHandle server = ui.server();
    final SearchAssertions search = new SearchAssertions(server);
    final IndexAliasInspector indices = new IndexAliasInspector(server);

    seeded
        .created()
        .forEach(
            (kind, ingestedCount) -> {
              assertExactlyIngestedAreIndexed(search, indices, ns, kind, ingestedCount);
              assertDiscoverableInExplore(ui, ns, kind);
            });
  }

  private static EntityLoadSummary ingest(final TestNamespace ns) {
    final EntityLoadSpec spec =
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

  /**
   * Exact count of this run's entities in the index ({@code name} prefix == this run's unique
   * prefix) must equal what was ingested. Precise and cluster-state-independent, unlike the
   * fuzzy Explore count badge.
   */
  private static void assertExactlyIngestedAreIndexed(
      final SearchAssertions search,
      final IndexAliasInspector indices,
      final TestNamespace ns,
      final EntityKind kind,
      final int ingested) {
    final String type = NAME_BASE_PER_KIND.get(kind);
    final String index = indices.indexNameFor(type);
    final String namePrefix = ns.prefix(type) + "_";
    LOG.info("Asserting index[{}] name-prefix count == {} for '{}'", index, ingested, namePrefix);
    Awaitility.await("index[" + index + "] count for '" + namePrefix + "' == " + ingested)
        .atMost(INDEX_COUNT_TIMEOUT)
        .pollInterval(INDEX_COUNT_POLL_INTERVAL)
        .pollDelay(Duration.ZERO)
        .ignoreNoExceptions()
        .untilAsserted(
            () -> {
              final long actual = search.countByNamePrefix(index, namePrefix);
              if (actual != ingested) {
                throw new AssertionError(
                    "index[" + index + "] expected " + ingested + " got " + actual);
              }
            });
  }

  /** One ingested entity per kind must be discoverable on Explore by its exact name. */
  private static void assertDiscoverableInExplore(
      final UiSession ui, final TestNamespace ns, final EntityKind kind) {
    final String type = NAME_BASE_PER_KIND.get(kind);
    final Tab tab = EXPLORE_TAB_PER_KIND.get(kind);
    final String firstEntityName = ns.prefix(type) + "_0";
    final ExplorePage explore = ExplorePage.openWithSearch(ui, tab, firstEntityName);
    PlaywrightAssertions.assertThat(explore.firstResultByName(firstEntityName)).isVisible();
  }
}
