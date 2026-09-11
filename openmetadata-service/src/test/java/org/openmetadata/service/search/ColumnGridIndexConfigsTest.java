package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.opensearch.OpenSearchColumnAggregator;

/**
 * Pins the grid aggregators' coverage sets before consolidation. The Elasticsearch side carries a
 * per-type index config; the OpenSearch side carries only a flat list of types and has no field-path
 * map at all. That divergence is real and is pinned here so Task 15 fixing it shows up as a diff.
 */
class ColumnGridIndexConfigsTest {

  /** entityType to (indexName, columnFieldPath, columnNameKeyword), exactly as shipped today. */
  static final Map<String, List<String>> LEGACY_ES_CONFIGS =
      Map.of(
          "table",
          List.of("table", "columns", "columns.name.keyword"),
          "dashboardDataModel",
          List.of("dashboardDataModel", "columns", "columns.name.keyword"),
          "topic",
          List.of("topic", "messageSchema.schemaFields", "messageSchema.schemaFields.name.keyword"),
          "searchIndex",
          List.of("searchIndex", "fields", "fields.name.keyword"),
          "container",
          List.of("container", "dataModel.columns", "dataModel.columns.name.keyword"));

  static final List<String> LEGACY_OS_INDEXES =
      List.of("table", "dashboardDataModel", "topic", "searchIndex", "container");

  @Test
  void load_admitsExactlyTheseTypes_threeOfThemNewToTheGrid() {
    // Replaces the reflection pin that asserted the ES aggregator's five hardcoded types. Deriving
    // the configs from the registry admits three types the grid never served before: pipeline,
    // mlmodel and worksheet. That is the intended coverage extension, but it must be stated rather
    // than inherited, so a future registry addition cannot silently appear on a public endpoint.
    assertEquals(
        Set.of(
            "table",
            "dashboardDataModel",
            "topic",
            "searchIndex",
            "container",
            "pipeline",
            "mlmodel",
            "worksheet"),
        ColumnGridIndexConfigs.load().keySet());
  }

  @Test
  void load_preservesLegacyEsConfigsExactly() {
    Map<String, ColumnGridIndexConfigs.IndexConfig> configs = ColumnGridIndexConfigs.load();
    for (Map.Entry<String, List<String>> legacy : LEGACY_ES_CONFIGS.entrySet()) {
      ColumnGridIndexConfigs.IndexConfig config = configs.get(legacy.getKey());
      assertNotNull(config, legacy.getKey());
      // All three components. indexName is the one easiest to get wrong and the one with no other
      // pin: in the legacy map it holds the ENTITY TYPE / alias name, not a physical index name,
      // and the aggregator resolves it to a real index at query time. The registry-derived build
      // must keep that contract, so indexName equals the map key.
      assertEquals(legacy.getKey(), config.indexName(), legacy.getKey());
      assertEquals(legacy.getValue().get(1), config.columnFieldPath(), legacy.getKey());
      assertEquals(legacy.getValue().get(2), config.columnNameKeyword(), legacy.getKey());
    }
  }

  @Test
  void load_excludedTypesAreAbsentAndDocumented() {
    Map<String, ColumnGridIndexConfigs.IndexConfig> configs = ColumnGridIndexConfigs.load();
    for (String excluded : ColumnGridIndexConfigs.GRID_EXCLUDED_TYPES) {
      assertFalse(configs.containsKey(excluded), excluded);
    }
  }

  @Test
  void resolveEntityTypes_defaultsToTableWhenEmpty() {
    assertEquals(List.of("table"), ColumnGridIndexConfigs.resolveEntityTypes(null));
    assertEquals(List.of("table"), ColumnGridIndexConfigs.resolveEntityTypes(List.of()));
  }

  @Test
  void resolveEntityTypes_unknownTypeThrowsInsteadOfSilentDrop() {
    // The old getEntityTypesForRequest dropped unknown types and quietly fell back to table, so a
    // typo returned table rows and looked like a working query. Now it is an error.
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () -> ColumnGridIndexConfigs.resolveEntityTypes(List.of("table", "glossary")));
    assertTrue(error.getMessage().contains("glossary"));
  }

  @Test
  void os_flatIndexList_pinnedDivergence() throws Exception {
    // Pins the known ES/OS divergence: OS has no per-type field-path map today.
    // Task 15 fixes this deliberately and updates this test in its own commit.
    Field indexesField = OpenSearchColumnAggregator.class.getDeclaredField("DATA_ASSET_INDEXES");
    indexesField.setAccessible(true);
    assertEquals(LEGACY_OS_INDEXES, indexesField.get(null));
  }
}
