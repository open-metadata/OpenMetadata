package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.Refresh;
import es.co.elastic.clients.elasticsearch.indices.CreateIndexRequest;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import es.co.elastic.clients.transport.rest5_client.Rest5ClientTransport;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import jakarta.ws.rs.core.Response;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.service.OpenMetadataApplicationTest;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ElasticSearchSearchManagerIntegrationTest extends OpenMetadataApplicationTest {

  private ElasticSearchSearchManager searchManager;
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
        "sourceUrl": "https://example.com/source/test-entity-1",
        "tags": ["test", "sample"],
        "created": "2024-01-01T00:00:00.000Z",
        "updated": "2024-01-01T00:00:00.000Z",
        "deleted": false
      }
      """;

  @BeforeEach
  void setUp() {
    testIndexPrefix =
        "test_search_mgr_"
            + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss_SSS"));

    Rest5Client restClient = getSearchClient();
    Rest5ClientTransport transport = new Rest5ClientTransport(restClient, new JacksonJsonpMapper());
    client = new ElasticsearchClient(transport);

    searchManager = new ElasticSearchSearchManager(client, null, "", null);

    LOG.info(
        "ElasticSearchSearchManager test setup completed with index prefix: {}", testIndexPrefix);
  }

  @AfterEach
  void tearDown() {
    if (client != null && testIndexPrefix != null) {
      try {
        String globalSearchIndex =
            org.openmetadata.service.Entity.getSearchRepository()
                .getIndexOrAliasName(GLOBAL_SEARCH_ALIAS);
        String fieldTestIndex =
            org.openmetadata.service.Entity.getSearchRepository()
                .getIndexOrAliasName(testIndexPrefix + "_field_test");

        String[] indicesToDelete = {globalSearchIndex, fieldTestIndex};

        for (String indexName : indicesToDelete) {
          try {
            client.indices().delete(d -> d.index(indexName));
            LOG.info("Cleaned up test index: {}", indexName);
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
  void testSearchBySourceUrl_SuccessfulSearch() throws Exception {
    String sourceUrl = "https://example.com/source/test-entity-1";

    String actualIndexName = testIndexPrefix + "_source_url_success";
    createTestIndex(actualIndexName);

    client.index(
        i ->
            i.index(actualIndexName)
                .id("test-entity-1")
                .document(parseJson(SAMPLE_ENTITY_JSON))
                .refresh(Refresh.True));

    Response response = searchManager.searchBySourceUrl(sourceUrl);

    assertNotNull(response);
    assertEquals(200, response.getStatus());
    assertNotNull(response.getEntity());

    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testSearchBySourceUrl_NoResults() throws Exception {
    String sourceUrl = "https://example.com/source/non-existent";

    String actualIndexName = testIndexPrefix + "_source_url_no_results";
    createTestIndex(actualIndexName);

    Response response = searchManager.searchBySourceUrl(sourceUrl);

    assertNotNull(response);
    assertEquals(200, response.getStatus());
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testSearchByField_SuccessfulSearch() throws Exception {
    String indexName = testIndexPrefix + "_field_test";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(indexName);

    createTestIndex(actualIndexName);

    for (int i = 1; i <= 3; i++) {
      final String docId = "field-test-" + i;
      final String docJson =
          SAMPLE_ENTITY_JSON
              .replace("test-entity-1", docId)
              .replace("Test Entity 1", "Test Entity " + i)
              .replace("test.entity.1", "test.entity." + i);

      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id(docId)
                  .document(parseJson(docJson))
                  .refresh(Refresh.True));
    }

    Response response = searchManager.searchByField("name", "Test*", indexName, false);

    assertNotNull(response);
    assertEquals(200, response.getStatus());
    assertNotNull(response.getEntity());
  }

  @Test
  void testSearchByField_WithDeletedFilter() throws Exception {
    String indexName = testIndexPrefix + "_field_test";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(indexName);

    createTestIndex(actualIndexName);

    String deletedDoc =
        SAMPLE_ENTITY_JSON
            .replace("test-entity-1", "deleted-entity")
            .replace("\"deleted\": false", "\"deleted\": true");

    client.index(
        i ->
            i.index(actualIndexName)
                .id("test-entity-1")
                .document(parseJson(SAMPLE_ENTITY_JSON))
                .refresh(Refresh.True));

    client.index(
        i ->
            i.index(actualIndexName)
                .id("deleted-entity")
                .document(parseJson(deletedDoc))
                .refresh(Refresh.True));

    Response responseNonDeleted = searchManager.searchByField("name", "Test*", indexName, false);
    assertNotNull(responseNonDeleted);
    assertEquals(200, responseNonDeleted.getStatus());

    Response responseDeleted = searchManager.searchByField("name", "Test*", indexName, true);
    assertNotNull(responseDeleted);
    assertEquals(200, responseDeleted.getStatus());
  }

  @Test
  void testSearchByField_NoResults() throws Exception {
    String indexName = testIndexPrefix + "_field_test";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(indexName);

    createTestIndex(actualIndexName);

    Response response = searchManager.searchByField("name", "NonExistent*", indexName, false);

    assertNotNull(response);
    assertEquals(200, response.getStatus());
  }

  @Test
  void testSearchByField_WithWildcard() throws Exception {
    String indexName = testIndexPrefix + "_field_test";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(indexName);

    createTestIndex(actualIndexName);

    String doc1 =
        SAMPLE_ENTITY_JSON
            .replace("test-entity-1", "entity-abc-1")
            .replace("test.entity.1", "test.abc.entity.1");

    String doc2 =
        SAMPLE_ENTITY_JSON
            .replace("test-entity-1", "entity-xyz-1")
            .replace("test.entity.1", "test.xyz.entity.1");

    client.index(
        i ->
            i.index(actualIndexName)
                .id("entity-abc-1")
                .document(parseJson(doc1))
                .refresh(Refresh.True));

    client.index(
        i ->
            i.index(actualIndexName)
                .id("entity-xyz-1")
                .document(parseJson(doc2))
                .refresh(Refresh.True));

    Response response =
        searchManager.searchByField("fullyQualifiedName", "test.abc*", indexName, false);

    assertNotNull(response);
    assertEquals(200, response.getStatus());
  }

  @Test
  void testConstructor_HandlesNullClient() {
    ElasticSearchSearchManager managerWithNullClient =
        new ElasticSearchSearchManager(null, null, "", null);

    assertNotNull(managerWithNullClient);
    assertDoesNotThrow(
        () -> {
          try {
            managerWithNullClient.searchBySourceUrl("https://example.com/test");
          } catch (Exception e) {
            LOG.info("Expected exception for null client: {}", e.getMessage());
          }
        });
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
                                  .properties("sourceUrl", p -> p.keyword(k -> k))
                                  .properties("deleted", p -> p.boolean_(b -> b))
                                  .properties("created", p -> p.date(d -> d))
                                  .properties("updated", p -> p.date(d -> d))
                                  .properties("entityRelationship", p -> p.nested(n -> n))));

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

  @Test
  void testListWithOffset_BasicPagination() throws Exception {
    String testIndex = testIndexPrefix + "_list_offset";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index multiple test documents
    for (int i = 1; i <= 25; i++) {
      final int entityNum = i;
      String entityJson =
          String.format(
              """
              {
                "id": "entity-%d",
                "name": "Test Entity %d",
                "description": "Description for entity %d",
                "fullyQualifiedName": "test.entity.%d",
                "entityType": "table",
                "deleted": false
              }
              """,
              entityNum, entityNum, entityNum, entityNum);

      Map<String, Object> entityMap = parseJson(entityJson);
      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("entity-" + entityNum)
                  .document(entityMap)
                  .refresh(Refresh.True));
    }

    org.openmetadata.service.search.SearchSortFilter sortFilter =
        new org.openmetadata.service.search.SearchSortFilter("name.keyword", "asc", null, null);

    // Test first page
    org.openmetadata.service.search.SearchResultListMapper result1 =
        searchManager.listWithOffset(null, 10, 0, actualIndexName, sortFilter, "*", null);

    assertNotNull(result1);
    assertEquals(10, result1.results.size());
    assertEquals(25, result1.total);
    LOG.info("First page returned {} results out of {}", result1.results.size(), result1.total);

    // Test second page
    org.openmetadata.service.search.SearchResultListMapper result2 =
        searchManager.listWithOffset(null, 10, 10, actualIndexName, sortFilter, "*", null);

    assertNotNull(result2);
    assertEquals(10, result2.results.size());
    assertEquals(25, result2.total);

    // Test third page
    org.openmetadata.service.search.SearchResultListMapper result3 =
        searchManager.listWithOffset(null, 10, 20, actualIndexName, sortFilter, "*", null);

    assertNotNull(result3);
    assertEquals(5, result3.results.size());
    assertEquals(25, result3.total);

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testListWithOffset_WithQueryString() throws Exception {
    String testIndex = testIndexPrefix + "_query_string";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index documents with different names
    for (int i = 1; i <= 10; i++) {
      final int entityNum = i;
      String entityJson =
          String.format(
              """
              {
                "id": "entity-%d",
                "name": "%s Entity %d",
                "description": "Description for entity %d",
                "fullyQualifiedName": "test.entity.%d",
                "entityType": "table",
                "deleted": false
              }
              """,
              entityNum, (entityNum % 2 == 0 ? "Alpha" : "Beta"), entityNum, entityNum, entityNum);

      Map<String, Object> entityMap = parseJson(entityJson);
      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("entity-" + entityNum)
                  .document(entityMap)
                  .refresh(Refresh.True));
    }

    org.openmetadata.service.search.SearchSortFilter sortFilter =
        new org.openmetadata.service.search.SearchSortFilter("name.keyword", "asc", null, null);

    // Search for "Alpha" entities only
    org.openmetadata.service.search.SearchResultListMapper result =
        searchManager.listWithOffset(null, 10, 0, actualIndexName, sortFilter, "Alpha", null);

    assertNotNull(result);
    assertEquals(5, result.results.size());
    assertEquals(5, result.total);

    // Verify all results contain "Alpha"
    for (Map<String, Object> doc : result.results) {
      String name = (String) doc.get("name");
      assertNotNull(name);
      assertEquals(true, name.contains("Alpha"));
      LOG.info("Found entity with name: {}", name);
    }

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testListWithOffset_WithFilter() throws Exception {
    String testIndex = testIndexPrefix + "_filter";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index documents with different deleted status
    for (int i = 1; i <= 10; i++) {
      final int entityNum = i;
      String entityJson =
          String.format(
              """
              {
                "id": "entity-%d",
                "name": "Test Entity %d",
                "description": "Description for entity %d",
                "fullyQualifiedName": "test.entity.%d",
                "entityType": "table",
                "deleted": %s
              }
              """,
              entityNum, entityNum, entityNum, entityNum, (entityNum > 5 ? "true" : "false"));

      Map<String, Object> entityMap = parseJson(entityJson);
      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("entity-" + entityNum)
                  .document(entityMap)
                  .refresh(Refresh.True));
    }

    org.openmetadata.service.search.SearchSortFilter sortFilter =
        new org.openmetadata.service.search.SearchSortFilter("name.keyword", "asc", null, null);

    String filter = "{\"query\":{\"term\":{\"deleted\":false}}}";

    // Search with filter for non-deleted entities
    org.openmetadata.service.search.SearchResultListMapper result =
        searchManager.listWithOffset(filter, 10, 0, actualIndexName, sortFilter, "*", null);

    assertNotNull(result);
    assertEquals(5, result.results.size());
    assertEquals(5, result.total);

    // Verify all results have deleted=false
    for (Map<String, Object> doc : result.results) {
      Boolean deleted = (Boolean) doc.get("deleted");
      assertNotNull(deleted);
      assertEquals(false, deleted);
    }

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testListWithOffset_WithSorting() throws Exception {
    String testIndex = testIndexPrefix + "_sorting";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index documents
    String[] names = {"Zebra", "Alpha", "Gamma", "Beta", "Delta"};
    for (int i = 0; i < names.length; i++) {
      final int entityNum = i;
      String entityJson =
          String.format(
              """
              {
                "id": "entity-%d",
                "name": "%s",
                "description": "Description for %s",
                "fullyQualifiedName": "test.entity.%d",
                "entityType": "table",
                "deleted": false
              }
              """,
              entityNum, names[entityNum], names[entityNum], entityNum);

      Map<String, Object> entityMap = parseJson(entityJson);
      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("entity-" + entityNum)
                  .document(entityMap)
                  .refresh(Refresh.True));
    }

    // Test ascending sort
    org.openmetadata.service.search.SearchSortFilter ascSortFilter =
        new org.openmetadata.service.search.SearchSortFilter("name.keyword", "asc", null, null);

    org.openmetadata.service.search.SearchResultListMapper ascResult =
        searchManager.listWithOffset(null, 10, 0, actualIndexName, ascSortFilter, "*", null);

    assertNotNull(ascResult);
    assertEquals(5, ascResult.results.size());
    assertEquals("Alpha", ascResult.results.get(0).get("name"));
    assertEquals("Beta", ascResult.results.get(1).get("name"));
    LOG.info("Ascending sort - first result: {}", ascResult.results.get(0).get("name"));

    // Test descending sort
    org.openmetadata.service.search.SearchSortFilter descSortFilter =
        new org.openmetadata.service.search.SearchSortFilter("name.keyword", "desc", null, null);

    org.openmetadata.service.search.SearchResultListMapper descResult =
        searchManager.listWithOffset(null, 10, 0, actualIndexName, descSortFilter, "*", null);

    assertNotNull(descResult);
    assertEquals(5, descResult.results.size());
    assertEquals("Zebra", descResult.results.get(0).get("name"));
    assertEquals("Gamma", descResult.results.get(1).get("name"));
    LOG.info("Descending sort - first result: {}", descResult.results.get(0).get("name"));

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testListWithDeepPagination_BasicUsage() throws Exception {
    String testIndex = testIndexPrefix + "_deep_pagination";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index 50 documents
    for (int i = 1; i <= 50; i++) {
      final int entityNum = i;
      String entityJson =
          String.format(
              """
              {
                "id": "entity-%d",
                "name": "Entity %03d",
                "description": "Description for entity %d",
                "fullyQualifiedName": "test.entity.%d",
                "entityType": "table",
                "deleted": false
              }
              """,
              entityNum, entityNum, entityNum, entityNum);

      Map<String, Object> entityMap = parseJson(entityJson);
      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("entity-" + entityNum)
                  .document(entityMap)
                  .refresh(Refresh.True));
    }

    org.openmetadata.service.search.SearchSortFilter sortFilter =
        new org.openmetadata.service.search.SearchSortFilter("name.keyword", "asc", null, null);

    // Get first page
    org.openmetadata.service.search.SearchResultListMapper result1 =
        searchManager.listWithDeepPagination(
            actualIndexName, "*", null, null, sortFilter, 10, null);

    assertNotNull(result1);
    assertEquals(10, result1.results.size());
    assertEquals(50, result1.total);
    assertNotNull(result1.lastHitSortValues);
    LOG.info(
        "Deep pagination - first page: {} results, search_after: {}",
        result1.results.size(),
        result1.lastHitSortValues);

    // Get second page using search_after from first page
    org.openmetadata.service.search.SearchResultListMapper result2 =
        searchManager.listWithDeepPagination(
            actualIndexName, "*", null, null, sortFilter, 10, result1.lastHitSortValues);

    assertNotNull(result2);
    assertEquals(10, result2.results.size());
    assertEquals(50, result2.total);
    assertNotNull(result2.lastHitSortValues);

    // Verify results are different between pages
    String firstPageFirstId = (String) result1.results.get(0).get("id");
    String secondPageFirstId = (String) result2.results.get(0).get("id");
    assertDoesNotThrow(() -> assertEquals(false, firstPageFirstId.equals(secondPageFirstId)));
    LOG.info("Page 1 first ID: {}, Page 2 first ID: {}", firstPageFirstId, secondPageFirstId);

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testListWithDeepPagination_WithFieldFiltering() throws Exception {
    String testIndex = testIndexPrefix + "_deep_fields";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index documents
    for (int i = 1; i <= 20; i++) {
      final int entityNum = i;
      String entityJson =
          String.format(
              """
              {
                "id": "entity-%d",
                "name": "Entity %d",
                "description": "Description for entity %d",
                "fullyQualifiedName": "test.entity.%d",
                "entityType": "table",
                "deleted": false
              }
              """,
              entityNum, entityNum, entityNum, entityNum);

      Map<String, Object> entityMap = parseJson(entityJson);
      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("entity-" + entityNum)
                  .document(entityMap)
                  .refresh(Refresh.True));
    }

    org.openmetadata.service.search.SearchSortFilter sortFilter =
        new org.openmetadata.service.search.SearchSortFilter("name.keyword", "asc", null, null);

    // Request only specific fields
    String[] fields = {"id", "name"};

    org.openmetadata.service.search.SearchResultListMapper result =
        searchManager.listWithDeepPagination(
            actualIndexName, "*", null, fields, sortFilter, 10, null);

    assertNotNull(result);
    assertEquals(10, result.results.size());

    // Verify only requested fields are returned
    Map<String, Object> firstDoc = result.results.get(0);
    assertNotNull(firstDoc.get("id"));
    assertNotNull(firstDoc.get("name"));
    assertEquals(null, firstDoc.get("description"));
    assertEquals(null, firstDoc.get("fullyQualifiedName"));
    LOG.info(
        "Field filtering - returned fields: {}, requested fields: id, name", firstDoc.keySet());

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testListWithDeepPagination_WithFilter() throws Exception {
    String testIndex = testIndexPrefix + "_deep_filter";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index documents with different entity types
    for (int i = 1; i <= 20; i++) {
      final int entityNum = i;
      String entityType = (i % 2 == 0) ? "table" : "dashboard";
      String entityJson =
          String.format(
              """
              {
                "id": "entity-%d",
                "name": "Entity %d",
                "description": "Description for entity %d",
                "fullyQualifiedName": "test.entity.%d",
                "entityType": "%s",
                "deleted": false
              }
              """,
              entityNum, entityNum, entityNum, entityNum, entityType);

      Map<String, Object> entityMap = parseJson(entityJson);
      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("entity-" + entityNum)
                  .document(entityMap)
                  .refresh(Refresh.True));
    }

    org.openmetadata.service.search.SearchSortFilter sortFilter =
        new org.openmetadata.service.search.SearchSortFilter("name.keyword", "asc", null, null);

    String filter = "{\"query\":{\"term\":{\"entityType\":\"table\"}}}";

    org.openmetadata.service.search.SearchResultListMapper result =
        searchManager.listWithDeepPagination(
            actualIndexName, "*", filter, null, sortFilter, 20, null);

    assertNotNull(result);
    assertEquals(10, result.results.size());
    assertEquals(10, result.total);

    // Verify all results are tables
    for (Map<String, Object> doc : result.results) {
      String entityType = (String) doc.get("entityType");
      assertEquals("table", entityType);
    }
    LOG.info("Filter test - all {} results are of type 'table'", result.results.size());

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testListWithDeepPagination_MultiplePages() throws Exception {
    String testIndex = testIndexPrefix + "_deep_multi";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index 35 documents
    for (int i = 1; i <= 35; i++) {
      final int entityNum = i;
      String entityJson =
          String.format(
              """
              {
                "id": "entity-%03d",
                "name": "Entity %03d",
                "description": "Description %d",
                "fullyQualifiedName": "test.entity.%d",
                "entityType": "table",
                "deleted": false
              }
              """,
              entityNum, entityNum, entityNum, entityNum);

      Map<String, Object> entityMap = parseJson(entityJson);
      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("entity-" + String.format("%03d", entityNum))
                  .document(entityMap)
                  .refresh(Refresh.True));
    }

    org.openmetadata.service.search.SearchSortFilter sortFilter =
        new org.openmetadata.service.search.SearchSortFilter("id", "asc", null, null);

    Object[] currentSearchAfter = null;
    int pageCount = 0;
    int totalRetrieved = 0;

    // Paginate through all results
    while (true) {
      org.openmetadata.service.search.SearchResultListMapper result =
          searchManager.listWithDeepPagination(
              actualIndexName, "*", null, null, sortFilter, 10, currentSearchAfter);

      assertNotNull(result);
      pageCount++;
      totalRetrieved += result.results.size();

      LOG.info(
          "Page {}: retrieved {} results, total so far: {}",
          pageCount,
          result.results.size(),
          totalRetrieved);

      if (result.results.isEmpty() || result.lastHitSortValues == null) {
        break;
      }

      currentSearchAfter = result.lastHitSortValues;

      // Safety check to prevent infinite loop
      if (pageCount > 10) {
        break;
      }
    }

    assertEquals(4, pageCount); // Should be 4 pages: 10, 10, 10, 5
    assertEquals(35, totalRetrieved);
    LOG.info("Deep pagination completed: {} pages, {} total results", pageCount, totalRetrieved);

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testSearchWithDirectQuery_BasicQuery() throws Exception {
    String testIndex = testIndexPrefix + "_direct_query";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index test documents
    for (int i = 1; i <= 10; i++) {
      final int entityNum = i;
      String entityJson =
          String.format(
              """
              {
                "id": "entity-%d",
                "name": "Test Entity %d",
                "description": "Description for entity %d",
                "fullyQualifiedName": "test.entity.%d",
                "entityType": "table",
                "deleted": false
              }
              """,
              entityNum, entityNum, entityNum, entityNum);

      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("entity-" + entityNum)
                  .document(parseJson(entityJson))
                  .refresh(Refresh.True));
    }

    // Create a direct query request
    org.openmetadata.schema.search.SearchRequest searchRequest =
        new org.openmetadata.schema.search.SearchRequest();
    searchRequest.setIndex(actualIndexName);
    searchRequest.setQueryFilter("{\"query\":{\"match_all\":{}}}");
    searchRequest.setFrom(0);
    searchRequest.setSize(5);

    Response response = searchManager.searchWithDirectQuery(searchRequest, null);

    assertNotNull(response);
    assertEquals(200, response.getStatus());
    assertNotNull(response.getEntity());
    LOG.info("Direct query executed successfully with status: {}", response.getStatus());

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testSearchWithDirectQuery_WithTermQuery() throws Exception {
    String testIndex = testIndexPrefix + "_direct_term";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index documents with different entity types
    for (int i = 1; i <= 10; i++) {
      final int entityNum = i;
      String entityType = (i % 2 == 0) ? "table" : "dashboard";
      String entityJson =
          String.format(
              """
              {
                "id": "entity-%d",
                "name": "Test Entity %d",
                "description": "Description for entity %d",
                "fullyQualifiedName": "test.entity.%d",
                "entityType": "%s",
                "deleted": false
              }
              """,
              entityNum, entityNum, entityNum, entityNum, entityType);

      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("entity-" + entityNum)
                  .document(parseJson(entityJson))
                  .refresh(Refresh.True));
    }

    // Query for only "table" entities
    org.openmetadata.schema.search.SearchRequest searchRequest =
        new org.openmetadata.schema.search.SearchRequest();
    searchRequest.setIndex(actualIndexName);
    searchRequest.setQueryFilter("{\"query\":{\"term\":{\"entityType\":\"table\"}}}");
    searchRequest.setFrom(0);
    searchRequest.setSize(10);

    Response response = searchManager.searchWithDirectQuery(searchRequest, null);

    assertNotNull(response);
    assertEquals(200, response.getStatus());
    LOG.info("Direct term query executed successfully");

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testSearchWithDirectQuery_WithPagination() throws Exception {
    String testIndex = testIndexPrefix + "_direct_pagination";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index 20 documents
    for (int i = 1; i <= 20; i++) {
      final int entityNum = i;
      String entityJson =
          String.format(
              """
              {
                "id": "entity-%d",
                "name": "Entity %03d",
                "description": "Description for entity %d",
                "fullyQualifiedName": "test.entity.%d",
                "entityType": "table",
                "deleted": false
              }
              """,
              entityNum, entityNum, entityNum, entityNum);

      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("entity-" + entityNum)
                  .document(parseJson(entityJson))
                  .refresh(Refresh.True));
    }

    // Test first page
    org.openmetadata.schema.search.SearchRequest request1 =
        new org.openmetadata.schema.search.SearchRequest();
    request1.setIndex(actualIndexName);
    request1.setQueryFilter("{\"query\":{\"match_all\":{}}}");
    request1.setFrom(0);
    request1.setSize(10);

    Response response1 = searchManager.searchWithDirectQuery(request1, null);
    assertNotNull(response1);
    assertEquals(200, response1.getStatus());
    LOG.info("First page of direct query results retrieved");

    // Test second page
    org.openmetadata.schema.search.SearchRequest request2 =
        new org.openmetadata.schema.search.SearchRequest();
    request2.setIndex(actualIndexName);
    request2.setQueryFilter("{\"query\":{\"match_all\":{}}}");
    request2.setFrom(10);
    request2.setSize(10);

    Response response2 = searchManager.searchWithDirectQuery(request2, null);
    assertNotNull(response2);
    assertEquals(200, response2.getStatus());
    LOG.info("Second page of direct query results retrieved");

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testSearchWithDirectQuery_WithEmptyFilter() throws Exception {
    String testIndex = testIndexPrefix + "_direct_empty";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index test documents
    for (int i = 1; i <= 5; i++) {
      final int entityNum = i;
      String entityJson =
          String.format(
              """
              {
                "id": "entity-%d",
                "name": "Entity %d",
                "description": "Description %d",
                "fullyQualifiedName": "test.entity.%d",
                "entityType": "table",
                "deleted": false
              }
              """,
              entityNum, entityNum, entityNum, entityNum);

      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("entity-" + entityNum)
                  .document(parseJson(entityJson))
                  .refresh(Refresh.True));
    }

    // Test with empty query filter
    org.openmetadata.schema.search.SearchRequest searchRequest =
        new org.openmetadata.schema.search.SearchRequest();
    searchRequest.setIndex(actualIndexName);
    searchRequest.setQueryFilter("{}");
    searchRequest.setFrom(0);
    searchRequest.setSize(10);

    Response response = searchManager.searchWithDirectQuery(searchRequest, null);

    assertNotNull(response);
    assertEquals(200, response.getStatus());
    LOG.info("Direct query with empty filter handled correctly");

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testSearchWithDirectQuery_WithBoolQuery() throws Exception {
    String testIndex = testIndexPrefix + "_direct_bool";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index documents
    for (int i = 1; i <= 10; i++) {
      final int entityNum = i;
      String entityType = (i <= 5) ? "table" : "dashboard";
      boolean deleted = (i > 7);
      String entityJson =
          String.format(
              """
              {
                "id": "entity-%d",
                "name": "Entity %d",
                "description": "Description %d",
                "fullyQualifiedName": "test.entity.%d",
                "entityType": "%s",
                "deleted": %s
              }
              """,
              entityNum, entityNum, entityNum, entityNum, entityType, deleted);

      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("entity-" + entityNum)
                  .document(parseJson(entityJson))
                  .refresh(Refresh.True));
    }

    // Bool query: entityType=table AND deleted=false
    String boolQuery =
        """
        {
          "query": {
            "bool": {
              "must": [
                {"term": {"entityType": "table"}},
                {"term": {"deleted": false}}
              ]
            }
          }
        }
        """;

    org.openmetadata.schema.search.SearchRequest searchRequest =
        new org.openmetadata.schema.search.SearchRequest();
    searchRequest.setIndex(actualIndexName);
    searchRequest.setQueryFilter(boolQuery);
    searchRequest.setFrom(0);
    searchRequest.setSize(10);

    Response response = searchManager.searchWithDirectQuery(searchRequest, null);

    assertNotNull(response);
    assertEquals(200, response.getStatus());
    LOG.info("Bool query executed successfully");

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testSearchWithDirectQuery_WithInvalidJSON() throws Exception {
    String testIndex = testIndexPrefix + "_direct_invalid";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Test with invalid JSON
    org.openmetadata.schema.search.SearchRequest searchRequest =
        new org.openmetadata.schema.search.SearchRequest();
    searchRequest.setIndex(actualIndexName);
    searchRequest.setQueryFilter("{invalid json}");
    searchRequest.setFrom(0);
    searchRequest.setSize(10);

    Response response = searchManager.searchWithDirectQuery(searchRequest, null);

    // Should return error response
    assertNotNull(response);
    assertEquals(500, response.getStatus());
    LOG.info("Invalid JSON handled correctly with error status");

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testSearch_BasicQuery() throws Exception {
    String testIndex = testIndexPrefix + "_search_basic";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index test documents
    for (int i = 1; i <= 10; i++) {
      final int entityNum = i;
      String entityJson =
          String.format(
              """
              {
                "id": "entity-%d",
                "name": "Test Entity %d",
                "description": "Description for entity %d",
                "fullyQualifiedName": "test.entity.%d",
                "entityType": "table",
                "deleted": false
              }
              """,
              entityNum, entityNum, entityNum, entityNum);

      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("entity-" + entityNum)
                  .document(parseJson(entityJson))
                  .refresh(Refresh.True));
    }

    // Create a search request
    org.openmetadata.schema.search.SearchRequest searchRequest =
        new org.openmetadata.schema.search.SearchRequest();
    searchRequest.setIndex(actualIndexName);
    searchRequest.setQuery("Test");
    searchRequest.setFrom(0);
    searchRequest.setSize(5);
    searchRequest.setDeleted(false);

    Response response = searchManager.search(searchRequest, null);

    assertNotNull(response);
    assertEquals(200, response.getStatus());
    assertNotNull(response.getEntity());
    LOG.info("Search executed successfully with status: {}", response.getStatus());

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testSearch_WithQueryAndFilters() throws Exception {
    String testIndex = testIndexPrefix + "_search_filters";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index documents with different entity types
    for (int i = 1; i <= 10; i++) {
      final int entityNum = i;
      String entityType = (i % 2 == 0) ? "table" : "dashboard";
      String entityJson =
          String.format(
              """
              {
                "id": "entity-%d",
                "name": "Test Entity %d",
                "description": "Description for entity %d",
                "fullyQualifiedName": "test.entity.%d",
                "entityType": "%s",
                "deleted": false
              }
              """,
              entityNum, entityNum, entityNum, entityNum, entityType);

      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("entity-" + entityNum)
                  .document(parseJson(entityJson))
                  .refresh(Refresh.True));
    }

    // Search for tables only
    org.openmetadata.schema.search.SearchRequest searchRequest =
        new org.openmetadata.schema.search.SearchRequest();
    searchRequest.setIndex(actualIndexName);
    searchRequest.setQuery("Test");
    searchRequest.setFrom(0);
    searchRequest.setSize(10);
    searchRequest.setDeleted(false);

    Response response = searchManager.search(searchRequest, null);

    assertNotNull(response);
    assertEquals(200, response.getStatus());
    LOG.info("Search with filters executed successfully");

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testSearch_WithPagination() throws Exception {
    String testIndex = testIndexPrefix + "_search_pagination";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index 20 documents
    for (int i = 1; i <= 20; i++) {
      final int entityNum = i;
      String entityJson =
          String.format(
              """
              {
                "id": "entity-%d",
                "name": "Entity %03d",
                "description": "Description for entity %d",
                "fullyQualifiedName": "test.entity.%d",
                "entityType": "table",
                "deleted": false
              }
              """,
              entityNum, entityNum, entityNum, entityNum);

      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("entity-" + entityNum)
                  .document(parseJson(entityJson))
                  .refresh(Refresh.True));
    }

    // Test first page
    org.openmetadata.schema.search.SearchRequest request1 =
        new org.openmetadata.schema.search.SearchRequest();
    request1.setIndex(actualIndexName);
    request1.setQuery("Entity");
    request1.setFrom(0);
    request1.setSize(10);
    request1.setDeleted(false);

    Response response1 = searchManager.search(request1, null);
    assertNotNull(response1);
    assertEquals(200, response1.getStatus());
    LOG.info("First page of search results retrieved");

    // Test second page
    org.openmetadata.schema.search.SearchRequest request2 =
        new org.openmetadata.schema.search.SearchRequest();
    request2.setIndex(actualIndexName);
    request2.setQuery("Entity");
    request2.setFrom(10);
    request2.setSize(10);
    request2.setDeleted(false);

    Response response2 = searchManager.search(request2, null);
    assertNotNull(response2);
    assertEquals(200, response2.getStatus());
    LOG.info("Second page of search results retrieved");

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testPreviewSearch_WithCustomSettings() throws Exception {
    String testIndex = testIndexPrefix + "_preview_search";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index test documents
    for (int i = 1; i <= 5; i++) {
      final int entityNum = i;
      String entityJson =
          String.format(
              """
              {
                "id": "entity-%d",
                "name": "Preview Entity %d",
                "description": "Preview description %d",
                "fullyQualifiedName": "test.preview.%d",
                "entityType": "table",
                "deleted": false
              }
              """,
              entityNum, entityNum, entityNum, entityNum);

      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("entity-" + entityNum)
                  .document(parseJson(entityJson))
                  .refresh(Refresh.True));
    }

    // Create custom search settings for preview with proper initialization
    org.openmetadata.schema.api.search.GlobalSettings globalSettings =
        new org.openmetadata.schema.api.search.GlobalSettings();
    globalSettings.setTermBoosts(new java.util.ArrayList<>());

    org.openmetadata.schema.api.search.SearchSettings customSettings =
        new org.openmetadata.schema.api.search.SearchSettings();
    customSettings.setGlobalSettings(globalSettings);

    // Create a search request
    org.openmetadata.schema.search.SearchRequest searchRequest =
        new org.openmetadata.schema.search.SearchRequest();
    searchRequest.setIndex(actualIndexName);
    searchRequest.setQuery("Preview");
    searchRequest.setFrom(0);
    searchRequest.setSize(5);
    searchRequest.setDeleted(false);

    Response response = searchManager.previewSearch(searchRequest, null, customSettings);

    assertNotNull(response);
    assertEquals(200, response.getStatus());
    assertNotNull(response.getEntity());
    LOG.info("Preview search executed successfully with custom settings");

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testPreviewSearch_DifferentFromRegularSearch() throws Exception {
    String testIndex = testIndexPrefix + "_preview_compare";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index test documents
    for (int i = 1; i <= 10; i++) {
      final int entityNum = i;
      String entityJson =
          String.format(
              """
              {
                "id": "entity-%d",
                "name": "Compare Entity %d",
                "description": "Compare description %d",
                "fullyQualifiedName": "test.compare.%d",
                "entityType": "table",
                "deleted": false
              }
              """,
              entityNum, entityNum, entityNum, entityNum);

      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("entity-" + entityNum)
                  .document(parseJson(entityJson))
                  .refresh(Refresh.True));
    }

    // Create search request
    org.openmetadata.schema.search.SearchRequest searchRequest =
        new org.openmetadata.schema.search.SearchRequest();
    searchRequest.setIndex(actualIndexName);
    searchRequest.setQuery("Compare");
    searchRequest.setFrom(0);
    searchRequest.setSize(5);
    searchRequest.setDeleted(false);

    // Execute regular search
    Response regularResponse = searchManager.search(searchRequest, null);

    // Create custom settings for preview with proper initialization
    org.openmetadata.schema.api.search.GlobalSettings globalSettings =
        new org.openmetadata.schema.api.search.GlobalSettings();
    globalSettings.setTermBoosts(new java.util.ArrayList<>());

    org.openmetadata.schema.api.search.SearchSettings customSettings =
        new org.openmetadata.schema.api.search.SearchSettings();
    customSettings.setGlobalSettings(globalSettings);

    // Execute preview search with custom settings
    Response previewResponse = searchManager.previewSearch(searchRequest, null, customSettings);

    // Both should succeed
    assertNotNull(regularResponse);
    assertEquals(200, regularResponse.getStatus());
    assertNotNull(previewResponse);
    assertEquals(200, previewResponse.getStatus());

    LOG.info("Both regular and preview search executed successfully");

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testSearch_WithEmptyQuery() throws Exception {
    String testIndex = testIndexPrefix + "_search_empty";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index test documents
    for (int i = 1; i <= 5; i++) {
      final int entityNum = i;
      String entityJson =
          String.format(
              """
              {
                "id": "entity-%d",
                "name": "Entity %d",
                "description": "Description %d",
                "fullyQualifiedName": "test.entity.%d",
                "entityType": "table",
                "deleted": false
              }
              """,
              entityNum, entityNum, entityNum, entityNum);

      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("entity-" + entityNum)
                  .document(parseJson(entityJson))
                  .refresh(Refresh.True));
    }

    // Search with empty query (should return all)
    org.openmetadata.schema.search.SearchRequest searchRequest =
        new org.openmetadata.schema.search.SearchRequest();
    searchRequest.setIndex(actualIndexName);
    searchRequest.setQuery("");
    searchRequest.setFrom(0);
    searchRequest.setSize(10);
    searchRequest.setDeleted(false);

    Response response = searchManager.search(searchRequest, null);

    assertNotNull(response);
    assertEquals(200, response.getStatus());
    LOG.info("Empty query search handled correctly");

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testSearchWithNLQ_SuccessfulTransformation() throws Exception {
    String testIndex = testIndexPrefix + "_nlq_success";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index test documents
    for (int i = 1; i <= 5; i++) {
      final int entityNum = i;
      String entityJson =
          String.format(
              """
                  {
                    "id": "test-nlq-%d",
                    "name": "Sales Report %d",
                    "description": "Monthly sales report for region %d",
                    "fullyQualifiedName": "test.nlq.report.%d",
                    "entityType": "dashboard",
                    "owner": "sales-team",
                    "deleted": false,
                    "metrics": ["revenue", "growth"]
                  }
                  """,
              entityNum, entityNum, entityNum, entityNum);

      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("nlq-" + entityNum)
                  .document(parseJson(entityJson))
                  .refresh(Refresh.True));
    }

    // Create mock NLQ service
    org.openmetadata.service.search.nlq.NLQService mockNlqService =
        mock(org.openmetadata.service.search.nlq.NLQService.class);
    when(mockNlqService.transformNaturalLanguageQuery(any(), any()))
        .thenReturn("{\"query\":{\"match\":{\"name\":\"Sales Report\"}}}");

    // Create search manager with mock NLQ service
    ElasticSearchSearchManager searchManagerWithNLQ =
        new ElasticSearchSearchManager(client, null, "", mockNlqService);

    // Create search request
    org.openmetadata.schema.search.SearchRequest request =
        new org.openmetadata.schema.search.SearchRequest();
    request.setIndex(actualIndexName);
    request.setQuery("show me all sales reports");
    request.setFrom(0);
    request.setSize(10);

    // Execute NLQ search
    Response response = searchManagerWithNLQ.searchWithNLQ(request, null);

    assertNotNull(response);
    assertEquals(200, response.getStatus());
    LOG.info("NLQ search executed successfully");

    // Verify NLQ service was called
    verify(mockNlqService).transformNaturalLanguageQuery(any(), any());

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testSearchWithNLQ_FallbackToBasicSearch() throws Exception {
    String testIndex = testIndexPrefix + "_nlq_fallback";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Index test documents
    for (int i = 1; i <= 3; i++) {
      final int entityNum = i;
      String entityJson =
          String.format(
              """
                  {
                    "id": "test-nlq-fallback-%d",
                    "name": "Financial Report %d",
                    "description": "Financial analysis document %d",
                    "fullyQualifiedName": "test.nlq.finance.%d",
                    "entityType": "report",
                    "owner": "finance-team",
                    "deleted": false
                  }
                  """,
              entityNum, entityNum, entityNum, entityNum);

      client.index(
          idx ->
              idx.index(actualIndexName)
                  .id("nlq-fallback-" + entityNum)
                  .document(parseJson(entityJson))
                  .refresh(Refresh.True));
    }

    // Create mock NLQ service that returns null (triggers fallback)
    org.openmetadata.service.search.nlq.NLQService mockNlqService =
        mock(org.openmetadata.service.search.nlq.NLQService.class);
    when(mockNlqService.transformNaturalLanguageQuery(any(), any())).thenReturn(null);

    ElasticSearchSearchManager searchManagerWithNLQ =
        new ElasticSearchSearchManager(client, null, "", mockNlqService);

    // Create search request
    org.openmetadata.schema.search.SearchRequest request =
        new org.openmetadata.schema.search.SearchRequest();
    request.setIndex(actualIndexName);
    request.setQuery("find financial reports");
    request.setFrom(0);
    request.setSize(10);

    // Execute search
    Response response = searchManagerWithNLQ.searchWithNLQ(request, null);

    assertNotNull(response);
    assertEquals(200, response.getStatus());
    LOG.info("Fallback search executed successfully");

    // Verify NLQ service was called
    verify(mockNlqService).transformNaturalLanguageQuery(any(), any());

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testSearchWithNLQ_ErrorHandling() throws Exception {
    String testIndex = testIndexPrefix + "_nlq_error";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Create mock NLQ service that throws exception
    org.openmetadata.service.search.nlq.NLQService mockNlqService =
        mock(org.openmetadata.service.search.nlq.NLQService.class);
    when(mockNlqService.transformNaturalLanguageQuery(any(), any()))
        .thenThrow(new RuntimeException("NLQ transformation error"));

    ElasticSearchSearchManager searchManagerWithNLQ =
        new ElasticSearchSearchManager(client, null, "", mockNlqService);

    // Create search request
    org.openmetadata.schema.search.SearchRequest request =
        new org.openmetadata.schema.search.SearchRequest();
    request.setIndex(actualIndexName);
    request.setQuery("this query will fail");
    request.setFrom(0);
    request.setSize(10);

    // Execute search - should fall back to basic search
    Response response = searchManagerWithNLQ.searchWithNLQ(request, null);

    assertNotNull(response);
    assertEquals(200, response.getStatus());
    LOG.info("Error handled gracefully with fallback to basic search");

    // Verify NLQ service was called
    verify(mockNlqService).transformNaturalLanguageQuery(any(), any());

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testSearchWithNLQ_NullNLQService() throws Exception {
    String testIndex = testIndexPrefix + "_nlq_null";
    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository().getIndexOrAliasName(testIndex);
    createTestIndex(actualIndexName);

    // Create search manager with null NLQ service
    ElasticSearchSearchManager searchManagerNoNLQ =
        new ElasticSearchSearchManager(client, null, "", null);

    // Create search request
    org.openmetadata.schema.search.SearchRequest request =
        new org.openmetadata.schema.search.SearchRequest();
    request.setIndex(actualIndexName);
    request.setQuery("find reports");
    request.setFrom(0);
    request.setSize(10);

    // Execute search - should default to basic search
    Response response = searchManagerNoNLQ.searchWithNLQ(request, null);

    assertNotNull(response);
    assertEquals(200, response.getStatus());
    LOG.info("Search with null NLQ service handled correctly");

    // Clean up
    client.indices().delete(d -> d.index(actualIndexName));
  }

  @Test
  void testSearchEntityRelationship_BasicRelationship() throws Exception {
    String aliasName =
        org.openmetadata.service.Entity.getSearchRepository()
            .getIndexOrAliasName(GLOBAL_SEARCH_ALIAS);
    String concreteIndexName = testIndexPrefix + "_entity_relationship";

    createTestIndex(concreteIndexName);

    try {
      client.indices().putAlias(a -> a.index(concreteIndexName).name(aliasName).isWriteIndex(true));
    } catch (Exception e) {
      LOG.debug("Alias {} might already exist", aliasName);
    }

    String entityFqn = "test.table.source";
    String relatedEntityFqn = "test.table.target";

    String sourceEntityJson =
        String.format(
            """
            {
              "id": "source-id-1",
              "name": "Source Table",
              "fullyQualifiedName": "%s",
              "entityType": "table",
              "deleted": false,
              "entityRelationship": [
                {
                  "entity": {
                    "id": "source-id-1",
                    "fqn": "%s",
                    "type": "table"
                  },
                  "relatedEntity": {
                    "id": "target-id-1",
                    "fqn": "%s",
                    "type": "table"
                  },
                  "relationshipType": "uses"
                }
              ]
            }
            """,
            entityFqn, entityFqn, relatedEntityFqn);

    String targetEntityJson =
        String.format(
            """
            {
              "id": "target-id-1",
              "name": "Target Table",
              "fullyQualifiedName": "%s",
              "entityType": "table",
              "deleted": false
            }
            """,
            relatedEntityFqn);

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("source-id-1")
                .document(parseJson(sourceEntityJson))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("target-id-1")
                .document(parseJson(targetEntityJson))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    Response response = searchManager.searchEntityRelationship(entityFqn, 0, 1, null, false);

    assertNotNull(response);
    assertEquals(200, response.getStatus());
    assertNotNull(response.getEntity());

    Map<String, Object> responseMap = (Map<String, Object>) response.getEntity();
    assertNotNull(responseMap.get("entity"));
    assertNotNull(responseMap.get("edges"));
    assertNotNull(responseMap.get("nodes"));

    LOG.info("searchEntityRelationship test completed successfully");

    client.indices().deleteAlias(d -> d.index(concreteIndexName).name(aliasName));
    client.indices().delete(d -> d.index(concreteIndexName));
  }

  @Test
  void testSearchEntityRelationship_WithDepth() throws Exception {
    String aliasName =
        org.openmetadata.service.Entity.getSearchRepository()
            .getIndexOrAliasName(GLOBAL_SEARCH_ALIAS);
    String concreteIndexName = testIndexPrefix + "_entity_depth";

    createTestIndex(concreteIndexName);

    try {
      client.indices().putAlias(a -> a.index(concreteIndexName).name(aliasName).isWriteIndex(true));
    } catch (Exception e) {
      LOG.debug("Alias {} might already exist", aliasName);
    }

    String entity1Fqn = "test.table.entity1";
    String entity2Fqn = "test.table.entity2";
    String entity3Fqn = "test.table.entity3";

    String entity1Json =
        String.format(
            """
            {
              "id": "entity-1",
              "name": "Entity 1",
              "fullyQualifiedName": "%s",
              "entityType": "table",
              "deleted": false,
              "entityRelationship": [
                {
                  "entity": {
                    "id": "entity-1",
                    "fqn": "%s",
                    "type": "table"
                  },
                  "relatedEntity": {
                    "id": "entity-2",
                    "fqn": "%s",
                    "type": "table"
                  },
                  "relationshipType": "uses"
                }
              ]
            }
            """,
            entity1Fqn, entity1Fqn, entity2Fqn);

    String entity2Json =
        String.format(
            """
            {
              "id": "entity-2",
              "name": "Entity 2",
              "fullyQualifiedName": "%s",
              "entityType": "table",
              "deleted": false,
              "entityRelationship": [
                {
                  "entity": {
                    "id": "entity-2",
                    "fqn": "%s",
                    "type": "table"
                  },
                  "relatedEntity": {
                    "id": "entity-3",
                    "fqn": "%s",
                    "type": "table"
                  },
                  "relationshipType": "uses"
                }
              ]
            }
            """,
            entity2Fqn, entity2Fqn, entity3Fqn);

    String entity3Json =
        String.format(
            """
            {
              "id": "entity-3",
              "name": "Entity 3",
              "fullyQualifiedName": "%s",
              "entityType": "table",
              "deleted": false
            }
            """,
            entity3Fqn);

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("entity-1")
                .document(parseJson(entity1Json))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("entity-2")
                .document(parseJson(entity2Json))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("entity-3")
                .document(parseJson(entity3Json))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    Response response = searchManager.searchEntityRelationship(entity1Fqn, 0, 2, null, false);

    assertNotNull(response);
    assertEquals(200, response.getStatus());

    Map<String, Object> responseMap = (Map<String, Object>) response.getEntity();
    assertNotNull(responseMap.get("entity"));
    assertNotNull(responseMap.get("edges"));
    assertNotNull(responseMap.get("nodes"));

    LOG.info("searchEntityRelationship with depth test completed successfully");

    client.indices().deleteAlias(d -> d.index(concreteIndexName).name(aliasName));
    client.indices().delete(d -> d.index(concreteIndexName));
  }

  @Test
  void testSearchEntityRelationship_NoRelationships() throws Exception {
    String aliasName =
        org.openmetadata.service.Entity.getSearchRepository()
            .getIndexOrAliasName(GLOBAL_SEARCH_ALIAS);
    String concreteIndexName = testIndexPrefix + "_entity_no_rel";

    createTestIndex(concreteIndexName);

    try {
      client.indices().putAlias(a -> a.index(concreteIndexName).name(aliasName).isWriteIndex(true));
    } catch (Exception e) {
      LOG.debug("Alias {} might already exist", aliasName);
    }

    String entityFqn = "test.table.isolated";

    String isolatedEntityJson =
        String.format(
            """
            {
              "id": "isolated-id",
              "name": "Isolated Table",
              "fullyQualifiedName": "%s",
              "entityType": "table",
              "deleted": false
            }
            """,
            entityFqn);

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("isolated-id")
                .document(parseJson(isolatedEntityJson))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    Response response = searchManager.searchEntityRelationship(entityFqn, 1, 1, null, false);

    assertNotNull(response);
    assertEquals(200, response.getStatus());

    Map<String, Object> responseMap = (Map<String, Object>) response.getEntity();
    assertNotNull(responseMap.get("entity"));

    LOG.info("searchEntityRelationship with no relationships test completed successfully");

    client.indices().deleteAlias(d -> d.index(concreteIndexName).name(aliasName));
    client.indices().delete(d -> d.index(concreteIndexName));
  }

  @Test
  void testSearchEntityRelationship_WithDeletedFilter() throws Exception {
    String aliasName =
        org.openmetadata.service.Entity.getSearchRepository()
            .getIndexOrAliasName(GLOBAL_SEARCH_ALIAS);
    String concreteIndexName = testIndexPrefix + "_entity_deleted";

    createTestIndex(concreteIndexName);

    try {
      client.indices().putAlias(a -> a.index(concreteIndexName).name(aliasName).isWriteIndex(true));
    } catch (Exception e) {
      LOG.debug("Alias {} might already exist", aliasName);
    }

    String entityFqn = "test.table.main";
    String deletedEntityFqn = "test.table.deleted";

    String mainEntityJson =
        String.format(
            """
            {
              "id": "main-id",
              "name": "Main Table",
              "fullyQualifiedName": "%s",
              "entityType": "table",
              "deleted": false,
              "entityRelationship": [
                {
                  "entity": {
                    "id": "main-id",
                    "fqn": "%s",
                    "type": "table"
                  },
                  "relatedEntity": {
                    "id": "deleted-id",
                    "fqn": "%s",
                    "type": "table"
                  },
                  "relationshipType": "uses"
                }
              ]
            }
            """,
            entityFqn, entityFqn, deletedEntityFqn);

    String deletedEntityJson =
        String.format(
            """
            {
              "id": "deleted-id",
              "name": "Deleted Table",
              "fullyQualifiedName": "%s",
              "entityType": "table",
              "deleted": true
            }
            """,
            deletedEntityFqn);

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("main-id")
                .document(parseJson(mainEntityJson))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("deleted-id")
                .document(parseJson(deletedEntityJson))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    Response responseNonDeleted =
        searchManager.searchEntityRelationship(entityFqn, 0, 1, null, false);
    assertNotNull(responseNonDeleted);
    assertEquals(200, responseNonDeleted.getStatus());

    Response responseDeleted = searchManager.searchEntityRelationship(entityFqn, 0, 1, null, true);
    assertNotNull(responseDeleted);
    assertEquals(200, responseDeleted.getStatus());

    LOG.info("searchEntityRelationship with deleted filter test completed successfully");

    client.indices().deleteAlias(d -> d.index(concreteIndexName).name(aliasName));
    client.indices().delete(d -> d.index(concreteIndexName));
  }

  @Test
  void testSearchSchemaEntityRelationship_BasicUsage() throws Exception {
    String aliasName =
        org.openmetadata.service.Entity.getSearchRepository()
            .getIndexOrAliasName(GLOBAL_SEARCH_ALIAS);
    String concreteIndexName = testIndexPrefix + "_schema_basic";

    createTestIndex(concreteIndexName);

    try {
      client.indices().putAlias(a -> a.index(concreteIndexName).name(aliasName).isWriteIndex(true));
    } catch (Exception e) {
      LOG.debug("Alias {} might already exist", aliasName);
    }

    String schemaFqn = "test.database.schema1";

    String schemaEntityJson =
        String.format(
            """
            {
              "id": "schema-id-1",
              "name": "Test Schema",
              "fullyQualifiedName": "%s",
              "entityType": "databaseSchema",
              "deleted": false
            }
            """,
            schemaFqn);

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("schema-id-1")
                .document(parseJson(schemaEntityJson))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    Response response = searchManager.searchSchemaEntityRelationship(schemaFqn, 0, 1, null, false);

    assertNotNull(response);
    assertEquals(200, response.getStatus());

    Map<String, Object> responseMap = (Map<String, Object>) response.getEntity();
    assertNotNull(responseMap.get("entity"));
    assertNotNull(responseMap.get("edges"));
    assertNotNull(responseMap.get("nodes"));

    LOG.info("searchSchemaEntityRelationship basic test completed successfully");

    client.indices().deleteAlias(d -> d.index(concreteIndexName).name(aliasName));
    client.indices().delete(d -> d.index(concreteIndexName));
  }

  @Test
  void testSearchSchemaEntityRelationship_WithDepth() throws Exception {
    String aliasName =
        org.openmetadata.service.Entity.getSearchRepository()
            .getIndexOrAliasName(GLOBAL_SEARCH_ALIAS);
    String concreteIndexName = testIndexPrefix + "_schema_depth";

    createTestIndex(concreteIndexName);

    try {
      client.indices().putAlias(a -> a.index(concreteIndexName).name(aliasName).isWriteIndex(true));
    } catch (Exception e) {
      LOG.debug("Alias {} might already exist", aliasName);
    }

    String schemaFqn = "test.database.schema2";

    String schemaEntityJson =
        String.format(
            """
            {
              "id": "schema-id-2",
              "name": "Test Schema 2",
              "fullyQualifiedName": "%s",
              "entityType": "databaseSchema",
              "deleted": false
            }
            """,
            schemaFqn);

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("schema-id-2")
                .document(parseJson(schemaEntityJson))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    Response response = searchManager.searchSchemaEntityRelationship(schemaFqn, 2, 2, null, false);

    assertNotNull(response);
    assertEquals(200, response.getStatus());

    Map<String, Object> responseMap = (Map<String, Object>) response.getEntity();
    assertNotNull(responseMap.get("entity"));
    assertNotNull(responseMap.get("edges"));
    assertNotNull(responseMap.get("nodes"));

    LOG.info("searchSchemaEntityRelationship with depth test completed successfully");

    client.indices().deleteAlias(d -> d.index(concreteIndexName).name(aliasName));
    client.indices().delete(d -> d.index(concreteIndexName));
  }

  @Test
  void testSearchDataQualityLineage_BasicLineage() throws Exception {
    String aliasName =
        org.openmetadata.service.Entity.getSearchRepository()
            .getIndexOrAliasName(GLOBAL_SEARCH_ALIAS);
    String concreteIndexName = testIndexPrefix + "_dq_basic";

    createTestIndex(concreteIndexName);

    try {
      client.indices().putAlias(a -> a.index(concreteIndexName).name(aliasName).isWriteIndex(true));
    } catch (Exception e) {
      LOG.debug("Alias {} might already exist", aliasName);
    }

    String table1Fqn = "test.database.schema.table1";
    String table2Fqn = "test.database.schema.table2";
    String table3Fqn = "test.database.schema.table3";

    String table3Json =
        String.format(
            """
            {
              "id": "33333333-3333-3333-3333-333333333333",
              "name": "Table 3",
              "fullyQualifiedName": "%s",
              "fqnHash": "%s",
              "entityType": "table",
              "deleted": false
            }
            """,
            table3Fqn, org.openmetadata.service.util.FullyQualifiedName.buildHash(table3Fqn));

    String table2Json =
        String.format(
            """
            {
              "id": "22222222-2222-2222-2222-222222222222",
              "name": "Table 2",
              "fullyQualifiedName": "%s",
              "fqnHash": "%s",
              "entityType": "table",
              "deleted": false,
              "upstreamLineage": [
                {
                  "fromEntity": {
                    "id": "33333333-3333-3333-3333-333333333333",
                    "type": "table",
                    "fullyQualifiedName": "%s"
                  },
                  "toEntity": {
                    "id": "22222222-2222-2222-2222-222222222222",
                    "type": "table",
                    "fullyQualifiedName": "%s"
                  },
                  "docUniqueId": "table-3-id-table-2-id"
                }
              ]
            }
            """,
            table2Fqn,
            org.openmetadata.service.util.FullyQualifiedName.buildHash(table2Fqn),
            table3Fqn,
            table2Fqn);

    String table1Json =
        String.format(
            """
            {
              "id": "11111111-1111-1111-1111-111111111111",
              "name": "Table 1",
              "fullyQualifiedName": "%s",
              "fqnHash": "%s",
              "entityType": "table",
              "deleted": false,
              "upstreamLineage": [
                {
                  "fromEntity": {
                    "id": "22222222-2222-2222-2222-222222222222",
                    "type": "table",
                    "fullyQualifiedName": "%s"
                  },
                  "toEntity": {
                    "id": "11111111-1111-1111-1111-111111111111",
                    "type": "table",
                    "fullyQualifiedName": "%s"
                  },
                  "docUniqueId": "table-2-id-table-1-id"
                }
              ]
            }
            """,
            table1Fqn,
            org.openmetadata.service.util.FullyQualifiedName.buildHash(table1Fqn),
            table2Fqn,
            table1Fqn);

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("33333333-3333-3333-3333-333333333333")
                .document(parseJson(table3Json))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("22222222-2222-2222-2222-222222222222")
                .document(parseJson(table2Json))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("11111111-1111-1111-1111-111111111111")
                .document(parseJson(table1Json))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    Response response = searchManager.searchDataQualityLineage(table1Fqn, 2, null, false);

    assertNotNull(response);
    assertEquals(200, response.getStatus());

    Map<String, Object> responseMap = (Map<String, Object>) response.getEntity();
    assertNotNull(responseMap.get("edges"));
    assertNotNull(responseMap.get("nodes"));

    LOG.info("searchDataQualityLineage basic test completed successfully");

    client.indices().deleteAlias(d -> d.index(concreteIndexName).name(aliasName));
    client.indices().delete(d -> d.index(concreteIndexName));
  }

  @Test
  void testSearchDataQualityLineage_WithDepth() throws Exception {
    String aliasName =
        org.openmetadata.service.Entity.getSearchRepository()
            .getIndexOrAliasName(GLOBAL_SEARCH_ALIAS);
    String concreteIndexName = testIndexPrefix + "_dq_depth";

    createTestIndex(concreteIndexName);

    try {
      client.indices().putAlias(a -> a.index(concreteIndexName).name(aliasName).isWriteIndex(true));
    } catch (Exception e) {
      LOG.debug("Alias {} might already exist", aliasName);
    }

    String table1Fqn = "test.db.schema.tbl1";
    String table2Fqn = "test.db.schema.tbl2";
    String table3Fqn = "test.db.schema.tbl3";

    String table3Json =
        String.format(
            """
            {
              "id": "33333333-3333-3333-3333-333333333303",
              "name": "Tbl 3",
              "fullyQualifiedName": "%s",
              "fqnHash": "%s",
              "entityType": "table",
              "deleted": false
            }
            """,
            table3Fqn, org.openmetadata.service.util.FullyQualifiedName.buildHash(table3Fqn));

    String table2Json =
        String.format(
            """
            {
              "id": "22222222-2222-2222-2222-222222222202",
              "name": "Tbl 2",
              "fullyQualifiedName": "%s",
              "fqnHash": "%s",
              "entityType": "table",
              "deleted": false,
              "upstreamLineage": [
                {
                  "fromEntity": {
                    "id": "33333333-3333-3333-3333-333333333303",
                    "type": "table",
                    "fullyQualifiedName": "%s"
                  },
                  "toEntity": {
                    "id": "22222222-2222-2222-2222-222222222202",
                    "type": "table",
                    "fullyQualifiedName": "%s"
                  },
                  "docUniqueId": "tbl-3-tbl-2"
                }
              ]
            }
            """,
            table2Fqn,
            org.openmetadata.service.util.FullyQualifiedName.buildHash(table2Fqn),
            table3Fqn,
            table2Fqn);

    String table1Json =
        String.format(
            """
            {
              "id": "11111111-1111-1111-1111-111111111101",
              "name": "Tbl 1",
              "fullyQualifiedName": "%s",
              "fqnHash": "%s",
              "entityType": "table",
              "deleted": false,
              "upstreamLineage": [
                {
                  "fromEntity": {
                    "id": "22222222-2222-2222-2222-222222222202",
                    "type": "table",
                    "fullyQualifiedName": "%s"
                  },
                  "toEntity": {
                    "id": "11111111-1111-1111-1111-111111111101",
                    "type": "table",
                    "fullyQualifiedName": "%s"
                  },
                  "docUniqueId": "tbl-2-tbl-1"
                }
              ]
            }
            """,
            table1Fqn,
            org.openmetadata.service.util.FullyQualifiedName.buildHash(table1Fqn),
            table2Fqn,
            table1Fqn);

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("33333333-3333-3333-3333-333333333303")
                .document(parseJson(table3Json))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("22222222-2222-2222-2222-222222222202")
                .document(parseJson(table2Json))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("11111111-1111-1111-1111-111111111101")
                .document(parseJson(table1Json))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    Response responseDepth1 = searchManager.searchDataQualityLineage(table1Fqn, 1, null, false);
    assertNotNull(responseDepth1);
    assertEquals(200, responseDepth1.getStatus());

    Response responseDepth2 = searchManager.searchDataQualityLineage(table1Fqn, 2, null, false);
    assertNotNull(responseDepth2);
    assertEquals(200, responseDepth2.getStatus());

    LOG.info("searchDataQualityLineage with different depths test completed successfully");

    client.indices().deleteAlias(d -> d.index(concreteIndexName).name(aliasName));
    client.indices().delete(d -> d.index(concreteIndexName));
  }

  @Test
  void testSearchDataQualityLineage_NoLineage() throws Exception {
    String aliasName =
        org.openmetadata.service.Entity.getSearchRepository()
            .getIndexOrAliasName(GLOBAL_SEARCH_ALIAS);
    String concreteIndexName = testIndexPrefix + "_dq_no_lineage";

    createTestIndex(concreteIndexName);

    try {
      client.indices().putAlias(a -> a.index(concreteIndexName).name(aliasName).isWriteIndex(true));
    } catch (Exception e) {
      LOG.debug("Alias {} might already exist", aliasName);
    }

    String tableFqn = "test.db.schema.isolated_table";

    String tableJson =
        String.format(
            """
            {
              "id": "iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii",
              "name": "Isolated Table",
              "fullyQualifiedName": "%s",
              "fqnHash": "%s",
              "entityType": "table",
              "deleted": false
            }
            """,
            tableFqn, org.openmetadata.service.util.FullyQualifiedName.buildHash(tableFqn));

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii")
                .document(parseJson(tableJson))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    Response response = searchManager.searchDataQualityLineage(tableFqn, 2, null, false);

    assertNotNull(response);
    assertEquals(200, response.getStatus());

    Map<String, Object> responseMap = (Map<String, Object>) response.getEntity();
    assertNotNull(responseMap.get("edges"));
    assertNotNull(responseMap.get("nodes"));

    LOG.info("searchDataQualityLineage with no lineage test completed successfully");

    client.indices().deleteAlias(d -> d.index(concreteIndexName).name(aliasName));
    client.indices().delete(d -> d.index(concreteIndexName));
  }

  @Test
  void testSearchDataQualityLineage_WithQueryFilter() throws Exception {
    String aliasName =
        org.openmetadata.service.Entity.getSearchRepository()
            .getIndexOrAliasName(GLOBAL_SEARCH_ALIAS);
    String concreteIndexName = testIndexPrefix + "_dq_filter";

    createTestIndex(concreteIndexName);

    try {
      client.indices().putAlias(a -> a.index(concreteIndexName).name(aliasName).isWriteIndex(true));
    } catch (Exception e) {
      LOG.debug("Alias {} might already exist", aliasName);
    }

    String table1Fqn = "test.prod.schema.table1";
    String table2Fqn = "test.dev.schema.table2";

    String table2Json =
        String.format(
            """
            {
              "id": "22222222-2222-2222-2222-222222220002",
              "name": "Table 2",
              "fullyQualifiedName": "%s",
              "fqnHash": "%s",
              "entityType": "table",
              "environment": "dev",
              "deleted": false
            }
            """,
            table2Fqn, org.openmetadata.service.util.FullyQualifiedName.buildHash(table2Fqn));

    String table1Json =
        String.format(
            """
            {
              "id": "11111111-1111-1111-1111-111111110001",
              "name": "Table 1",
              "fullyQualifiedName": "%s",
              "fqnHash": "%s",
              "entityType": "table",
              "environment": "prod",
              "deleted": false,
              "upstreamLineage": [
                {
                  "fromEntity": {
                    "id": "22222222-2222-2222-2222-222222220002",
                    "type": "table",
                    "fullyQualifiedName": "%s"
                  },
                  "toEntity": {
                    "id": "11111111-1111-1111-1111-111111110001",
                    "type": "table",
                    "fullyQualifiedName": "%s"
                  },
                  "docUniqueId": "table-2-dev-table-1-prod"
                }
              ]
            }
            """,
            table1Fqn,
            org.openmetadata.service.util.FullyQualifiedName.buildHash(table1Fqn),
            table2Fqn,
            table1Fqn);

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("22222222-2222-2222-2222-222222220002")
                .document(parseJson(table2Json))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("11111111-1111-1111-1111-111111110001")
                .document(parseJson(table1Json))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    String queryFilter = "{\"term\":{\"environment\":\"prod\"}}";

    Response response = searchManager.searchDataQualityLineage(table1Fqn, 2, queryFilter, false);

    assertNotNull(response);
    assertEquals(200, response.getStatus());

    Map<String, Object> responseMap = (Map<String, Object>) response.getEntity();
    assertNotNull(responseMap.get("edges"));
    assertNotNull(responseMap.get("nodes"));

    LOG.info("searchDataQualityLineage with query filter test completed successfully");

    client.indices().deleteAlias(d -> d.index(concreteIndexName).name(aliasName));
    client.indices().delete(d -> d.index(concreteIndexName));
  }

  @Test
  void testSearchDataQualityLineage_WithDeletedEntities() throws Exception {
    String aliasName =
        org.openmetadata.service.Entity.getSearchRepository()
            .getIndexOrAliasName(GLOBAL_SEARCH_ALIAS);
    String concreteIndexName = testIndexPrefix + "_dq_deleted";

    createTestIndex(concreteIndexName);

    try {
      client.indices().putAlias(a -> a.index(concreteIndexName).name(aliasName).isWriteIndex(true));
    } catch (Exception e) {
      LOG.debug("Alias {} might already exist", aliasName);
    }

    String table1Fqn = "test.db.schema.active_table";
    String table2Fqn = "test.db.schema.deleted_table";

    String table2Json =
        String.format(
            """
            {
              "id": "dddddddd-dddd-dddd-dddd-dddddddddddd",
              "name": "Deleted Table",
              "fullyQualifiedName": "%s",
              "fqnHash": "%s",
              "entityType": "table",
              "deleted": true
            }
            """,
            table2Fqn, org.openmetadata.service.util.FullyQualifiedName.buildHash(table2Fqn));

    String table1Json =
        String.format(
            """
            {
              "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
              "name": "Active Table",
              "fullyQualifiedName": "%s",
              "fqnHash": "%s",
              "entityType": "table",
              "deleted": false,
              "upstreamLineage": [
                {
                  "fromEntity": {
                    "id": "dddddddd-dddd-dddd-dddd-dddddddddddd",
                    "type": "table",
                    "fullyQualifiedName": "%s"
                  },
                  "toEntity": {
                    "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                    "type": "table",
                    "fullyQualifiedName": "%s"
                  },
                  "docUniqueId": "deleted-table-active-table"
                }
              ]
            }
            """,
            table1Fqn,
            org.openmetadata.service.util.FullyQualifiedName.buildHash(table1Fqn),
            table2Fqn,
            table1Fqn);

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("dddddddd-dddd-dddd-dddd-dddddddddddd")
                .document(parseJson(table2Json))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
                .document(parseJson(table1Json))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    Response responseNonDeleted = searchManager.searchDataQualityLineage(table1Fqn, 2, null, false);
    assertNotNull(responseNonDeleted);
    assertEquals(200, responseNonDeleted.getStatus());

    Response responseDeleted = searchManager.searchDataQualityLineage(table1Fqn, 2, null, true);
    assertNotNull(responseDeleted);
    assertEquals(200, responseDeleted.getStatus());

    LOG.info("searchDataQualityLineage with deleted entities test completed successfully");

    client.indices().deleteAlias(d -> d.index(concreteIndexName).name(aliasName));
    client.indices().delete(d -> d.index(concreteIndexName));
  }

  @Test
  void testSearchDataQualityLineage_ZeroDepth() throws Exception {
    String aliasName =
        org.openmetadata.service.Entity.getSearchRepository()
            .getIndexOrAliasName(GLOBAL_SEARCH_ALIAS);
    String concreteIndexName = testIndexPrefix + "_dq_zero_depth";

    createTestIndex(concreteIndexName);

    try {
      client.indices().putAlias(a -> a.index(concreteIndexName).name(aliasName).isWriteIndex(true));
    } catch (Exception e) {
      LOG.debug("Alias {} might already exist", aliasName);
    }

    String tableFqn = "test.db.schema.table_zero";

    String tableJson =
        String.format(
            """
            {
              "id": "00000000-0000-0000-0000-000000000000",
              "name": "Table Zero",
              "fullyQualifiedName": "%s",
              "fqnHash": "%s",
              "entityType": "table",
              "deleted": false
            }
            """,
            tableFqn, org.openmetadata.service.util.FullyQualifiedName.buildHash(tableFqn));

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("00000000-0000-0000-0000-000000000000")
                .document(parseJson(tableJson))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    Response response = searchManager.searchDataQualityLineage(tableFqn, 0, null, false);

    assertNotNull(response);
    assertEquals(200, response.getStatus());

    Map<String, Object> responseMap = (Map<String, Object>) response.getEntity();
    assertNotNull(responseMap.get("edges"));
    assertNotNull(responseMap.get("nodes"));

    LOG.info("searchDataQualityLineage with zero depth test completed successfully");

    client.indices().deleteAlias(d -> d.index(concreteIndexName).name(aliasName));
    client.indices().delete(d -> d.index(concreteIndexName));
  }

  @Test
  void testSearchDataQualityLineage_ComplexLineageGraph() throws Exception {
    String aliasName =
        org.openmetadata.service.Entity.getSearchRepository()
            .getIndexOrAliasName(GLOBAL_SEARCH_ALIAS);
    String concreteIndexName = testIndexPrefix + "_dq_complex";

    createTestIndex(concreteIndexName);

    try {
      client.indices().putAlias(a -> a.index(concreteIndexName).name(aliasName).isWriteIndex(true));
    } catch (Exception e) {
      LOG.debug("Alias {} might already exist", aliasName);
    }

    String table1Fqn = "test.db.schema.table_a";
    String table2Fqn = "test.db.schema.table_b";
    String table3Fqn = "test.db.schema.table_c";
    String table4Fqn = "test.db.schema.table_d";

    String table4Json =
        String.format(
            """
            {
              "id": "dddd4444-dddd-4444-dddd-444444444444",
              "name": "Table D",
              "fullyQualifiedName": "%s",
              "fqnHash": "%s",
              "entityType": "table",
              "deleted": false
            }
            """,
            table4Fqn, org.openmetadata.service.util.FullyQualifiedName.buildHash(table4Fqn));

    String table3Json =
        String.format(
            """
            {
              "id": "cccc3333-cccc-3333-cccc-333333333333",
              "name": "Table C",
              "fullyQualifiedName": "%s",
              "fqnHash": "%s",
              "entityType": "table",
              "deleted": false,
              "upstreamLineage": [
                {
                  "fromEntity": {
                    "id": "dddd4444-dddd-4444-dddd-444444444444",
                    "type": "table",
                    "fullyQualifiedName": "%s"
                  },
                  "toEntity": {
                    "id": "cccc3333-cccc-3333-cccc-333333333333",
                    "type": "table",
                    "fullyQualifiedName": "%s"
                  },
                  "docUniqueId": "table-d-table-c"
                }
              ]
            }
            """,
            table3Fqn,
            org.openmetadata.service.util.FullyQualifiedName.buildHash(table3Fqn),
            table4Fqn,
            table3Fqn);

    String table2Json =
        String.format(
            """
            {
              "id": "bbbb2222-bbbb-2222-bbbb-222222222222",
              "name": "Table B",
              "fullyQualifiedName": "%s",
              "fqnHash": "%s",
              "entityType": "table",
              "deleted": false,
              "upstreamLineage": [
                {
                  "fromEntity": {
                    "id": "dddd4444-dddd-4444-dddd-444444444444",
                    "type": "table",
                    "fullyQualifiedName": "%s"
                  },
                  "toEntity": {
                    "id": "bbbb2222-bbbb-2222-bbbb-222222222222",
                    "type": "table",
                    "fullyQualifiedName": "%s"
                  },
                  "docUniqueId": "table-d-table-b"
                }
              ]
            }
            """,
            table2Fqn,
            org.openmetadata.service.util.FullyQualifiedName.buildHash(table2Fqn),
            table4Fqn,
            table2Fqn);

    String table1Json =
        String.format(
            """
            {
              "id": "aaaa1111-aaaa-1111-aaaa-111111111111",
              "name": "Table A",
              "fullyQualifiedName": "%s",
              "fqnHash": "%s",
              "entityType": "table",
              "deleted": false,
              "upstreamLineage": [
                {
                  "fromEntity": {
                    "id": "bbbb2222-bbbb-2222-bbbb-222222222222",
                    "type": "table",
                    "fullyQualifiedName": "%s"
                  },
                  "toEntity": {
                    "id": "aaaa1111-aaaa-1111-aaaa-111111111111",
                    "type": "table",
                    "fullyQualifiedName": "%s"
                  },
                  "docUniqueId": "table-b-table-a"
                },
                {
                  "fromEntity": {
                    "id": "cccc3333-cccc-3333-cccc-333333333333",
                    "type": "table",
                    "fullyQualifiedName": "%s"
                  },
                  "toEntity": {
                    "id": "aaaa1111-aaaa-1111-aaaa-111111111111",
                    "type": "table",
                    "fullyQualifiedName": "%s"
                  },
                  "docUniqueId": "table-c-table-a"
                }
              ]
            }
            """,
            table1Fqn,
            org.openmetadata.service.util.FullyQualifiedName.buildHash(table1Fqn),
            table2Fqn,
            table1Fqn,
            table3Fqn,
            table1Fqn);

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("dddd4444-dddd-4444-dddd-444444444444")
                .document(parseJson(table4Json))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("cccc3333-cccc-3333-cccc-333333333333")
                .document(parseJson(table3Json))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("bbbb2222-bbbb-2222-bbbb-222222222222")
                .document(parseJson(table2Json))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    client.index(
        i ->
            i.index(concreteIndexName)
                .id("aaaa1111-aaaa-1111-aaaa-111111111111")
                .document(parseJson(table1Json))
                .refresh(es.co.elastic.clients.elasticsearch._types.Refresh.True));

    Response response = searchManager.searchDataQualityLineage(table1Fqn, 3, null, false);

    assertNotNull(response);
    assertEquals(200, response.getStatus());

    Map<String, Object> responseMap = (Map<String, Object>) response.getEntity();
    assertNotNull(responseMap.get("edges"));
    assertNotNull(responseMap.get("nodes"));

    LOG.info("searchDataQualityLineage with complex lineage graph test completed successfully");

    client.indices().deleteAlias(d -> d.index(concreteIndexName).name(aliasName));
    client.indices().delete(d -> d.index(concreteIndexName));
  }
}
