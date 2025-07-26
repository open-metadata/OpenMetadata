package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

class BulkSinkTest {

  @Test
  void testElasticSearchBulkSinkWithClusterAlias() throws Exception {
    // Test that ElasticSearchBulkSink properly uses cluster alias when indexing
    String clusterAlias = "prod_cluster";
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.getClusterAlias()).thenReturn(clusterAlias);

    // Mock index mapping
    IndexMapping tableMapping =
        IndexMapping.builder().indexName("table_search_index").alias("table").build();
    when(searchRepository.getIndexMapping(Entity.TABLE)).thenReturn(tableMapping);

    // Create a concrete implementation of BulkSink for testing
    TestBulkSink bulkSink = new TestBulkSink(searchRepository);

    // Create test entity
    Table mockTable = mock(Table.class);
    when(mockTable.getId()).thenReturn(UUID.randomUUID());
    when(mockTable.getFullyQualifiedName()).thenReturn("test.schema.table");

    // Create context data
    Map<String, Object> contextData = new HashMap<>();
    contextData.put("entityType", Entity.TABLE);

    // Write entities - should use cluster alias
    bulkSink.write(List.of(mockTable), contextData);

    // Verify the correct index name was used
    String expectedIndexName = clusterAlias + "_table_search_index";
    assertEquals(expectedIndexName, tableMapping.getIndexName(clusterAlias));
    assertEquals(expectedIndexName, bulkSink.getLastUsedIndexName());
  }

  @Test
  void testBulkSinkWithNullIndexMapping() throws Exception {
    // Test that BulkSink gracefully handles null index mapping
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.getIndexMapping("unknown")).thenReturn(null);

    TestBulkSink bulkSink = new TestBulkSink(searchRepository);

    EntityInterface mockEntity = mock(EntityInterface.class);
    when(mockEntity.getId()).thenReturn(UUID.randomUUID());

    Map<String, Object> contextData = new HashMap<>();
    contextData.put("entityType", "unknown");

    // Should not throw exception - should skip gracefully
    assertDoesNotThrow(() -> bulkSink.write(List.of(mockEntity), contextData));

    // Verify no indexing was attempted
    assertEquals(null, bulkSink.getLastUsedIndexName());
  }

  @Test
  void testBulkSinkWithEmptyClusterAlias() throws Exception {
    // Test behavior with empty cluster alias
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.getClusterAlias()).thenReturn("");

    IndexMapping tableMapping = IndexMapping.builder().indexName("table_search_index").build();
    when(searchRepository.getIndexMapping(Entity.TABLE)).thenReturn(tableMapping);

    TestBulkSink bulkSink = new TestBulkSink(searchRepository);

    Table mockTable = mock(Table.class);
    when(mockTable.getId()).thenReturn(UUID.randomUUID());

    Map<String, Object> contextData = new HashMap<>();
    contextData.put("entityType", Entity.TABLE);

    bulkSink.write(List.of(mockTable), contextData);

    // Verify no prefix was added
    assertEquals("table_search_index", bulkSink.getLastUsedIndexName());
  }

  @Test
  void testBulkSinkWithNullClusterAlias() throws Exception {
    // Test behavior with null cluster alias
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.getClusterAlias()).thenReturn(null);

    IndexMapping tableMapping = IndexMapping.builder().indexName("table_search_index").build();
    when(searchRepository.getIndexMapping(Entity.TABLE)).thenReturn(tableMapping);

    TestBulkSink bulkSink = new TestBulkSink(searchRepository);

    Table mockTable = mock(Table.class);
    when(mockTable.getId()).thenReturn(UUID.randomUUID());

    Map<String, Object> contextData = new HashMap<>();
    contextData.put("entityType", Entity.TABLE);

    bulkSink.write(List.of(mockTable), contextData);

    // Verify no prefix was added
    assertEquals("table_search_index", bulkSink.getLastUsedIndexName());
  }

  @Test
  void testBulkSinkWithMissingEntityType() {
    // Test that missing entity type in context data throws exception
    SearchRepository searchRepository = mock(SearchRepository.class);
    TestBulkSink bulkSink = new TestBulkSink(searchRepository);

    EntityInterface mockEntity = mock(EntityInterface.class);
    when(mockEntity.getId()).thenReturn(UUID.randomUUID());

    Map<String, Object> contextData = new HashMap<>();
    // entityType is missing

    assertThrows(
        IllegalArgumentException.class,
        () -> bulkSink.write(List.of(mockEntity), contextData),
        "Entity type is required in context data");
  }

  @Test
  void testMultipleEntitiesWithClusterAlias() throws Exception {
    // Test indexing multiple entities with cluster alias
    String clusterAlias = "qa_env";
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.getClusterAlias()).thenReturn(clusterAlias);

    IndexMapping tableMapping =
        IndexMapping.builder()
            .indexName("table_search_index")
            .alias("table")
            .parentAliases(List.of("dataAsset", "entity"))
            .build();
    when(searchRepository.getIndexMapping(Entity.TABLE)).thenReturn(tableMapping);

    TestBulkSink bulkSink = new TestBulkSink(searchRepository);

    // Create multiple test entities
    Table mockTable1 = mock(Table.class);
    when(mockTable1.getId()).thenReturn(UUID.randomUUID());
    when(mockTable1.getFullyQualifiedName()).thenReturn("test.schema.table1");

    Table mockTable2 = mock(Table.class);
    when(mockTable2.getId()).thenReturn(UUID.randomUUID());
    when(mockTable2.getFullyQualifiedName()).thenReturn("test.schema.table2");

    Table mockTable3 = mock(Table.class);
    when(mockTable3.getId()).thenReturn(UUID.randomUUID());
    when(mockTable3.getFullyQualifiedName()).thenReturn("test.schema.table3");

    Map<String, Object> contextData = new HashMap<>();
    contextData.put("entityType", Entity.TABLE);

    bulkSink.write(List.of(mockTable1, mockTable2, mockTable3), contextData);

    // Verify correct index name and parent aliases
    String expectedIndexName = clusterAlias + "_table_search_index";
    assertEquals(expectedIndexName, bulkSink.getLastUsedIndexName());

    List<String> expectedParentAliases = tableMapping.getParentAliases(clusterAlias);
    assertEquals(2, expectedParentAliases.size());
    assertEquals("qa_env_dataAsset", expectedParentAliases.get(0));
    assertEquals("qa_env_entity", expectedParentAliases.get(1));
  }

  // Test implementation of BulkSink for testing purposes
  private class TestBulkSink implements BulkSink {
    private String lastUsedIndexName;
    private final SearchRepository repository;
    private int successCount = 0;
    private int failedCount = 0;

    public TestBulkSink(SearchRepository searchRepository) {
      this.repository = searchRepository;
    }

    @Override
    public void write(List<?> entities, Map<String, Object> contextData) throws Exception {
      if (entities == null || entities.isEmpty()) {
        return;
      }

      String entityType = (String) contextData.get("entityType");
      if (entityType == null) {
        throw new IllegalArgumentException("Entity type is required in context data");
      }

      IndexMapping indexMapping = repository.getIndexMapping(entityType);
      if (indexMapping == null) {
        // Skip indexing if no mapping found
        return;
      }

      lastUsedIndexName = indexMapping.getIndexName(repository.getClusterAlias());
    }

    @Override
    public void updateStats(int currentSuccess, int currentFailed) {
      this.successCount += currentSuccess;
      this.failedCount += currentFailed;
    }

    @Override
    public org.openmetadata.schema.system.StepStats getStats() {
      return new org.openmetadata.schema.system.StepStats()
          .withSuccessRecords(successCount)
          .withFailedRecords(failedCount);
    }

    @Override
    public void close() {
      // No-op for test
    }

    public String getLastUsedIndexName() {
      return lastUsedIndexName;
    }
  }
}
