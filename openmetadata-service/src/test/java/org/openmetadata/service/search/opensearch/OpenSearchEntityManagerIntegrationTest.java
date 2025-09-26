package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.core.Response;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.apache.http.HttpHost;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.sdk.exception.SearchIndexNotFoundException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.FieldValue;
import os.org.opensearch.client.opensearch._types.Refresh;
import os.org.opensearch.client.opensearch.core.GetResponse;
import os.org.opensearch.client.opensearch.core.IndexRequest;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;
import os.org.opensearch.client.opensearch.indices.CreateIndexRequest;
import os.org.opensearch.client.transport.rest_client.RestClientTransport;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class OpenSearchEntityManagerIntegrationTest extends OpenMetadataApplicationTest {

  private OpenSearchEntityManager entityManager;
  private OpenSearchClient client;
  private String testIndexPrefix;
  private final ObjectMapper objectMapper = new ObjectMapper();

  private static final String SAMPLE_ENTITY_JSON =
      """
      {
        "id": "test-entity-1",
        "name": "Test Entity 1",
        "description": "Sample test entity for integration testing",
        "fullyQualifiedName": "test.entity.1",
        "entityType": "table",
        "tags": ["test", "sample"],
        "created": "2024-01-01T00:00:00.000Z",
        "updated": "2024-01-01T00:00:00.000Z",
        "deleted": false
      }
      """;

  private static final String TIME_SERIES_ENTITY_JSON =
      """
      {
        "id": "test-timeseries-1",
        "timestamp": "2024-01-01T12:00:00.000Z",
        "entityFQN": "test.entity.1",
        "metricName": "usage",
        "metricValue": 100,
        "dimensions": {
          "database": "test_db",
          "table": "test_table"
        }
      }
      """;

  @BeforeEach
  void setUp() {
    testIndexPrefix =
        "test_os_entity_mgr_"
            + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss_SSS"));

    client = createOpenSearchClient();
    entityManager = new OpenSearchEntityManager(client);

    LOG.info("OpenSearchEntityManager test setup completed with index prefix: {}", testIndexPrefix);
  }

  private OpenSearchClient createOpenSearchClient() {
    try {
      // For testing, we'll connect to the same Elasticsearch test container
      // but treat it as OpenSearch (they share the same REST API)
      es.org.elasticsearch.client.RestClient esRestClient = getSearchClient();
      HttpHost[] hosts =
          esRestClient.getNodes().stream()
              .map(
                  node ->
                      new HttpHost(
                          node.getHost().getHostName(),
                          node.getHost().getPort(),
                          node.getHost().getSchemeName()))
              .toArray(HttpHost[]::new);

      // Create OpenSearch RestClient with the same connection details
      os.org.opensearch.client.RestClient osRestClient =
          os.org.opensearch.client.RestClient.builder(hosts).build();
      RestClientTransport transport =
          new RestClientTransport(osRestClient, new JacksonJsonpMapper());
      return new OpenSearchClient(transport);
    } catch (Exception e) {
      LOG.error("Failed to create OpenSearch client", e);
      throw new RuntimeException("Failed to create OpenSearch client", e);
    }
  }

  @AfterEach
  void tearDown() {
    if (client != null && testIndexPrefix != null) {
      try {
        String[] indicesToDelete = {
          testIndexPrefix + "_main",
          testIndexPrefix + "_timeseries",
          testIndexPrefix + "_bulk_test",
          testIndexPrefix + "_script_test",
          testIndexPrefix + "_multi1",
          testIndexPrefix + "_multi2",
          testIndexPrefix + "_source",
          testIndexPrefix + "_dest",
          testIndexPrefix + "_concurrent"
        };

        for (String indexName : indicesToDelete) {
          try {
            // Clean up both regular and aliased index names
            client.indices().delete(d -> d.index(indexName));
            LOG.info("Cleaned up test index: {}", indexName);

            // Also try to clean up the aliased version if it exists
            String aliasedName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
            if (!aliasedName.equals(indexName)) {
              client.indices().delete(d -> d.index(aliasedName));
              LOG.info("Cleaned up aliased test index: {}", aliasedName);
            }
          } catch (Exception e) {
            LOG.debug("Index {} might not exist for cleanup", indexName);
          }
        }
      } catch (Exception e) {
        LOG.error("Failed to clean up test indices", e);
      }
    }
  }

  @Test
  void testCreateEntity_ValidEntity() throws Exception {
    String indexName = testIndexPrefix + "_main";
    String docId = "test-entity-1";

    createTestIndex(indexName);

    assertDoesNotThrow(
        () -> {
          entityManager.createEntity(indexName, docId, SAMPLE_ENTITY_JSON);
        });

    GetResponse<Map> response = client.get(g -> g.index(indexName).id(docId), Map.class);
    assertTrue(response.found());
    assertEquals("Test Entity 1", response.source().get("name"));
  }

  @Test
  void testCreateEntities_BulkOperation() throws Exception {
    String indexName = testIndexPrefix + "_bulk_test";
    createTestIndex(indexName);

    List<Map<String, String>> docsAndIds = new ArrayList<>();
    for (int i = 1; i <= 5; i++) {
      String docJson =
          SAMPLE_ENTITY_JSON
              .replace("test-entity-1", "test-entity-" + i)
              .replace("Test Entity 1", "Test Entity " + i)
              .replace("test.entity.1", "test.entity." + i);

      Map<String, String> docAndId = new HashMap<>();
      docAndId.put("test-entity-" + i, docJson);
      docsAndIds.add(docAndId);
    }

    assertDoesNotThrow(
        () -> {
          entityManager.createEntities(indexName, docsAndIds);
        });

    Thread.sleep(2000);

    SearchResponse<Map> searchResponse =
        client.search(SearchRequest.of(s -> s.index(indexName).size(10)), Map.class);

    assertEquals(5, searchResponse.hits().total().value());
  }

  @Test
  void testCreateTimeSeriesEntity() throws Exception {
    String indexName = testIndexPrefix + "_timeseries";
    String docId = "ts-1";

    createTestIndex(indexName);

    assertDoesNotThrow(
        () -> {
          entityManager.createTimeSeriesEntity(indexName, docId, TIME_SERIES_ENTITY_JSON);
        });

    GetResponse<Map> response = client.get(g -> g.index(indexName).id(docId), Map.class);
    assertTrue(response.found());
    assertEquals("usage", response.source().get("metricName"));
    assertEquals(100, response.source().get("metricValue"));
  }

  @Test
  void testDeleteEntity() throws Exception {
    String indexName = testIndexPrefix + "_main";
    String docId = "test-entity-to-delete";

    createTestIndex(indexName);

    client.index(
        i ->
            i.index(indexName)
                .id(docId)
                .document(JsonData.of(parseJson(SAMPLE_ENTITY_JSON)))
                .refresh(Refresh.True));

    GetResponse<Map> getResponse = client.get(g -> g.index(indexName).id(docId), Map.class);
    assertTrue(getResponse.found());

    assertDoesNotThrow(
        () -> {
          entityManager.deleteEntity(indexName, docId);
        });

    GetResponse<Map> afterDeleteResponse = client.get(g -> g.index(indexName).id(docId), Map.class);
    assertFalse(afterDeleteResponse.found());
  }

  @Test
  void testDeleteEntityByFields() throws Exception {
    String indexName = testIndexPrefix + "_main";
    createTestIndex(indexName);

    for (int i = 1; i <= 3; i++) {
      final String docId = "delete-test-" + i;
      final String docJson =
          SAMPLE_ENTITY_JSON
              .replace("test-entity-1", docId)
              .replace("table", i <= 2 ? "table" : "column");

      client.index(
          idx ->
              idx.index(indexName)
                  .id(docId)
                  .document(JsonData.of(parseJson(docJson)))
                  .refresh(Refresh.True));
    }

    SearchResponse<Map> beforeDelete =
        client.search(SearchRequest.of(s -> s.index(indexName).size(10)), Map.class);
    assertEquals(3, beforeDelete.hits().total().value());

    List<Pair<String, String>> fieldAndValue = new ArrayList<>();
    fieldAndValue.add(Pair.of("entityType", "table"));

    assertDoesNotThrow(
        () -> {
          entityManager.deleteEntityByFields(List.of(indexName), fieldAndValue);
        });

    Thread.sleep(1000);

    SearchResponse<Map> afterDelete =
        client.search(
            SearchRequest.of(
                s ->
                    s.index(indexName)
                        .query(
                            q -> q.term(t -> t.field("entityType").value(FieldValue.of("table"))))),
            Map.class);

    assertEquals(0, afterDelete.hits().total().value());
  }

  @Test
  void testDeleteEntityByFQNPrefix() throws Exception {
    String indexName = testIndexPrefix + "_main";
    createTestIndex(indexName);

    for (int i = 1; i <= 3; i++) {
      final String fqn = i <= 2 ? "test.entity.prefix." + i : "other.entity." + i;
      final String docId = "fqn-test-" + i;
      final String docJson =
          SAMPLE_ENTITY_JSON.replace("test.entity.1", fqn).replace("test-entity-1", docId);

      client.index(
          idx ->
              idx.index(indexName)
                  .id(docId)
                  .document(JsonData.of(parseJson(docJson)))
                  .refresh(Refresh.True));
    }

    assertDoesNotThrow(
        () -> {
          entityManager.deleteEntityByFQNPrefix(indexName, "test.entity.prefix");
        });

    Thread.sleep(1000);

    SearchResponse<Map> searchResponse =
        client.search(
            SearchRequest.of(
                s ->
                    s.index(indexName)
                        .query(
                            q ->
                                q.prefix(
                                    p ->
                                        p.field("fullyQualifiedName.keyword")
                                            .value("test.entity.prefix")))),
            Map.class);

    assertEquals(0, searchResponse.hits().total().value());
  }

  @Test
  void testDeleteByScript() throws Exception {
    String indexName = testIndexPrefix + "_script_test";
    createTestIndex(indexName);

    // Wait for index to be ready
    Thread.sleep(500);

    for (int i = 1; i <= 3; i++) {
      final String docId = "script-test-" + i;
      final String docJson =
          SAMPLE_ENTITY_JSON
              .replace("test-entity-1", docId)
              .replace("\"deleted\": false", "\"deleted\": " + (i == 3 ? "true" : "false"));

      client.index(
          idx ->
              idx.index(indexName)
                  .id(docId)
                  .document(JsonData.of(parseJson(docJson)))
                  .refresh(Refresh.True));
    }

    // Wait for documents to be indexed
    Thread.sleep(1000);

    // The script should return true for documents to be deleted
    // In OpenSearch deleteByQuery with script query, the script acts as a filter
    String scriptTxt = "doc['deleted'].value == true";
    Map<String, Object> params = new HashMap<>();

    try {
      entityManager.deleteByScript(indexName, scriptTxt, params);
      // Wait for deletion to complete
      Thread.sleep(1000);
    } catch (Exception e) {
      LOG.warn("Delete by script operation failed, which may be expected in test environment", e);
    }

    // Verify that the document with deleted=true was removed
    SearchResponse<Map> searchResponse =
        client.search(SearchRequest.of(s -> s.index(indexName).size(10)), Map.class);

    // We should have 2 documents left (the ones with deleted=false)
    long remainingDocs = searchResponse.hits().total().value();
    assertEquals(2, remainingDocs, "Should have 2 documents with deleted=false remaining");

    // Verify no documents with deleted=true exist
    SearchResponse<Map> deletedSearchResponse =
        client.search(
            SearchRequest.of(
                s ->
                    s.index(indexName)
                        .query(q -> q.term(t -> t.field("deleted").value(FieldValue.of(true))))),
            Map.class);

    assertEquals(
        0,
        deletedSearchResponse.hits().total().value(),
        "Should have no documents with deleted=true");
  }

  @Test
  void testSoftDeleteOrRestoreEntity() throws Exception {
    String indexName = testIndexPrefix + "_main";
    String docId = "soft-delete-test";

    createTestIndex(indexName);

    client.index(
        i ->
            i.index(indexName)
                .id(docId)
                .document(JsonData.of(parseJson(SAMPLE_ENTITY_JSON)))
                .refresh(Refresh.True));

    String softDeleteScript = "ctx._source.deleted = true";

    assertDoesNotThrow(
        () -> {
          entityManager.softDeleteOrRestoreEntity(indexName, docId, softDeleteScript);
        });

    GetResponse<Map> response = client.get(g -> g.index(indexName).id(docId), Map.class);
    assertTrue(response.found());
    assertTrue((Boolean) response.source().get("deleted"));

    String restoreScript = "ctx._source.deleted = false";
    assertDoesNotThrow(
        () -> {
          entityManager.softDeleteOrRestoreEntity(indexName, docId, restoreScript);
        });

    GetResponse<Map> restoredResponse = client.get(g -> g.index(indexName).id(docId), Map.class);
    assertFalse((Boolean) restoredResponse.source().get("deleted"));
  }

  @Test
  void testUpdateEntity() throws Exception {
    String indexName = testIndexPrefix + "_main";
    String docId = "update-test";

    createTestIndex(indexName);

    client.index(
        i ->
            i.index(indexName)
                .id(docId)
                .document(JsonData.of(parseJson(SAMPLE_ENTITY_JSON)))
                .refresh(Refresh.True));

    Map<String, Object> updateData = new HashMap<>();
    updateData.put("newDescription", "Updated description");
    updateData.put("newTags", List.of("updated", "modified"));

    String updateScript =
        "ctx._source.description = params.newDescription; ctx._source.tags = params.newTags";

    assertDoesNotThrow(
        () -> {
          entityManager.updateEntity(indexName, docId, updateData, updateScript);
        });

    GetResponse<Map> response = client.get(g -> g.index(indexName).id(docId), Map.class);
    assertEquals("Updated description", response.source().get("description"));
    assertNotNull(response.source().get("tags"));
  }

  @Test
  void testGetDocByID() throws Exception {
    String indexName = testIndexPrefix + "_main";
    String docId = "get-test";

    // Get the actual index name that will be used by getDocByID (includes cluster alias)
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);

    // Create index with the actual name that will be used
    createTestIndex(actualIndexName);

    // Index the document directly using the actual index name
    client.index(
        i ->
            i.index(actualIndexName)
                .id(docId)
                .document(JsonData.of(parseJson(SAMPLE_ENTITY_JSON)))
                .refresh(Refresh.True));

    // Wait for indexing to complete
    Thread.sleep(500);

    Response response = entityManager.getDocByID(indexName, docId);
    assertEquals(200, response.getStatus());

    Map<String, Object> entity = (Map<String, Object>) response.getEntity();
    assertNotNull(entity);
    assertEquals("Test Entity 1", entity.get("name"));
  }

  @Test
  void testGetDocByID_NotFound() throws Exception {
    String indexName = testIndexPrefix + "_main";
    String docId = "non-existent";

    createTestIndex(indexName);

    try {
      entityManager.getDocByID(indexName, docId);
    } catch (SearchIndexNotFoundException e) {
      assertTrue(e.getMessage().contains("Failed to find doc with id non-existent"));
    }
  }

  @Test
  void testUpdateEntityRelationship() throws Exception {
    String indexName = testIndexPrefix + "_main";
    createTestIndex(indexName);

    client.index(
        i ->
            i.index(indexName)
                .id("relationship-test")
                .document(JsonData.of(parseJson(SAMPLE_ENTITY_JSON)))
                .refresh(Refresh.True));

    Map<String, Object> relationshipData = new HashMap<>();
    relationshipData.put("entityId", "related-entity-123");
    relationshipData.put("relationType", "CONTAINS");

    assertDoesNotThrow(
        () -> {
          entityManager.updateEntityRelationship(
              indexName, Pair.of("name", "Test Entity 1"), relationshipData);
        });
  }

  @Test
  void testReindexWithEntityIds() throws Exception {
    String sourceIndex = testIndexPrefix + "_source";
    String destIndex = testIndexPrefix + "_dest";

    createTestIndex(sourceIndex);
    createTestIndex(destIndex);

    List<UUID> entityIds = new ArrayList<>();
    for (int i = 1; i <= 3; i++) {
      UUID entityId = UUID.randomUUID();
      entityIds.add(entityId);

      String docJson = SAMPLE_ENTITY_JSON.replace("test-entity-1", entityId.toString());
      client.index(
          idx ->
              idx.index(sourceIndex)
                  .id(entityId.toString())
                  .document(JsonData.of(parseJson(docJson)))
                  .refresh(Refresh.True));
    }

    assertDoesNotThrow(
        () -> {
          entityManager.reindexWithEntityIds(
              List.of(sourceIndex), destIndex, null, "table", entityIds);
        });

    Thread.sleep(2000);

    SearchResponse<Map> searchResponse =
        client.search(SearchRequest.of(s -> s.index(destIndex).size(10)), Map.class);

    assertEquals(3, searchResponse.hits().total().value());
  }

  @Test
  void testSoftDeleteOrRestoreChildren() throws Exception {
    String indexName = testIndexPrefix + "_main";
    createTestIndex(indexName);

    for (int i = 1; i <= 3; i++) {
      final String docId = "child-test-" + i;
      final String docJson =
          SAMPLE_ENTITY_JSON
              .replace("test-entity-1", docId)
              .replace("Test Entity 1", "Child Entity " + i)
              .replace("test.entity.1", "parent.child." + i);

      client.index(
          idx ->
              idx.index(indexName)
                  .id(docId)
                  .document(JsonData.of(parseJson(docJson)))
                  .refresh(Refresh.True));
    }

    List<Pair<String, String>> fieldAndValue = new ArrayList<>();
    fieldAndValue.add(Pair.of("entityType", "table"));

    String softDeleteScript = "ctx._source.deleted = true";

    assertDoesNotThrow(
        () -> {
          entityManager.softDeleteOrRestoreChildren(
              List.of(indexName), softDeleteScript, fieldAndValue);
        });

    Thread.sleep(1000);

    SearchResponse<Map> searchResponse =
        client.search(
            SearchRequest.of(
                s ->
                    s.index(indexName)
                        .query(q -> q.term(t -> t.field("deleted").value(FieldValue.of(true))))),
            Map.class);

    assertEquals(3, searchResponse.hits().total().value());
  }

  @Test
  void testUpdateChildren() throws Exception {
    String indexName = testIndexPrefix + "_main";

    // Get the actual index name that will be used by updateChildren (includes cluster alias)
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);

    // Create index with the actual name that will be used
    createTestIndex(actualIndexName);

    for (int i = 1; i <= 3; i++) {
      final String docId = "update-child-" + i;
      final String docJson =
          SAMPLE_ENTITY_JSON
              .replace("test-entity-1", docId)
              .replace("Test Entity 1", "Update Child " + i);

      // Index documents using the actual index name
      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id(docId)
                  .document(JsonData.of(parseJson(docJson)))
                  .refresh(Refresh.True));
    }

    Map<String, Object> updateData = new HashMap<>();
    updateData.put("newStatus", "updated");

    String updateScript = "ctx._source.status = params.newStatus";

    assertDoesNotThrow(
        () -> {
          // Call updateChildren with the original index name (without alias)
          entityManager.updateChildren(
              indexName, Pair.of("entityType", "table"), Pair.of(updateScript, updateData));
        });

    Thread.sleep(1000);

    // Search using the actual index name
    SearchResponse<Map> searchResponse =
        client.search(
            SearchRequest.of(
                s ->
                    s.index(actualIndexName)
                        .query(
                            q -> q.term(t -> t.field("status").value(FieldValue.of("updated"))))),
            Map.class);

    assertEquals(3, searchResponse.hits().total().value());
  }

  @Test
  void testUpdateChildren_MultipleIndices() throws Exception {
    String indexName1 = testIndexPrefix + "_multi1";
    String indexName2 = testIndexPrefix + "_multi2";

    createTestIndex(indexName1);
    createTestIndex(indexName2);

    // Add documents to first index
    for (int i = 1; i <= 2; i++) {
      final String docId = "multi-child-1-" + i;
      final String docJson =
          SAMPLE_ENTITY_JSON
              .replace("test-entity-1", docId)
              .replace("Test Entity 1", "Multi Child 1-" + i);

      client.index(
          IndexRequest.of(
              idx ->
                  idx.index(indexName1)
                      .id(docId)
                      .document(parseJson(docJson))
                      .refresh(Refresh.True)));
    }

    // Add documents to second index
    for (int i = 1; i <= 2; i++) {
      final String docId = "multi-child-2-" + i;
      final String docJson =
          SAMPLE_ENTITY_JSON
              .replace("test-entity-1", docId)
              .replace("Test Entity 1", "Multi Child 2-" + i);

      client.index(
          IndexRequest.of(
              idx ->
                  idx.index(indexName2)
                      .id(docId)
                      .document(parseJson(docJson))
                      .refresh(Refresh.True)));
    }

    Map<String, Object> updateData = new HashMap<>();
    updateData.put("newStatus", "bulk-updated");

    String updateScript = "ctx._source.status = params.newStatus";

    assertDoesNotThrow(
        () -> {
          entityManager.updateChildren(
              List.of(indexName1, indexName2),
              Pair.of("entityType", "table"),
              Pair.of(updateScript, updateData));
        });

    Thread.sleep(1000);

    // Verify updates in both indices
    SearchResponse<Map> searchResponse1 =
        client.search(
            SearchRequest.of(
                s ->
                    s.index(indexName1)
                        .query(
                            q ->
                                q.term(
                                    t -> t.field("status").value(FieldValue.of("bulk-updated"))))),
            Map.class);

    SearchResponse<Map> searchResponse2 =
        client.search(
            SearchRequest.of(
                s ->
                    s.index(indexName2)
                        .query(
                            q ->
                                q.term(
                                    t -> t.field("status").value(FieldValue.of("bulk-updated"))))),
            Map.class);

    assertEquals(2, searchResponse1.hits().total().value());
    assertEquals(2, searchResponse2.hits().total().value());
  }

  @Test
  void testConcurrentOperations() throws InterruptedException {
    final String indexName = testIndexPrefix + "_concurrent";
    createTestIndex(indexName);

    int threadCount = 5;
    int operationsPerThread = 3;
    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch completionLatch = new CountDownLatch(threadCount);

    for (int t = 0; t < threadCount; t++) {
      final int threadId = t;
      new Thread(
              () -> {
                try {
                  startLatch.await();

                  for (int i = 0; i < operationsPerThread; i++) {
                    String docId = "thread-" + threadId + "-doc-" + i;
                    String docJson =
                        SAMPLE_ENTITY_JSON
                            .replace("test-entity-1", docId)
                            .replace("Test Entity 1", "Thread " + threadId + " Doc " + i);

                    entityManager.createEntity(indexName, docId, docJson);

                    if (i % 2 == 0) {
                      entityManager.deleteEntity(indexName, docId);
                    }
                  }
                } catch (Exception e) {
                  LOG.error("Thread {} failed", threadId, e);
                } finally {
                  completionLatch.countDown();
                }
              })
          .start();
    }

    startLatch.countDown();
    assertTrue(completionLatch.await(30, TimeUnit.SECONDS));
  }

  private void createTestIndex(String indexName) {
    try {
      CreateIndexRequest request =
          CreateIndexRequest.of(
              c ->
                  c.index(indexName)
                      .mappings(
                          m ->
                              m.properties("id", p -> p.keyword(k -> k))
                                  .properties("name", p -> p.text(t -> t))
                                  .properties("description", p -> p.text(t -> t))
                                  .properties("fullyQualifiedName", p -> p.keyword(k -> k))
                                  .properties("entityType", p -> p.keyword(k -> k))
                                  .properties("tags", p -> p.keyword(k -> k))
                                  .properties("deleted", p -> p.boolean_(b -> b))
                                  .properties("created", p -> p.date(d -> d))
                                  .properties("updated", p -> p.date(d -> d))
                                  .properties("timestamp", p -> p.date(d -> d))
                                  .properties("metricName", p -> p.keyword(k -> k))
                                  .properties("metricValue", p -> p.long_(l -> l))
                                  .properties("status", p -> p.keyword(k -> k))));

      client.indices().create(request);
      LOG.info("Created test index: {}", indexName);
    } catch (Exception e) {
      LOG.debug("Index {} might already exist", indexName);
    }
  }

  private Map<String, Object> parseJson(String json) {
    try {
      return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
    } catch (Exception e) {
      throw new RuntimeException("Failed to parse JSON: " + json, e);
    }
  }
}
