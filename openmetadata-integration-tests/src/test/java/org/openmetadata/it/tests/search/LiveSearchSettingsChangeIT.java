package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.RelevancyFixtures;
import org.openmetadata.it.search.SearchAssertions;
import org.openmetadata.it.search.SearchQueryHelper;
import org.openmetadata.it.search.SearchSettingsTestHelper;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;

/**
 * Exercises the real Settings &gt; Search save path end to end: PUT a changed SearchSettings,
 * confirm the next {@code /v1/search/query} observes the new ranking, then reset to defaults. This
 * is the literal "change search relevancy in the UI, then search" flow, complementing the
 * inline-preview matrix in {@link SearchRelevancyPreviewIT} (which proves the bidirectional flip).
 *
 * <p>Mutates global SearchSettings → {@link Isolated}, and embedded-only: it invalidates the in-JVM
 * settings cache, whereas an external cluster would only pick the change up on its cache TTL.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class LiveSearchSettingsChangeIT {

  private static final String TABLE_INDEX = "table";
  private static final String TIER_FIELD = "tier.tagFQN";
  private static final String TIER_1 = "Tier.Tier1";
  private static final String TIER_2 = "Tier.Tier2";
  private static final double STRONG_BOOST = 1000.0;
  private static final Duration TIMEOUT = ReindexHelpers.searchPropagationTimeout();
  private static final Duration POLL = Duration.ofSeconds(3);

  private static ServerHandle server;
  private static IndexAliasInspector indices;
  private static SearchAssertions search;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    indices = new IndexAliasInspector(server);
    search = new SearchAssertions(server);
  }

  @Test
  void savingAGlobalTermBoostReordersLiveSearch(final TestNamespace ns) {
    Assumptions.assumeTrue(
        !OssTestServer.isExternalMode(), "Mutates the global SearchSettings cache — embedded only");

    final String marker = ns.uniqueShortId();
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table tier1Table = RelevancyFixtures.createTable(schema, marker + "a", marker, TIER_1);
    RelevancyFixtures.createTable(schema, marker + "b", marker, TIER_2);
    RelevancyFixtures.awaitTablesIndexed(indices, search, marker, 2, TIMEOUT);

    try {
      final SearchSettings settings =
          SearchSettingsTestHelper.copyOf(SearchSettingsTestHelper.currentSettings(server));
      SearchSettingsTestHelper.addGlobalTermBoost(settings, TIER_FIELD, TIER_1, STRONG_BOOST);
      SearchSettingsTestHelper.putSettings(server, settings);

      awaitLiveTopHit(marker, tier1Table.getId().toString());
    } finally {
      SearchSettingsTestHelper.resetSettings(server);
    }
  }

  /**
   * Polls {@code /v1/search/query} until the boosted table is the top hit. The poll rides out the
   * settings-cache refresh and any per-query response-cache TTL, so the assertion proves the saved
   * change took effect without flaking on caching.
   */
  private static void awaitLiveTopHit(final String query, final String expectedId) {
    Awaitility.await("live search ranks the boosted tier first")
        .atMost(TIMEOUT)
        .pollInterval(POLL)
        .pollDelay(Duration.ZERO)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              final List<String> ids =
                  SearchQueryHelper.probeIndex(server, TABLE_INDEX, query, 10).ids();
              assertThat(ids).as("live search for '%s' must return hits", query).isNotEmpty();
              assertThat(ids.get(0)).isEqualTo(expectedId);
            });
  }
}
