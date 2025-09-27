package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch.indices.GetAliasRequest;
import es.co.elastic.clients.elasticsearch.indices.GetAliasResponse;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import es.co.elastic.clients.transport.rest_client.RestClientTransport;
import es.org.elasticsearch.client.RestClient;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.OpenMetadataApplicationTest;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ElasticSearchIndexManagerIntegrationTest extends OpenMetadataApplicationTest {

  private ElasticSearchIndexManager indexManager;
  private ElasticsearchClient client;
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

    // Create ES client from the test container
    RestClient restClient = getSearchClient();
    RestClientTransport transport = new RestClientTransport(restClient, new JacksonJsonpMapper());
    client = new ElasticsearchClient(transport);

    // Create IndexManager instance
    indexManager = new ElasticSearchIndexManager(client, TEST_CLUSTER_ALIAS);

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
    int threadCount = 5;
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
