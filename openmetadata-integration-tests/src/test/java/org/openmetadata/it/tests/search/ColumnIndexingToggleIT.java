package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
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
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.search.SearchQueryHelper;
import org.openmetadata.it.search.SearchSettingsTestHelper;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * Exercises the Settings &gt; Search column indexing toggle against a live engine. Turning it off
 * deletes the column index, and tables keep indexing and column searches keep answering without
 * it. Turning it back on recreates the index, and new tables get their column documents again.
 *
 * <p>Mutates the global SearchSettings and deletes a shared index, so it is {@link Isolated} and
 * lives with the other server-global search ITs in the serial search-it lane.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class ColumnIndexingToggleIT {

  private static final Duration TIMEOUT = ReindexHelpers.searchPropagationTimeout();
  private static final Duration POLL = Duration.ofSeconds(2);

  private static ServerHandle server;
  private static IndexAliasInspector indices;
  private static SearchAssertions search;
  private static SearchClient engine;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    indices = new IndexAliasInspector(server);
    search = new SearchAssertions(server);
    engine = new SearchClient(server);
  }

  @Test
  void turningColumnIndexingOffDeletesTheIndexAndTurningItOnBringsItBack(final TestNamespace ns) {
    // Another replica keeps the old setting for up to the settings-cache TTL, and a column write
    // from it in that window would recreate the index this test expects to stay deleted.
    Assumptions.assumeTrue(
        !OssTestServer.isExternalMode(), "Needs a single server to see the setting change at once");
    final String columnIndex = indices.indexNameFor(Entity.TABLE_COLUMN);
    final String columnAlias = indices.aliasFor(Entity.TABLE_COLUMN);
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    final String marker = RelevancyFixtures.uniqueToken("colidx");

    try {
      setColumnIndexing(false);
      assertThat(search.indexExists(columnIndex)).isFalse();
      assertThat(search.indexExists(columnAlias)).isFalse();

      final Table createdWhileOff = createTable(schema, marker + "off", marker);
      assertThat(search.indexExists(columnIndex))
          .as("indexing a table must not bring the column index back")
          .isFalse();
      assertThat(SearchQueryHelper.probeIndex(server, Entity.TABLE_COLUMN, 10).totalHits())
          .isZero();
      assertThat(countedEntityTypes(marker))
          .contains(Entity.TABLE)
          .doesNotContain(Entity.TABLE_COLUMN);
      assertThat(reindexStatusMessage())
          .as("the Health page must not ask for a reindex to restore a turned-off index")
          .isNotBlank()
          .doesNotContain(Entity.TABLE_COLUMN);

      setColumnIndexing(true);
      assertThat(search.indexExists(columnIndex)).isTrue();

      final Table createdWhileOn = createTable(schema, marker + "on", marker);
      Awaitility.await("column docs of " + createdWhileOn.getName())
          .atMost(TIMEOUT)
          .pollInterval(POLL)
          .ignoreExceptions()
          .untilAsserted(() -> assertThat(columnDocCount(columnIndex, createdWhileOn)).isOne());
      assertThat(columnDocCount(columnIndex, createdWhileOff)).isZero();
    } finally {
      SearchSettingsTestHelper.resetSettings(server);
    }
  }

  private static void setColumnIndexing(final boolean enabled) {
    final SearchSettings settings =
        SearchSettingsTestHelper.copyOf(SearchSettingsTestHelper.currentSettings(server));
    settings.getGlobalSettings().setEnableColumnIndexing(enabled);
    SearchSettingsTestHelper.putSettings(server, settings);
    assertThat(
            SearchSettingsTestHelper.currentSettings(server)
                .getGlobalSettings()
                .getEnableColumnIndexing())
        .isEqualTo(enabled);
  }

  private static Table createTable(
      final DatabaseSchema schema, final String name, final String marker) {
    final Table table = RelevancyFixtures.createTable(schema, name, marker, null);
    RelevancyFixtures.awaitTablesIndexed(indices, search, name, 1, TIMEOUT);
    return table;
  }

  private static long columnDocCount(final String columnIndex, final Table table) {
    final String query = "{\"query\":{\"term\":{\"table.id\":\"" + table.getId() + "\"}}}";
    return engine.count(columnIndex, query).path("count").asLong();
  }

  /** The message of the "Search Reindex Status" step that the Health page shows. */
  private static String reindexStatusMessage() {
    final JsonNode status =
        JsonUtils.readTree(
            server
                .sdk()
                .getHttpClient()
                .executeForString(HttpMethod.GET, "/v1/system/status", null));
    return status.path("Search Reindex Status").path("message").asText();
  }

  /** The entity types the Explore tab counts report for {@code query}, across both indexes. */
  private static List<String> countedEntityTypes(final String query) {
    final String path =
        "/v1/search/entityTypeCounts?q="
            + URLEncoder.encode(query, StandardCharsets.UTF_8)
            + "&index="
            + URLEncoder.encode(Entity.TABLE + "," + Entity.TABLE_COLUMN, StandardCharsets.UTF_8);
    final JsonNode response =
        JsonUtils.readTree(
            server.sdk().getHttpClient().executeForString(HttpMethod.GET, path, null));
    final List<String> types = new ArrayList<>();
    response
        .at("/aggregations/entityType/buckets")
        .forEach(bucket -> types.add(bucket.path("key").asText()));
    return types;
  }
}
