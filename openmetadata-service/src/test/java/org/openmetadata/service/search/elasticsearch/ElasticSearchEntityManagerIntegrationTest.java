package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.Refresh;
import es.co.elastic.clients.elasticsearch.core.GetResponse;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.elasticsearch.core.SearchResponse;
import es.co.elastic.clients.elasticsearch.indices.CreateIndexRequest;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import es.co.elastic.clients.transport.rest5_client.Rest5ClientTransport;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.entityRelationship.SearchSchemaEntityRelationshipResult;
import org.openmetadata.sdk.exception.SearchIndexNotFoundException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ElasticSearchEntityManagerIntegrationTest extends OpenMetadataApplicationTest {

  private ElasticSearchEntityManager entityManager;
  private ElasticsearchClient client;
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
        "test_entity_mgr_"
            + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss_SSS"));

    Rest5Client restClient = getSearchClient();
    Rest5ClientTransport transport = new Rest5ClientTransport(restClient, new JacksonJsonpMapper());
    client = new ElasticsearchClient(transport);

    entityManager = new ElasticSearchEntityManager(client);

    LOG.info(
        "ElasticSearchEntityManager test setup completed with index prefix: {}", testIndexPrefix);
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
          testIndexPrefix + "_concurrent",
          testIndexPrefix + "_source",
          testIndexPrefix + "_dest",
          testIndexPrefix + "_multi1",
          testIndexPrefix + "_multi2",
          testIndexPrefix + "_range_test",
          testIndexPrefix + "_range_term_test",
          testIndexPrefix + "_fqn_update_test",
          testIndexPrefix + "_lineage_test",
          testIndexPrefix + "_delete_lineage_test",
          testIndexPrefix + "_glossary_update_test"
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

    CountDownLatch latch = new CountDownLatch(1);

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
                .document(parseJson(SAMPLE_ENTITY_JSON))
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
          idx -> idx.index(indexName).id(docId).document(parseJson(docJson)).refresh(Refresh.True));
    }

    SearchResponse<Map> beforeDelete =
        client.search(SearchRequest.of(s -> s.index(indexName).size(10)), Map.class);
    assertTrue(beforeDelete.hits().total().value() == 3);

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
                        .query(q -> q.term(t -> t.field("entityType").value("table")))),
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
          idx -> idx.index(indexName).id(docId).document(parseJson(docJson)).refresh(Refresh.True));
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
          idx -> idx.index(indexName).id(docId).document(parseJson(docJson)).refresh(Refresh.True));
    }

    // Wait for documents to be indexed
    Thread.sleep(1000);

    // The script should return true for documents to be deleted
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
                s -> s.index(indexName).query(q -> q.term(t -> t.field("deleted").value(true)))),
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
                .document(parseJson(SAMPLE_ENTITY_JSON))
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
                .document(parseJson(SAMPLE_ENTITY_JSON))
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
                .document(parseJson(SAMPLE_ENTITY_JSON))
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
                .document(parseJson(SAMPLE_ENTITY_JSON))
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
                  .document(parseJson(docJson))
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
          idx -> idx.index(indexName).id(docId).document(parseJson(docJson)).refresh(Refresh.True));
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
                s -> s.index(indexName).query(q -> q.term(t -> t.field("deleted").value(true)))),
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
                  .document(parseJson(docJson))
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
                        .query(q -> q.term(t -> t.field("status").value("updated")))),
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
          idx ->
              idx.index(indexName1).id(docId).document(parseJson(docJson)).refresh(Refresh.True));
    }

    // Add documents to second index
    for (int i = 1; i <= 2; i++) {
      final String docId = "multi-child-2-" + i;
      final String docJson =
          SAMPLE_ENTITY_JSON
              .replace("test-entity-1", docId)
              .replace("Test Entity 1", "Multi Child 2-" + i);

      client.index(
          idx ->
              idx.index(indexName2).id(docId).document(parseJson(docJson)).refresh(Refresh.True));
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
                        .query(q -> q.term(t -> t.field("status").value("bulk-updated")))),
            Map.class);

    SearchResponse<Map> searchResponse2 =
        client.search(
            SearchRequest.of(
                s ->
                    s.index(indexName2)
                        .query(q -> q.term(t -> t.field("status").value("bulk-updated")))),
            Map.class);

    assertEquals(2, searchResponse1.hits().total().value());
    assertEquals(2, searchResponse2.hits().total().value());
  }

  @Test
  void testConcurrentOperations() throws InterruptedException {
    String indexName = testIndexPrefix + "_concurrent";
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

  @Test
  void testDeleteByRangeQuery() throws Exception {
    String indexName = testIndexPrefix + "_range_test";
    createTestIndex(indexName);

    long now = System.currentTimeMillis();
    for (int i = 1; i <= 5; i++) {
      final String docId = "range-test-" + i;
      final long timestamp = now - (i * 86400000L);
      final String docJson =
          SAMPLE_ENTITY_JSON
              .replace("test-entity-1", docId)
              .replace("\"created\": \"2024-01-01T00:00:00.000Z\"", "\"created\": " + timestamp);

      client.index(
          idx -> idx.index(indexName).id(docId).document(parseJson(docJson)).refresh(Refresh.True));
    }

    Thread.sleep(1000);

    SearchResponse<Map> beforeDelete =
        client.search(SearchRequest.of(s -> s.index(indexName).size(10)), Map.class);
    assertEquals(5, beforeDelete.hits().total().value());

    long threeDaysAgo = now - (3 * 86400000L);

    assertDoesNotThrow(
        () -> {
          entityManager.deleteByRangeQuery(indexName, "created", null, null, null, threeDaysAgo);
        });

    Thread.sleep(1000);

    SearchResponse<Map> afterDelete =
        client.search(SearchRequest.of(s -> s.index(indexName).size(10)), Map.class);

    assertEquals(2, afterDelete.hits().total().value());
  }

  @Test
  void testUpdateByFqnPrefix() throws Exception {
    String indexName = testIndexPrefix + "_fqn_update_test";

    // Get the actual index name that will be used by updateByFqnPrefix (includes cluster alias)
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);

    // Create index with the actual name that will be used
    createTestIndex(actualIndexName);

    // Create parent and child entities with hierarchical FQNs
    String parentDoc =
        """
        {
          "id": "parent-1",
          "name": "Parent Table",
          "fullyQualifiedName": "database.schema.parent",
          "fqnDepth": 3,
          "entityType": "table"
        }
        """;

    String child1Doc =
        """
        {
          "id": "child-1",
          "name": "Child Column 1",
          "fullyQualifiedName": "database.schema.parent.column1",
          "fqnDepth": 4,
          "entityType": "column",
          "parent": {
            "fullyQualifiedName": "database.schema.parent"
          }
        }
        """;

    String child2Doc =
        """
        {
          "id": "child-2",
          "name": "Child Column 2",
          "fullyQualifiedName": "database.schema.parent.column2",
          "fqnDepth": 4,
          "entityType": "column",
          "parent": {
            "fullyQualifiedName": "database.schema.parent"
          }
        }
        """;

    // Index documents using the actual index name
    client.index(
        i ->
            i.index(actualIndexName)
                .id("parent-1")
                .document(parseJson(parentDoc))
                .refresh(Refresh.True));
    client.index(
        i ->
            i.index(actualIndexName)
                .id("child-1")
                .document(parseJson(child1Doc))
                .refresh(Refresh.True));
    client.index(
        i ->
            i.index(actualIndexName)
                .id("child-2")
                .document(parseJson(child2Doc))
                .refresh(Refresh.True));

    Thread.sleep(1000);

    // Update FQN prefix from "database.schema.parent" to "database.newschema.newparent"
    assertDoesNotThrow(
        () -> {
          // Call with the original index name (without alias) - the method will resolve it
          entityManager.updateByFqnPrefix(
              indexName,
              "database.schema.parent",
              "database.newschema.newparent",
              "fullyQualifiedName");
        });

    Thread.sleep(1000);

    // Verify parent FQN was updated - search using actual index name
    GetResponse<Map> parentResponse =
        client.get(g -> g.index(actualIndexName).id("parent-1"), Map.class);
    assertEquals("database.newschema.newparent", parentResponse.source().get("fullyQualifiedName"));
    assertEquals(3, parentResponse.source().get("fqnDepth"));

    // Verify child FQNs were updated - search using actual index name
    GetResponse<Map> child1Response =
        client.get(g -> g.index(actualIndexName).id("child-1"), Map.class);
    assertEquals(
        "database.newschema.newparent.column1", child1Response.source().get("fullyQualifiedName"));
    assertEquals(4, child1Response.source().get("fqnDepth"));
    Map<String, Object> child1Parent = (Map<String, Object>) child1Response.source().get("parent");
    assertEquals("database.newschema.newparent", child1Parent.get("fullyQualifiedName"));

    GetResponse<Map> child2Response =
        client.get(g -> g.index(actualIndexName).id("child-2"), Map.class);
    assertEquals(
        "database.newschema.newparent.column2", child2Response.source().get("fullyQualifiedName"));
  }

  @Test
  void testUpdateColumnsInUpstreamLineage() throws Exception {
    String indexName = testIndexPrefix + "_lineage_test";

    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);

    createTestIndex(actualIndexName);

    String entity1Doc =
        """
        {
          "id": "table-1",
          "name": "Test Table 1",
          "fullyQualifiedName": "database.schema.table1",
          "entityType": "table",
          "upstreamLineage": [
            {
              "fromEntity": {
                "id": "source-table-1",
                "type": "table",
                "fullyQualifiedName": "source.schema.table"
              },
              "toEntity": {
                "id": "table-1",
                "type": "table",
                "fullyQualifiedName": "database.schema.table1"
              },
              "columns": [
                {
                  "fromColumns": ["source.schema.table.old_column1", "source.schema.table.old_column2"],
                  "toColumn": "database.schema.table1.target_column"
                }
              ]
            }
          ]
        }
        """;

    String entity2Doc =
        """
        {
          "id": "table-2",
          "name": "Test Table 2",
          "fullyQualifiedName": "database.schema.table2",
          "entityType": "table",
          "upstreamLineage": [
            {
              "fromEntity": {
                "id": "source-table-2",
                "type": "table",
                "fullyQualifiedName": "source.schema.table2"
              },
              "toEntity": {
                "id": "table-2",
                "type": "table",
                "fullyQualifiedName": "database.schema.table2"
              },
              "columns": [
                {
                  "fromColumns": ["source.schema.table.old_column1"],
                  "toColumn": "database.schema.table2.another_column"
                }
              ]
            }
          ]
        }
        """;

    client.index(
        i ->
            i.index(actualIndexName)
                .id("table-1")
                .document(parseJson(entity1Doc))
                .refresh(Refresh.True));
    client.index(
        i ->
            i.index(actualIndexName)
                .id("table-2")
                .document(parseJson(entity2Doc))
                .refresh(Refresh.True));

    Thread.sleep(1000);

    HashMap<String, String> columnUpdates = new HashMap<>();
    columnUpdates.put("source.schema.table.old_column1", "source.schema.table.new_column1");
    columnUpdates.put("source.schema.table.old_column2", "source.schema.table.new_column2");

    assertDoesNotThrow(
        () -> {
          entityManager.updateColumnsInUpstreamLineage(indexName, columnUpdates);
        });

    Thread.sleep(1000);

    GetResponse<Map> table1Response =
        client.get(g -> g.index(actualIndexName).id("table-1"), Map.class);
    List<Map<String, Object>> upstreamLineage1 =
        (List<Map<String, Object>>) table1Response.source().get("upstreamLineage");
    assertNotNull(upstreamLineage1);
    assertEquals(1, upstreamLineage1.size());

    List<Map<String, Object>> columns1 =
        (List<Map<String, Object>>) upstreamLineage1.get(0).get("columns");
    assertNotNull(columns1);
    assertEquals(1, columns1.size());

    List<String> fromColumns1 = (List<String>) columns1.get(0).get("fromColumns");
    assertTrue(fromColumns1.contains("source.schema.table.new_column1"));
    assertTrue(fromColumns1.contains("source.schema.table.new_column2"));
    assertFalse(fromColumns1.contains("source.schema.table.old_column1"));
    assertFalse(fromColumns1.contains("source.schema.table.old_column2"));

    GetResponse<Map> table2Response =
        client.get(g -> g.index(actualIndexName).id("table-2"), Map.class);
    List<Map<String, Object>> upstreamLineage2 =
        (List<Map<String, Object>>) table2Response.source().get("upstreamLineage");
    assertNotNull(upstreamLineage2);

    List<Map<String, Object>> columns2 =
        (List<Map<String, Object>>) upstreamLineage2.get(0).get("columns");
    assertNotNull(columns2);

    List<String> fromColumns2 = (List<String>) columns2.get(0).get("fromColumns");
    assertTrue(fromColumns2.contains("source.schema.table.new_column1"));
    assertFalse(fromColumns2.contains("source.schema.table.old_column1"));
  }

  @Test
  void testDeleteColumnsInUpstreamLineage() throws Exception {
    String indexName = testIndexPrefix + "_delete_lineage_test";

    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);

    createTestIndex(actualIndexName);

    String entity1Doc =
        """
        {
          "id": "table-1",
          "name": "Test Table 1",
          "fullyQualifiedName": "database.schema.table1",
          "entityType": "table",
          "upstreamLineage": [
            {
              "fromEntity": {
                "id": "source-table-1",
                "type": "table",
                "fullyQualifiedName": "source.schema.table"
              },
              "toEntity": {
                "id": "table-1",
                "type": "table",
                "fullyQualifiedName": "database.schema.table1"
              },
              "columns": [
                {
                  "fromColumns": ["source.schema.table.column1", "source.schema.table.column2"],
                  "toColumn": "database.schema.table1.target_column"
                },
                {
                  "fromColumns": ["source.schema.table.column3"],
                  "toColumn": "database.schema.table1.column_to_delete"
                }
              ]
            }
          ]
        }
        """;

    String entity2Doc =
        """
        {
          "id": "table-2",
          "name": "Test Table 2",
          "fullyQualifiedName": "database.schema.table2",
          "entityType": "table",
          "upstreamLineage": [
            {
              "fromEntity": {
                "id": "source-table-2",
                "type": "table",
                "fullyQualifiedName": "source.schema.table2"
              },
              "toEntity": {
                "id": "table-2",
                "type": "table",
                "fullyQualifiedName": "database.schema.table2"
              },
              "columns": [
                {
                  "fromColumns": ["source.schema.table.column1"],
                  "toColumn": "database.schema.table2.another_column"
                },
                {
                  "fromColumns": ["source.schema.table.column4"],
                  "toColumn": "database.schema.table1.column_to_delete"
                }
              ]
            }
          ]
        }
        """;

    client.index(
        i ->
            i.index(actualIndexName)
                .id("table-1")
                .document(parseJson(entity1Doc))
                .refresh(Refresh.True));
    client.index(
        i ->
            i.index(actualIndexName)
                .id("table-2")
                .document(parseJson(entity2Doc))
                .refresh(Refresh.True));

    Thread.sleep(1000);

    List<String> columnsToDelete = new ArrayList<>();
    columnsToDelete.add("source.schema.table.column1");
    columnsToDelete.add("database.schema.table1.column_to_delete");

    assertDoesNotThrow(
        () -> {
          entityManager.deleteColumnsInUpstreamLineage(indexName, columnsToDelete);
        });

    Thread.sleep(1000);

    GetResponse<Map> table1Response =
        client.get(g -> g.index(actualIndexName).id("table-1"), Map.class);
    List<Map<String, Object>> upstreamLineage1 =
        (List<Map<String, Object>>) table1Response.source().get("upstreamLineage");
    assertNotNull(upstreamLineage1);
    assertEquals(1, upstreamLineage1.size());

    List<Map<String, Object>> columns1 =
        (List<Map<String, Object>>) upstreamLineage1.get(0).get("columns");
    assertNotNull(columns1);
    assertEquals(1, columns1.size());

    List<String> fromColumns1 = (List<String>) columns1.get(0).get("fromColumns");
    assertFalse(fromColumns1.contains("source.schema.table.column1"));
    assertTrue(fromColumns1.contains("source.schema.table.column2"));

    GetResponse<Map> table2Response =
        client.get(g -> g.index(actualIndexName).id("table-2"), Map.class);
    List<Map<String, Object>> upstreamLineage2 =
        (List<Map<String, Object>>) table2Response.source().get("upstreamLineage");
    assertNotNull(upstreamLineage2);

    List<Map<String, Object>> columns2 =
        (List<Map<String, Object>>) upstreamLineage2.get(0).get("columns");
    assertNotNull(columns2);
    assertEquals(0, columns2.size());
  }

  @Test
  void testUpdateGlossaryTermByFqnPrefix() throws Exception {
    String indexName = testIndexPrefix + "_glossary_update_test";

    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);

    createTestIndex(actualIndexName);

    String term1Doc =
        """
        {
          "id": "term-1",
          "name": "Marketing Term 1",
          "fullyQualifiedName": "Glossary.Marketing.MarketingTerm1",
          "entityType": "glossaryTerm",
          "tags": [
            {
              "tagFQN": "Glossary.Marketing.OldTag",
              "labelType": "Manual",
              "source": "Glossary"
            },
            {
              "tagFQN": "Glossary.Marketing.AnotherTag",
              "labelType": "Manual",
              "source": "Glossary"
            }
          ]
        }
        """;

    String term2Doc =
        """
        {
          "id": "term-2",
          "name": "Sales Term 1",
          "fullyQualifiedName": "Glossary.Sales.SalesTerm1",
          "entityType": "glossaryTerm",
          "tags": [
            {
              "tagFQN": "Glossary.Marketing.OldTag",
              "labelType": "Manual",
              "source": "Glossary"
            },
            {
              "tagFQN": "Glossary.Sales.SalesTag",
              "labelType": "Manual",
              "source": "Glossary"
            }
          ]
        }
        """;

    String term3Doc =
        """
        {
          "id": "term-3",
          "name": "Marketing Term 2",
          "fullyQualifiedName": "Glossary.Marketing.MarketingTerm2",
          "entityType": "glossaryTerm",
          "tags": [
            {
              "tagFQN": "Glossary.Finance.FinanceTag",
              "labelType": "Manual",
              "source": "Classification"
            }
          ]
        }
        """;

    client.index(
        i ->
            i.index(actualIndexName)
                .id("term-1")
                .document(parseJson(term1Doc))
                .refresh(Refresh.True));
    client.index(
        i ->
            i.index(actualIndexName)
                .id("term-2")
                .document(parseJson(term2Doc))
                .refresh(Refresh.True));
    client.index(
        i ->
            i.index(actualIndexName)
                .id("term-3")
                .document(parseJson(term3Doc))
                .refresh(Refresh.True));

    Thread.sleep(1000);

    assertDoesNotThrow(
        () -> {
          entityManager.updateGlossaryTermByFqnPrefix(
              indexName, "Glossary.Marketing", "Glossary.NewMarketing", "fullyQualifiedName");
        });

    Thread.sleep(1000);

    GetResponse<Map> term1Response =
        client.get(g -> g.index(actualIndexName).id("term-1"), Map.class);
    List<Map<String, Object>> tags1 =
        (List<Map<String, Object>>) term1Response.source().get("tags");
    assertNotNull(tags1);
    assertEquals(2, tags1.size());
    boolean hasNewMarketingTag =
        tags1.stream().anyMatch(tag -> "Glossary.NewMarketing.OldTag".equals(tag.get("tagFQN")));
    assertTrue(hasNewMarketingTag);
    boolean hasAnotherTag =
        tags1.stream()
            .anyMatch(tag -> "Glossary.NewMarketing.AnotherTag".equals(tag.get("tagFQN")));
    assertTrue(hasAnotherTag);

    GetResponse<Map> term2Response =
        client.get(g -> g.index(actualIndexName).id("term-2"), Map.class);
    List<Map<String, Object>> tags2 =
        (List<Map<String, Object>>) term2Response.source().get("tags");
    assertNotNull(tags2);
    assertEquals(2, tags2.size());
    boolean hasOldMarketingTagInTerm2 =
        tags2.stream().anyMatch(tag -> "Glossary.Marketing.OldTag".equals(tag.get("tagFQN")));
    assertTrue(hasOldMarketingTagInTerm2);
    boolean hasSalesTag =
        tags2.stream().anyMatch(tag -> "Glossary.Sales.SalesTag".equals(tag.get("tagFQN")));
    assertTrue(hasSalesTag);

    GetResponse<Map> term3Response =
        client.get(g -> g.index(actualIndexName).id("term-3"), Map.class);
    List<Map<String, Object>> tags3 =
        (List<Map<String, Object>>) term3Response.source().get("tags");
    assertNotNull(tags3);
    assertEquals(1, tags3.size());
    assertEquals("Glossary.Finance.FinanceTag", tags3.get(0).get("tagFQN"));
  }

  @Test
  void testDeleteByRangeAndTerm() throws Exception {
    String indexName = testIndexPrefix + "_range_term_test";
    createTestIndex(indexName);

    long now = System.currentTimeMillis();
    for (int i = 1; i <= 6; i++) {
      final String docId = "range-term-test-" + i;
      final long timestamp = now - (i * 86400000L);
      final String entityType = i <= 3 ? "table" : "column";
      final String docJson =
          SAMPLE_ENTITY_JSON
              .replace("test-entity-1", docId)
              .replace("\"created\": \"2024-01-01T00:00:00.000Z\"", "\"created\": " + timestamp)
              .replace("\"entityType\": \"table\"", "\"entityType\": \"" + entityType + "\"");

      client.index(
          idx -> idx.index(indexName).id(docId).document(parseJson(docJson)).refresh(Refresh.True));
    }

    Thread.sleep(1000);

    SearchResponse<Map> beforeDelete =
        client.search(SearchRequest.of(s -> s.index(indexName).size(10)), Map.class);
    assertEquals(6, beforeDelete.hits().total().value());

    long threeDaysAgo = now - (3 * 86400000L);

    assertDoesNotThrow(
        () -> {
          entityManager.deleteByRangeAndTerm(
              indexName, "created", null, null, null, threeDaysAgo, "entityType", "table");
        });

    Thread.sleep(1000);

    SearchResponse<Map> afterDelete =
        client.search(SearchRequest.of(s -> s.index(indexName).size(10)), Map.class);

    assertEquals(5, afterDelete.hits().total().value());

    SearchResponse<Map> tableEntitiesLeft =
        client.search(
            SearchRequest.of(
                s ->
                    s.index(indexName)
                        .query(q -> q.term(t -> t.field("entityType").value("table")))),
            Map.class);

    assertEquals(2, tableEntitiesLeft.hits().total().value());
  }

  @Test
  void testReindexEntities_EmptyList() {
    List<org.openmetadata.schema.type.EntityReference> emptyList = new ArrayList<>();

    assertDoesNotThrow(
        () -> {
          entityManager.reindexEntities(emptyList);
        });
  }

  @Test
  void testReindexEntities_NullList() {
    assertDoesNotThrow(
        () -> {
          entityManager.reindexEntities(null);
        });
  }

  @Test
  void testGetSchemaEntityRelationship() throws Exception {
    String indexName = testIndexPrefix + "_schema_er_test";
    String schemaFqn = "service.database.schema";

    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);

    createTestIndex(actualIndexName);

    String table1Doc =
        """
        {
          "id": "table-1",
          "name": "Table 1",
          "fullyQualifiedName": "service.database.schema.table1",
          "entityType": "table",
          "deleted": false
        }
        """;

    String table2Doc =
        """
        {
          "id": "table-2",
          "name": "Table 2",
          "fullyQualifiedName": "service.database.schema.table2",
          "entityType": "table",
          "deleted": false
        }
        """;

    String table3Doc =
        """
        {
          "id": "table-3",
          "name": "Table 3",
          "fullyQualifiedName": "service.database.otherschema.table3",
          "entityType": "table",
          "deleted": false
        }
        """;

    client.index(
        i ->
            i.index(actualIndexName)
                .id("table-1")
                .document(parseJson(table1Doc))
                .refresh(Refresh.True));
    client.index(
        i ->
            i.index(actualIndexName)
                .id("table-2")
                .document(parseJson(table2Doc))
                .refresh(Refresh.True));
    client.index(
        i ->
            i.index(actualIndexName)
                .id("table-3")
                .document(parseJson(table3Doc))
                .refresh(Refresh.True));

    Thread.sleep(1000);

    SearchSchemaEntityRelationshipResult result =
        entityManager.getSchemaEntityRelationship(schemaFqn, null, null, 0, 10, 0, 10, false);

    assertNotNull(result);
    assertNotNull(result.getData());
    assertNotNull(result.getPaging());
    assertEquals(0, result.getPaging().getOffset());
    assertEquals(10, result.getPaging().getLimit());
  }

  @Test
  void testGetSchemaEntityRelationship_WithPagination() throws Exception {
    String indexName = testIndexPrefix + "_schema_er_pagination_test";
    String schemaFqn = "service.database.testschema";

    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);

    createTestIndex(actualIndexName);

    for (int i = 1; i <= 5; i++) {
      final String tableId = "table-" + i;
      final String tableFqn = "service.database.testschema.table" + i;
      final String tableDoc =
          String.format(
              """
              {
                "id": "%s",
                "name": "Table %d",
                "fullyQualifiedName": "%s",
                "entityType": "table",
                "deleted": false
              }
              """,
              tableId, i, tableFqn);

      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id(tableId)
                  .document(parseJson(tableDoc))
                  .refresh(Refresh.True));
    }

    Thread.sleep(1000);

    SearchSchemaEntityRelationshipResult result =
        entityManager.getSchemaEntityRelationship(schemaFqn, null, null, 0, 2, 0, 10, false);

    assertNotNull(result);
    assertNotNull(result.getPaging());
    assertEquals(0, result.getPaging().getOffset());
    assertEquals(2, result.getPaging().getLimit());
  }

  @Test
  void testGetSchemaEntityRelationship_EmptyResults() throws Exception {
    String indexName = testIndexPrefix + "_schema_er_empty_test";
    String schemaFqn = "service.database.nonexistent";

    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);

    createTestIndex(actualIndexName);

    Thread.sleep(500);

    SearchSchemaEntityRelationshipResult result =
        entityManager.getSchemaEntityRelationship(schemaFqn, null, null, 0, 10, 0, 10, false);

    assertNotNull(result);
    assertNotNull(result.getData());
    assertNotNull(result.getPaging());
    assertEquals(0, result.getPaging().getTotal());
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
                                  .properties(
                                      "name",
                                      p ->
                                          p.text(
                                              t -> t.fields("keyword", f -> f.keyword(kw -> kw))))
                                  .properties("description", p -> p.text(t -> t))
                                  .properties("fullyQualifiedName", p -> p.keyword(k -> k))
                                  .properties("entityType", p -> p.keyword(k -> k))
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
      return objectMapper.readValue(json, new TypeReference<>() {});
    } catch (Exception e) {
      throw new RuntimeException("Failed to parse JSON: " + json, e);
    }
  }
}
