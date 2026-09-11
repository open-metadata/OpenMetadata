package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.elasticsearch.ElasticSearchColumnAggregator;
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

  @SuppressWarnings("unchecked")
  @Test
  void es_indexConfigs_pinnedCoverageAndFieldPaths() throws Exception {
    Field configsField = ElasticSearchColumnAggregator.class.getDeclaredField("INDEX_CONFIGS");
    configsField.setAccessible(true);
    Map<String, ?> configs = (Map<String, ?>) configsField.get(null);

    assertEquals(LEGACY_ES_CONFIGS.keySet(), configs.keySet());
    for (Map.Entry<String, ?> entry : configs.entrySet()) {
      List<String> expected = LEGACY_ES_CONFIGS.get(entry.getKey());
      assertEquals(expected, readIndexConfig(entry.getValue()), entry.getKey());
    }
  }

  @Test
  void os_flatIndexList_pinnedDivergence() throws Exception {
    // Pins the known ES/OS divergence: OS has no per-type field-path map today.
    // Task 15 fixes this deliberately and updates this test in its own commit.
    Field indexesField = OpenSearchColumnAggregator.class.getDeclaredField("DATA_ASSET_INDEXES");
    indexesField.setAccessible(true);
    assertEquals(LEGACY_OS_INDEXES, indexesField.get(null));
  }

  /**
   * Reads the three components off the private IndexConfig record. indexName is pinned alongside the
   * paths because it is the component whose meaning is easiest to get wrong during consolidation: it
   * holds the entity type or alias, which is resolved to a real index name later.
   */
  static List<String> readIndexConfig(Object indexConfig) throws Exception {
    return List.of(
        invokeAccessor(indexConfig, "indexName"),
        invokeAccessor(indexConfig, "columnFieldPath"),
        invokeAccessor(indexConfig, "columnNameKeyword"));
  }

  static String invokeAccessor(Object target, String accessorName) throws Exception {
    Method accessor = target.getClass().getDeclaredMethod(accessorName);
    accessor.setAccessible(true);
    return (String) accessor.invoke(target);
  }
}
