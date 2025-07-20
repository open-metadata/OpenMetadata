package org.openmetadata.search;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class IndexMappingTest {

  @Test
  void testGetIndexNameWithClusterAlias() {
    IndexMapping indexMapping = IndexMapping.builder().indexName("table_search_index").build();

    assertEquals("openmetadata_table_search_index", indexMapping.getIndexName("openmetadata"));
    assertEquals("table_search_index", indexMapping.getIndexName(""));
    assertEquals("table_search_index", indexMapping.getIndexName(null));
    assertEquals("prod_table_search_index", indexMapping.getIndexName("prod"));
  }

  @Test
  void testGetAliasWithClusterAlias() {
    IndexMapping indexMapping =
        IndexMapping.builder().indexName("table_search_index").alias("table").build();

    assertEquals("openmetadata_table", indexMapping.getAlias("openmetadata"));
    assertEquals("table", indexMapping.getAlias(""));
    assertEquals("table", indexMapping.getAlias(null));
    assertEquals("staging_table", indexMapping.getAlias("staging"));
  }

  @Test
  void testGetParentAliasesWithClusterAlias() {
    List<String> parentAliases = Arrays.asList("dataAsset", "entity");
    IndexMapping indexMapping =
        IndexMapping.builder().indexName("table_search_index").parentAliases(parentAliases).build();

    List<String> result = indexMapping.getParentAliases("openmetadata");
    assertEquals(2, result.size());
    assertTrue(result.contains("openmetadata_dataAsset"));
    assertTrue(result.contains("openmetadata_entity"));
    assertEquals(parentAliases, indexMapping.getParentAliases(""));
    assertEquals(parentAliases, indexMapping.getParentAliases(null));

    List<String> prodResult = indexMapping.getParentAliases("prod");
    assertEquals(2, prodResult.size());
    assertTrue(prodResult.contains("prod_dataAsset"));
    assertTrue(prodResult.contains("prod_entity"));
  }

  @Test
  void testGetChildAliasesWithClusterAlias() {
    List<String> childAliases = Arrays.asList("table_v1", "table_v2");
    IndexMapping indexMapping =
        IndexMapping.builder().indexName("table_search_index").childAliases(childAliases).build();

    List<String> result = indexMapping.getChildAliases("openmetadata");
    assertEquals(2, result.size());
    assertTrue(result.contains("openmetadata_table_v1"));
    assertTrue(result.contains("openmetadata_table_v2"));
    assertEquals(childAliases, indexMapping.getChildAliases(""));
    assertEquals(childAliases, indexMapping.getChildAliases(null));
    List<String> devResult = indexMapping.getChildAliases("dev");
    assertEquals(2, devResult.size());
    assertTrue(devResult.contains("dev_table_v1"));
    assertTrue(devResult.contains("dev_table_v2"));
  }

  @Test
  void testGetIndexMappingFile() {
    IndexMapping indexMapping =
        IndexMapping.builder()
            .indexName("table_search_index")
            .indexMappingFile("/elasticsearch/%s/table_index_mapping.json")
            .build();

    // Test with language parameter
    assertEquals(
        "elasticsearch/en/table_index_mapping.json", indexMapping.getIndexMappingFile("en"));
    assertEquals(
        "elasticsearch/jp/table_index_mapping.json", indexMapping.getIndexMappingFile("jp"));
    assertEquals(
        "elasticsearch/zh/table_index_mapping.json", indexMapping.getIndexMappingFile("zh"));
  }

  @Test
  void testIndexNameSeparatorConstant() {
    assertEquals("_", IndexMapping.INDEX_NAME_SEPARATOR);
  }

  @Test
  void testCompleteIndexMappingWithAllFields() {
    IndexMapping indexMapping =
        IndexMapping.builder()
            .indexName("dashboard_search_index")
            .alias("dashboard")
            .parentAliases(Arrays.asList("dataAsset", "asset"))
            .childAliases(Arrays.asList("dashboard_v1", "dashboard_v2"))
            .indexMappingFile("/elasticsearch/%s/dashboard_index_mapping.json")
            .build();

    String clusterAlias = "qa_env";

    assertEquals("qa_env_dashboard_search_index", indexMapping.getIndexName(clusterAlias));
    assertEquals("qa_env_dashboard", indexMapping.getAlias(clusterAlias));

    List<String> parentAliases = indexMapping.getParentAliases(clusterAlias);
    assertEquals(2, parentAliases.size());
    assertTrue(parentAliases.contains("qa_env_dataAsset"));
    assertTrue(parentAliases.contains("qa_env_asset"));

    List<String> childAliases = indexMapping.getChildAliases(clusterAlias);
    assertEquals(2, childAliases.size());
    assertTrue(childAliases.contains("qa_env_dashboard_v1"));
    assertTrue(childAliases.contains("qa_env_dashboard_v2"));

    assertEquals(
        "elasticsearch/en/dashboard_index_mapping.json", indexMapping.getIndexMappingFile("en"));
  }

  @Test
  void testEdgeCases() {
    IndexMapping indexMapping =
        IndexMapping.builder().indexName("test_index").alias("test").build();

    String longClusterAlias = "very_long_cluster_alias_name_that_exceeds_normal_length";
    assertEquals(longClusterAlias + "_test_index", indexMapping.getIndexName(longClusterAlias));

    String specialClusterAlias = "cluster-alias.with-dots";
    assertEquals(
        specialClusterAlias + "_test_index", indexMapping.getIndexName(specialClusterAlias));
  }

  @Test
  void testNullSafetyForLists() {
    IndexMapping indexMapping =
        IndexMapping.builder()
            .indexName("test_index")
            .parentAliases(null)
            .childAliases(null)
            .build();

    assertThrows(NullPointerException.class, () -> indexMapping.getParentAliases("cluster"));
    assertThrows(NullPointerException.class, () -> indexMapping.getChildAliases("cluster"));
  }
}
