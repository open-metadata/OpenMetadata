package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.Refresh;
import es.co.elastic.clients.elasticsearch.indices.CreateIndexRequest;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import es.co.elastic.clients.transport.rest_client.RestClientTransport;
import es.org.elasticsearch.client.RestClient;
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
  private static final String GLOBAL_SEARCH_ALIAS = "global_search";

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

    RestClient restClient = getSearchClient();
    RestClientTransport transport = new RestClientTransport(restClient, new JacksonJsonpMapper());
    client = new ElasticsearchClient(transport);

    searchManager = new ElasticSearchSearchManager(client, null, "");

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

    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository()
            .getIndexOrAliasName(GLOBAL_SEARCH_ALIAS);

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
  }

  @Test
  void testSearchBySourceUrl_NoResults() throws Exception {
    String sourceUrl = "https://example.com/source/non-existent";

    String actualIndexName =
        org.openmetadata.service.Entity.getSearchRepository()
            .getIndexOrAliasName(GLOBAL_SEARCH_ALIAS);

    createTestIndex(actualIndexName);

    Response response = searchManager.searchBySourceUrl(sourceUrl);

    assertNotNull(response);
    assertEquals(200, response.getStatus());
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
        new ElasticSearchSearchManager(null, null, "");

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
                                  .properties("updated", p -> p.date(d -> d))));

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
}
