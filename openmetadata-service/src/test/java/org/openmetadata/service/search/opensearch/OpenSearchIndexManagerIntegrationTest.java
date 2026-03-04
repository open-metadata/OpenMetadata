package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.apache.hc.core5.http.HttpHost;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.OpenMetadataApplicationTest;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.indices.GetAliasRequest;
import os.org.opensearch.client.opensearch.indices.GetAliasResponse;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5Transport;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5TransportBuilder;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class OpenSearchIndexManagerIntegrationTest extends OpenMetadataApplicationTest {

  private OpenSearchIndexManager indexManager;
  private OpenSearchClient client;
  private String testIndexPrefix;
  private IndexMapping testIndexMapping;

  private static final String TEST_CLUSTER_ALIAS = "test_cluster";
  private static final String SAMPLE_MAPPING_JSON =
      """
      {
        "settings": {
          "number_of_shards": 1,
          "number_of_replicas": 0
        },
        "mappings": {
          "properties": {
            "id": {
              "type": "keyword"
            },
            "name": {
              "type": "text",
              "analyzer": "standard"
            },
            "description": {
              "type": "text"
            },
            "tags": {
              "type": "keyword"
            },
            "created_at": {
              "type": "date"
            }
          }
        }
      }
      """;

  private static final String UPDATED_MAPPING_JSON =
      """
      {
        "properties": {
          "id": {
            "type": "keyword"
          },
          "name": {
            "type": "text",
            "analyzer": "standard"
          },
          "description": {
            "type": "text"
          },
          "tags": {
            "type": "keyword"
          },
          "created_at": {
            "type": "date"
          },
          "updated_at": {
            "type": "date"
          },
          "category": {
            "type": "keyword"
          }
        }
      }
      """;

  @BeforeEach
  void setUp() {
    // Create unique test index prefix to avoid conflicts
    testIndexPrefix =
        "test_idx_"
            + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss_SSS"));

    // Create OpenSearch client from the test container (using ES container for compatibility)
    client = createOpenSearchClient();

    // Create IndexManager instance
    indexManager = new OpenSearchIndexManager(client, TEST_CLUSTER_ALIAS);

    // Create test index mapping
    testIndexMapping = createTestIndexMapping(testIndexPrefix);

    LOG.info("Test setup completed with index prefix: {}", testIndexPrefix);
  }

  @AfterEach
  void tearDown() {
    // Clean up test indices
    if (indexManager != null && testIndexMapping != null) {
      try {
        String indexName = testIndexMapping.getIndexName(TEST_CLUSTER_ALIAS);
        if (indexManager.indexExists(indexName)) {
          indexManager.deleteIndex(testIndexMapping);
          LOG.info("Cleaned up test index: {}", indexName);
        }
      } catch (Exception e) {
        LOG.warn("Failed to clean up test index", e);
      }
    }
  }

  private OpenSearchClient createOpenSearchClient() {
    try {
      org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration
          searchConfig = getSearchConfig();
      HttpHost host =
          new HttpHost(searchConfig.getScheme(), searchConfig.getHost(), searchConfig.getPort());

      ApacheHttpClient5Transport transport =
          ApacheHttpClient5TransportBuilder.builder(host)
              .setMapper(new JacksonJsonpMapper())
              .build();
      return new OpenSearchClient(transport);
    } catch (Exception e) {
      LOG.error("Failed to create OpenSearch client", e);
      throw new RuntimeException("Failed to create OpenSearch client", e);
    }
  }

  @Test
  void testIndexExists_NonExistentIndex() {
    String nonExistentIndex = testIndexPrefix + "_nonexistent";
    boolean exists = indexManager.indexExists(nonExistentIndex);
    assertFalse(exists, "Non-existent index should return false");
  }

  @Test
  void testCreateIndex_WithValidMapping() {
    String indexName = testIndexMapping.getIndexName(TEST_CLUSTER_ALIAS);

    // Verify index doesn't exist initially
    assertFalse(indexManager.indexExists(indexName), "Index should not exist initially");

    // Create index
    assertDoesNotThrow(
        () -> {
          indexManager.createIndex(testIndexMapping, SAMPLE_MAPPING_JSON);
        },
        "Index creation should not throw exception");

    // Verify index exists after creation
    assertTrue(indexManager.indexExists(indexName), "Index should exist after creation");
  }

  @Test
  void testCreateIndex_WithNullMapping() {
    IndexMapping nullMappingIndex = createTestIndexMapping(testIndexPrefix + "_null");
    String indexName = nullMappingIndex.getIndexName(TEST_CLUSTER_ALIAS);

    // Create index with null mapping
    assertDoesNotThrow(
        () -> {
          indexManager.createIndex(nullMappingIndex, null);
        },
        "Index creation with null mapping should not throw exception");

    // Verify index exists
    assertTrue(
        indexManager.indexExists(indexName), "Index should exist after creation with null mapping");

    // Clean up
    indexManager.deleteIndex(nullMappingIndex);
  }

  @Test
  void testCreateIndex_WithEmptyMapping() {
    IndexMapping emptyMappingIndex = createTestIndexMapping(testIndexPrefix + "_empty");
    String indexName = emptyMappingIndex.getIndexName(TEST_CLUSTER_ALIAS);

    // Create index with empty mapping
    assertDoesNotThrow(
        () -> {
          indexManager.createIndex(emptyMappingIndex, "");
        },
        "Index creation with empty mapping should not throw exception");

    // Verify index exists
    assertTrue(
        indexManager.indexExists(indexName),
        "Index should exist after creation with empty mapping");

    // Clean up
    indexManager.deleteIndex(emptyMappingIndex);
  }

  @Test
  void testUpdateIndex_ExistingIndex() {
    String indexName = testIndexMapping.getIndexName(TEST_CLUSTER_ALIAS);

    // Create index first
    indexManager.createIndex(testIndexMapping, SAMPLE_MAPPING_JSON);
    assertTrue(indexManager.indexExists(indexName), "Index should exist after creation");

    // Update index mapping
    assertDoesNotThrow(
        () -> {
          indexManager.updateIndex(testIndexMapping, UPDATED_MAPPING_JSON);
        },
        "Index update should not throw exception");

    // Index should still exist
    assertTrue(indexManager.indexExists(indexName), "Index should still exist after update");
  }

  @Test
  void testUpdateIndex_NonExistentIndex() {
    IndexMapping nonExistentMapping = createTestIndexMapping(testIndexPrefix + "_nonexistent");

    // Attempt to update non-existent index (should not throw exception)
    assertDoesNotThrow(
        () -> {
          indexManager.updateIndex(nonExistentMapping, UPDATED_MAPPING_JSON);
        },
        "Updating non-existent index should not throw exception");
  }

  @Test
  void testUpdateIndex_WithNullMapping() {
    String indexName = testIndexMapping.getIndexName(TEST_CLUSTER_ALIAS);

    // Create index first
    indexManager.createIndex(testIndexMapping, SAMPLE_MAPPING_JSON);
    assertTrue(indexManager.indexExists(indexName), "Index should exist after creation");

    // Update with null mapping
    assertDoesNotThrow(
        () -> {
          indexManager.updateIndex(testIndexMapping, null);
        },
        "Index update with null mapping should not throw exception");

    // Index should still exist
    assertTrue(
        indexManager.indexExists(indexName),
        "Index should still exist after update with null mapping");
  }

  @Test
  void testDeleteIndex_ExistingIndex() {
    String indexName = testIndexMapping.getIndexName(TEST_CLUSTER_ALIAS);

    // Create index first
    indexManager.createIndex(testIndexMapping, SAMPLE_MAPPING_JSON);
    assertTrue(indexManager.indexExists(indexName), "Index should exist after creation");

    // Delete index
    assertDoesNotThrow(
        () -> {
          indexManager.deleteIndex(testIndexMapping);
        },
        "Index deletion should not throw exception");

    // Verify index no longer exists
    assertFalse(indexManager.indexExists(indexName), "Index should not exist after deletion");
  }

  @Test
  void testDeleteIndex_NonExistentIndex() {
    IndexMapping nonExistentMapping = createTestIndexMapping(testIndexPrefix + "_nonexistent");

    // Attempt to delete non-existent index (should not throw exception)
    assertDoesNotThrow(
        () -> {
          indexManager.deleteIndex(nonExistentMapping);
        },
        "Deleting non-existent index should not throw exception");
  }

  @Test
  void testCreateAliases_WithParentAliases() throws Exception {
    String indexName = testIndexMapping.getIndexName(TEST_CLUSTER_ALIAS);
    String mainAlias = testIndexMapping.getAlias(TEST_CLUSTER_ALIAS);
    List<String> parentAliases = testIndexMapping.getParentAliases(TEST_CLUSTER_ALIAS);

    // Create index (this should also create aliases)
    indexManager.createIndex(testIndexMapping, SAMPLE_MAPPING_JSON);
    assertTrue(indexManager.indexExists(indexName), "Index should exist after creation");

    // Verify aliases exist
    GetAliasRequest getAliasRequest = GetAliasRequest.of(b -> b.index(indexName));
    GetAliasResponse aliasResponse = client.indices().getAlias(getAliasRequest);

    assertNotNull(aliasResponse.result(), "Alias response should not be null");
    assertTrue(aliasResponse.result().containsKey(indexName), "Index should have aliases");

    Set<String> aliases = aliasResponse.result().get(indexName).aliases().keySet();
    assertTrue(aliases.contains(mainAlias), "Main alias should exist");

    for (String parentAlias : parentAliases) {
      assertTrue(aliases.contains(parentAlias), "Parent alias should exist: " + parentAlias);
    }
  }

  @Test
  void testCreateAliases_WithNullMainAlias() {
    IndexMapping nullAliasMapping =
        IndexMapping.builder()
            .indexName(testIndexPrefix + "_nullalias_index")
            .alias(null)
            .parentAliases(List.of(testIndexPrefix + "_nullalias_parent1"))
            .indexMappingFile("test_mapping_%s.json")
            .build();

    String indexName = nullAliasMapping.getIndexName(TEST_CLUSTER_ALIAS);

    // Create index with null main alias (should still create parent aliases)
    assertDoesNotThrow(
        () -> {
          indexManager.createIndex(nullAliasMapping, SAMPLE_MAPPING_JSON);
        },
        "Index creation with null alias should not throw exception");

    assertTrue(indexManager.indexExists(indexName), "Index should exist after creation");

    // Clean up
    indexManager.deleteIndex(nullAliasMapping);
  }

  @Test
  void testAddIndexAlias_SingleAlias() throws Exception {
    String indexName = testIndexMapping.getIndexName(TEST_CLUSTER_ALIAS);
    String additionalAlias = testIndexPrefix + "_additional_alias";

    // Create index first
    indexManager.createIndex(testIndexMapping, SAMPLE_MAPPING_JSON);
    assertTrue(indexManager.indexExists(indexName), "Index should exist after creation");

    // Add additional alias
    assertDoesNotThrow(
        () -> {
          indexManager.addIndexAlias(testIndexMapping, additionalAlias);
        },
        "Adding alias should not throw exception");

    // Verify additional alias exists
    GetAliasRequest getAliasRequest = GetAliasRequest.of(b -> b.index(indexName));
    GetAliasResponse aliasResponse = client.indices().getAlias(getAliasRequest);

    Set<String> aliases = aliasResponse.result().get(indexName).aliases().keySet();
    assertTrue(aliases.contains(additionalAlias), "Additional alias should exist");
  }

  @Test
  void testAddIndexAlias_MultipleAliases() throws Exception {
    String indexName = testIndexMapping.getIndexName(TEST_CLUSTER_ALIAS);
    String alias1 = testIndexPrefix + "_alias1";
    String alias2 = testIndexPrefix + "_alias2";
    String alias3 = testIndexPrefix + "_alias3";

    // Create index first
    indexManager.createIndex(testIndexMapping, SAMPLE_MAPPING_JSON);
    assertTrue(indexManager.indexExists(indexName), "Index should exist after creation");

    // Add multiple aliases
    assertDoesNotThrow(
        () -> {
          indexManager.addIndexAlias(testIndexMapping, alias1, alias2, alias3);
        },
        "Adding multiple aliases should not throw exception");

    // Verify all aliases exist
    GetAliasRequest getAliasRequest = GetAliasRequest.of(b -> b.index(indexName));
    GetAliasResponse aliasResponse = client.indices().getAlias(getAliasRequest);

    Set<String> aliases = aliasResponse.result().get(indexName).aliases().keySet();
    assertTrue(aliases.contains(alias1), "Alias1 should exist");
    assertTrue(aliases.contains(alias2), "Alias2 should exist");
    assertTrue(aliases.contains(alias3), "Alias3 should exist");
  }

  @Test
  void testIndexLifecycle_CreateUpdateDelete() {
    String indexName = testIndexMapping.getIndexName(TEST_CLUSTER_ALIAS);

    // 1. Create index
    indexManager.createIndex(testIndexMapping, SAMPLE_MAPPING_JSON);
    assertTrue(indexManager.indexExists(indexName), "Index should exist after creation");

    // 2. Update index
    indexManager.updateIndex(testIndexMapping, UPDATED_MAPPING_JSON);
    assertTrue(indexManager.indexExists(indexName), "Index should exist after update");

    // 3. Add alias
    String lifecycleAlias = testIndexPrefix + "_lifecycle_alias";
    indexManager.addIndexAlias(testIndexMapping, lifecycleAlias);

    // 4. Delete index
    indexManager.deleteIndex(testIndexMapping);
    assertFalse(indexManager.indexExists(indexName), "Index should not exist after deletion");
  }

  @Test
  void testConcurrentIndexOperations() throws InterruptedException {
    int threadCount = 3; // Reduced for OpenSearch testing
    Thread[] threads = new Thread[threadCount];
    boolean[] results = new boolean[threadCount];

    for (int i = 0; i < threadCount; i++) {
      final int threadIndex = i;
      final String threadIndexName = testIndexPrefix + "_thread_" + threadIndex;
      final IndexMapping threadMapping = createTestIndexMapping(threadIndexName);

      threads[i] =
          new Thread(
              () -> {
                try {
                  // Each thread creates its own index
                  indexManager.createIndex(threadMapping, SAMPLE_MAPPING_JSON);
                  boolean exists =
                      indexManager.indexExists(threadMapping.getIndexName(TEST_CLUSTER_ALIAS));

                  if (exists) {
                    // Add alias
                    indexManager.addIndexAlias(threadMapping, threadIndexName + "_alias");
                    // Update mapping
                    indexManager.updateIndex(threadMapping, UPDATED_MAPPING_JSON);
                    // Delete index
                    indexManager.deleteIndex(threadMapping);
                  }

                  results[threadIndex] = exists;
                } catch (Exception e) {
                  LOG.error("Thread {} failed", threadIndex, e);
                  results[threadIndex] = false;
                }
              });
    }

    // Start all threads
    for (Thread thread : threads) {
      thread.start();
    }

    // Wait for all threads to complete
    for (Thread thread : threads) {
      thread.join(30000); // 30 second timeout
    }

    // Verify all operations succeeded
    for (int i = 0; i < threadCount; i++) {
      assertTrue(results[i], "Thread " + i + " should have completed successfully");
    }
  }

  @Test
  void testComplexMappingOperations() {
    String complexMappingJson =
        """
        {
          "settings": {
            "number_of_shards": 2,
            "number_of_replicas": 1,
            "analysis": {
              "analyzer": {
                "custom_analyzer": {
                  "type": "custom",
                  "tokenizer": "standard",
                  "filter": ["lowercase", "stop"]
                }
              }
            }
          },
          "mappings": {
            "properties": {
              "nested_field": {
                "type": "nested",
                "properties": {
                  "inner_text": {
                    "type": "text",
                    "analyzer": "custom_analyzer"
                  },
                  "inner_keyword": {
                    "type": "keyword"
                  }
                }
              },
              "geo_point": {
                "type": "geo_point"
              },
              "date_range": {
                "type": "date_range"
              }
            }
          }
        }
        """;

    IndexMapping complexMapping = createTestIndexMapping(testIndexPrefix + "_complex");
    String indexName = complexMapping.getIndexName(TEST_CLUSTER_ALIAS);

    // Create index with complex mapping
    assertDoesNotThrow(
        () -> {
          indexManager.createIndex(complexMapping, complexMappingJson);
        },
        "Complex index creation should not throw exception");

    assertTrue(indexManager.indexExists(indexName), "Complex index should exist after creation");

    // Clean up
    indexManager.deleteIndex(complexMapping);
  }

  @Test
  void testAddAliases_IntegrationTest() {
    String indexName = testIndexMapping.getIndexName(TEST_CLUSTER_ALIAS);
    Set<String> aliasesToAdd =
        Set.of(
            testIndexPrefix + "_bulk_alias1",
            testIndexPrefix + "_bulk_alias2",
            testIndexPrefix + "_bulk_alias3");

    // Create index first
    indexManager.createIndex(testIndexMapping, SAMPLE_MAPPING_JSON);
    assertTrue(indexManager.indexExists(indexName), "Index should exist after creation");

    // Add multiple aliases
    assertDoesNotThrow(
        () -> indexManager.addAliases(indexName, aliasesToAdd),
        "Adding bulk aliases should not throw exception");

    // Verify all aliases were added
    Set<String> retrievedAliases = indexManager.getAliases(indexName);
    for (String alias : aliasesToAdd) {
      assertTrue(retrievedAliases.contains(alias), "Alias should exist: " + alias);
    }

    LOG.info("Successfully added and verified bulk aliases: {}", aliasesToAdd);
  }

  @Test
  void testRemoveAliases_IntegrationTest() {
    String indexName = testIndexMapping.getIndexName(TEST_CLUSTER_ALIAS);
    Set<String> aliasesToAdd =
        Set.of(
            testIndexPrefix + "_remove_alias1",
            testIndexPrefix + "_remove_alias2",
            testIndexPrefix + "_remove_alias3");
    Set<String> aliasesToRemove =
        Set.of(testIndexPrefix + "_remove_alias1", testIndexPrefix + "_remove_alias3");

    // Create index and add aliases
    indexManager.createIndex(testIndexMapping, SAMPLE_MAPPING_JSON);
    indexManager.addAliases(indexName, aliasesToAdd);

    // Verify aliases were added
    Set<String> aliasesBeforeRemoval = indexManager.getAliases(indexName);
    for (String alias : aliasesToAdd) {
      assertTrue(
          aliasesBeforeRemoval.contains(alias), "Alias should exist before removal: " + alias);
    }

    // Remove some aliases
    assertDoesNotThrow(
        () -> indexManager.removeAliases(indexName, aliasesToRemove),
        "Removing aliases should not throw exception");

    // Verify specific aliases were removed
    Set<String> aliasesAfterRemoval = indexManager.getAliases(indexName);
    for (String alias : aliasesToRemove) {
      assertFalse(
          aliasesAfterRemoval.contains(alias), "Alias should not exist after removal: " + alias);
    }

    // Verify remaining aliases still exist
    assertTrue(
        aliasesAfterRemoval.contains(testIndexPrefix + "_remove_alias2"),
        "Remaining alias should still exist");

    LOG.info("Successfully removed specific aliases: {}", aliasesToRemove);
  }

  @Test
  void testGetAliases_IntegrationTest() {
    String indexName = testIndexMapping.getIndexName(TEST_CLUSTER_ALIAS);
    String mainAlias = testIndexMapping.getAlias(TEST_CLUSTER_ALIAS);
    List<String> parentAliases = testIndexMapping.getParentAliases(TEST_CLUSTER_ALIAS);

    // Create index (which creates default aliases)
    indexManager.createIndex(testIndexMapping, SAMPLE_MAPPING_JSON);
    assertTrue(indexManager.indexExists(indexName), "Index should exist after creation");

    // Get aliases
    Set<String> retrievedAliases = indexManager.getAliases(indexName);

    // Verify default aliases are present
    assertFalse(retrievedAliases.isEmpty(), "Retrieved aliases should not be empty");
    assertTrue(retrievedAliases.contains(mainAlias), "Main alias should be present");

    for (String parentAlias : parentAliases) {
      assertTrue(
          retrievedAliases.contains(parentAlias), "Parent alias should be present: " + parentAlias);
    }

    // Add additional aliases and verify they are retrieved
    Set<String> additionalAliases =
        Set.of(testIndexPrefix + "_get_test_alias1", testIndexPrefix + "_get_test_alias2");
    indexManager.addAliases(indexName, additionalAliases);

    // Retrieve aliases again
    Set<String> updatedAliases = indexManager.getAliases(indexName);
    for (String alias : additionalAliases) {
      assertTrue(updatedAliases.contains(alias), "Additional alias should be present: " + alias);
    }

    LOG.info("Successfully retrieved all aliases: {}", updatedAliases);
  }

  @Test
  void testGetIndicesByAlias_IntegrationTest() {
    String alias1 = testIndexPrefix + "_shared_alias";
    String alias2 = testIndexPrefix + "_unique_alias";

    // Create multiple indices with shared and unique aliases
    IndexMapping index1Mapping = createTestIndexMapping(testIndexPrefix + "_idx1");
    IndexMapping index2Mapping = createTestIndexMapping(testIndexPrefix + "_idx2");
    IndexMapping index3Mapping = createTestIndexMapping(testIndexPrefix + "_idx3");

    String index1Name = index1Mapping.getIndexName(TEST_CLUSTER_ALIAS);
    String index2Name = index2Mapping.getIndexName(TEST_CLUSTER_ALIAS);
    String index3Name = index3Mapping.getIndexName(TEST_CLUSTER_ALIAS);

    // Create indices
    indexManager.createIndex(index1Mapping, SAMPLE_MAPPING_JSON);
    indexManager.createIndex(index2Mapping, SAMPLE_MAPPING_JSON);
    indexManager.createIndex(index3Mapping, SAMPLE_MAPPING_JSON);

    // Add shared alias to indices 1 and 2
    indexManager.addAliases(index1Name, Set.of(alias1));
    indexManager.addAliases(index2Name, Set.of(alias1));

    // Add unique alias to index 3
    indexManager.addAliases(index3Name, Set.of(alias2));

    // Test getting indices by shared alias
    Set<String> indicesWithSharedAlias = indexManager.getIndicesByAlias(alias1);
    assertEquals(2, indicesWithSharedAlias.size(), "Shared alias should be on 2 indices");
    assertTrue(indicesWithSharedAlias.contains(index1Name), "Index1 should have shared alias");
    assertTrue(indicesWithSharedAlias.contains(index2Name), "Index2 should have shared alias");

    // Test getting indices by unique alias
    Set<String> indicesWithUniqueAlias = indexManager.getIndicesByAlias(alias2);
    assertEquals(1, indicesWithUniqueAlias.size(), "Unique alias should be on 1 index");
    assertTrue(indicesWithUniqueAlias.contains(index3Name), "Index3 should have unique alias");

    // Test with non-existent alias
    Set<String> indicesWithNonExistentAlias =
        indexManager.getIndicesByAlias(testIndexPrefix + "_nonexistent");
    assertTrue(indicesWithNonExistentAlias.isEmpty(), "Non-existent alias should return empty set");

    // Clean up additional test indices
    indexManager.deleteIndex(index1Mapping);
    indexManager.deleteIndex(index2Mapping);
    indexManager.deleteIndex(index3Mapping);

    LOG.info(
        "Successfully tested getIndicesByAlias with shared alias: {} and unique alias: {}",
        alias1,
        alias2);
  }

  @Test
  void testAliasOperations_FullWorkflow() {
    String indexName = testIndexMapping.getIndexName(TEST_CLUSTER_ALIAS);

    // Create index
    indexManager.createIndex(testIndexMapping, SAMPLE_MAPPING_JSON);

    // Step 1: Add bulk aliases
    Set<String> initialAliases =
        Set.of(
            testIndexPrefix + "_workflow_alias1",
            testIndexPrefix + "_workflow_alias2",
            testIndexPrefix + "_workflow_alias3",
            testIndexPrefix + "_workflow_alias4");
    indexManager.addAliases(indexName, initialAliases);

    // Step 2: Verify all aliases exist
    Set<String> allAliases = indexManager.getAliases(indexName);
    for (String alias : initialAliases) {
      assertTrue(allAliases.contains(alias), "Initial alias should exist: " + alias);
    }

    // Step 3: Test getIndicesByAlias for each alias
    for (String alias : initialAliases) {
      Set<String> indicesWithAlias = indexManager.getIndicesByAlias(alias);
      assertTrue(indicesWithAlias.contains(indexName), "Index should be found by alias: " + alias);
    }

    // Step 4: Remove some aliases
    Set<String> aliasesToRemove =
        Set.of(testIndexPrefix + "_workflow_alias2", testIndexPrefix + "_workflow_alias4");
    indexManager.removeAliases(indexName, aliasesToRemove);

    // Step 5: Verify specific aliases were removed
    Set<String> remainingAliases = indexManager.getAliases(indexName);
    for (String alias : aliasesToRemove) {
      assertFalse(remainingAliases.contains(alias), "Removed alias should not exist: " + alias);
    }

    // Step 6: Verify remaining aliases still exist
    Set<String> expectedRemaining =
        Set.of(testIndexPrefix + "_workflow_alias1", testIndexPrefix + "_workflow_alias3");
    for (String alias : expectedRemaining) {
      assertTrue(remainingAliases.contains(alias), "Remaining alias should exist: " + alias);

      // Also verify via getIndicesByAlias
      Set<String> indicesWithAlias = indexManager.getIndicesByAlias(alias);
      assertTrue(
          indicesWithAlias.contains(indexName),
          "Index should still be found by remaining alias: " + alias);
    }

    LOG.info("Successfully completed full alias operations workflow");
  }

  /**
   * Creates test IndexMapping instances for testing purposes
   */
  private static IndexMapping createTestIndexMapping(String indexPrefix) {
    return IndexMapping.builder()
        .indexName(indexPrefix + "_index")
        .alias(indexPrefix + "_alias")
        .parentAliases(List.of(indexPrefix + "_parent1", indexPrefix + "_parent2"))
        .indexMappingFile("test_mapping_%s.json")
        .build();
  }
}
