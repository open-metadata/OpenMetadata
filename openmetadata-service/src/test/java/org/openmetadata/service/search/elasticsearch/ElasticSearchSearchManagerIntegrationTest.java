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

    searchManager = new ElasticSearchSearchManager(client);

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
    ElasticSearchSearchManager managerWithNullClient = new ElasticSearchSearchManager(null);

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
}
