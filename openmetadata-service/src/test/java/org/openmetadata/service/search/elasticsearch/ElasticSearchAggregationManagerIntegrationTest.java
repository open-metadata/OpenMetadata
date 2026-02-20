package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.Refresh;
import es.co.elastic.clients.elasticsearch.core.IndexRequest;
import es.co.elastic.clients.elasticsearch.indices.CreateIndexRequest;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import es.co.elastic.clients.transport.rest5_client.Rest5ClientTransport;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import jakarta.json.JsonObject;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.search.TopHits;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.search.SearchAggregation;
import org.openmetadata.service.search.SearchAggregationNode;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ElasticSearchAggregationManagerIntegrationTest extends OpenMetadataApplicationTest {

  private ElasticSearchAggregationManager aggregationManager;
  private ElasticsearchClient client;
  private String testIndexPrefix;
  private final ObjectMapper objectMapper = new ObjectMapper();

  private static final String TEST_DOCUMENT =
      """
      {
        "id": "%s",
        "name": "test%s",
        "description": "Test document",
        "timestamp": %d,
        "deleted": false,
        "testDefinition": {
          "dataQualityDimension": "Completeness"
        }
      }
      """;

  @BeforeEach
  void setUp() {
    testIndexPrefix =
        "test_agg_"
            + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss_SSS"));

    Rest5Client restClient = getSearchClient();
    Rest5ClientTransport transport = new Rest5ClientTransport(restClient, new JacksonJsonpMapper());
    client = new ElasticsearchClient(transport);

    aggregationManager = new ElasticSearchAggregationManager(client);

    LOG.info("ElasticSearchAggregationManager test setup with prefix: {}", testIndexPrefix);
  }

  @AfterEach
  void tearDown() {
    if (client != null && testIndexPrefix != null) {
      try {
        String[] indicesToDelete = {
          testIndexPrefix + "_basic",
          testIndexPrefix + "_generic",
          testIndexPrefix + "_filter",
          testIndexPrefix + "_date_histogram"
        };

        for (String indexName : indicesToDelete) {
          try {
            client.indices().delete(d -> d.index(indexName));
            LOG.info("Cleaned up test index: {}", indexName);

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
  void testAggregate_BasicTermsAggregation() throws Exception {
    String indexName = testIndexPrefix + "_basic";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    for (int i = 0; i < 5; i++) {
      indexTestDocument(actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), i, now));
    }

    AggregationRequest request = new AggregationRequest();
    request.setIndex(indexName);
    request.setFieldName("testDefinition.dataQualityDimension.keyword");
    request.setSize(10);
    request.setFieldValue(".*");
    request.setDeleted(false);

    Response response = aggregationManager.aggregate(request);

    assertNotNull(response, "Response should not be null");
    assertEquals(200, response.getStatus(), "Response status should be OK");
    assertNotNull(response.getEntity(), "Response entity should not be null");
  }

  @Test
  void testAggregate_WithQueryWrapper() throws Exception {
    String indexName = testIndexPrefix + "_basic";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    indexTestDocument(actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), 1, now));

    AggregationRequest request = new AggregationRequest();
    request.setIndex(indexName);
    request.setFieldName("testDefinition.dataQualityDimension.keyword");
    request.setSize(10);
    request.setFieldValue(".*");
    request.setQuery("{\"term\":{\"deleted\":false}}");

    Response response = aggregationManager.aggregate(request);

    assertNotNull(response, "Response should not be null");
    assertEquals(200, response.getStatus(), "Response status should be OK");
  }

  @Test
  void testAggregate_WithSourceFields() throws Exception {
    String indexName = testIndexPrefix + "_basic";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    indexTestDocument(actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), 1, now));

    AggregationRequest request = new AggregationRequest();
    request.setIndex(indexName);
    request.setFieldName("testDefinition.dataQualityDimension.keyword");
    request.setSize(10);
    request.setFieldValue(".*");
    request.setSourceFields(List.of("id", "name"));

    TopHits topHits = new TopHits();
    topHits.setSize(5);
    request.setTopHits(topHits);

    Response response = aggregationManager.aggregate(request);

    assertNotNull(response, "Response should not be null");
    assertEquals(200, response.getStatus(), "Response status should be OK");
  }

  @Test
  void testAggregate_WithDeletedFilter() throws Exception {
    String indexName = testIndexPrefix + "_basic";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    indexTestDocument(actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), 1, now));

    AggregationRequest request = new AggregationRequest();
    request.setIndex(indexName);
    request.setFieldName("testDefinition.dataQualityDimension.keyword");
    request.setSize(10);
    request.setFieldValue(".*");
    request.setDeleted(false);

    Response response = aggregationManager.aggregate(request);

    assertNotNull(response, "Response should not be null");
    assertEquals(200, response.getStatus(), "Response status should be OK");
  }

  @Test
  void testAggregate_WithQueryWrapperFormat() throws Exception {
    String indexName = testIndexPrefix + "_basic";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    indexTestDocument(actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), 1, now));

    AggregationRequest request = new AggregationRequest();
    request.setIndex(indexName);
    request.setFieldName("testDefinition.dataQualityDimension.keyword");
    request.setSize(10);
    request.setFieldValue(".*");
    request.setQuery("{\"query\":{\"term\":{\"deleted\":false}}}");

    Response response = aggregationManager.aggregate(request);

    assertNotNull(response, "Response should not be null");
    assertEquals(200, response.getStatus(), "Response status should be OK");
  }

  @Test
  void testAggregate_WithComplexQueryWrapperFormat() throws Exception {
    String indexName = testIndexPrefix + "_basic";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    for (int i = 0; i < 3; i++) {
      indexTestDocument(actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), i, now));
    }

    AggregationRequest request = new AggregationRequest();
    request.setIndex(indexName);
    request.setFieldName("testDefinition.dataQualityDimension.keyword");
    request.setSize(10);
    request.setFieldValue(".*");
    request.setQuery("{\"query\":{\"bool\":{\"must\":[{\"term\":{\"deleted\":false}}]}}}");

    Response response = aggregationManager.aggregate(request);

    assertNotNull(response, "Response should not be null");
    assertEquals(200, response.getStatus(), "Response status should be OK");
  }

  @Test
  void testAggregate_WithNullClient() {
    ElasticSearchAggregationManager nullClientManager = new ElasticSearchAggregationManager(null);

    AggregationRequest request = new AggregationRequest();
    request.setIndex("test_index");
    request.setFieldName("field");
    request.setSize(10);
    request.setFieldValue(".*");

    assertThrows(
        IOException.class,
        () -> nullClientManager.aggregate(request),
        "Should throw IOException with null client");
  }

  @Test
  void testGenericAggregation_DateHistogram() throws Exception {
    String indexName = testIndexPrefix + "_date_histogram";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    for (int i = 0; i < 5; i++) {
      long timestamp = now - (i * 86400000L);
      indexTestDocument(
          actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), i, timestamp));
    }

    SearchAggregation aggregation = createDateHistogramAggregation();
    String query = "{\"bool\":{\"must\":[{\"term\":{\"deleted\":false}}]}}";

    DataQualityReport report = aggregationManager.genericAggregation(query, indexName, aggregation);

    assertNotNull(report, "Report should not be null");
  }

  @Test
  void testGenericAggregation_TermsAggregation() throws Exception {
    String indexName = testIndexPrefix + "_generic";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    for (int i = 0; i < 5; i++) {
      indexTestDocument(actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), i, now));
    }

    SearchAggregation aggregation = createTermsAggregation();
    String query = null;

    DataQualityReport report = aggregationManager.genericAggregation(query, indexName, aggregation);

    assertNotNull(report, "Report should not be null");
  }

  @Test
  void testGenericAggregation_WithQueryWrapper() throws Exception {
    String indexName = testIndexPrefix + "_generic";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    indexTestDocument(actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), 1, now));

    SearchAggregation aggregation = createTermsAggregation();
    String query = "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"deleted\":false}}]}}}";

    DataQualityReport report = aggregationManager.genericAggregation(query, indexName, aggregation);

    assertNotNull(report, "Report should not be null");
  }

  @Test
  void testGenericAggregation_WithNullClient() {
    ElasticSearchAggregationManager nullClientManager = new ElasticSearchAggregationManager(null);

    SearchAggregation aggregation = createTermsAggregation();

    assertThrows(
        IOException.class,
        () -> nullClientManager.genericAggregation(null, "test_index", aggregation),
        "Should throw IOException with null client");
  }

  @Test
  void testAggregateWithFilter_CombinesQueryAndFilter() throws Exception {
    String indexName = testIndexPrefix + "_filter";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    for (int i = 0; i < 5; i++) {
      indexTestDocument(actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), i, now));
    }

    SearchAggregation aggregation = createTermsAggregation();
    String query = "{\"bool\":{\"must\":[{\"term\":{\"deleted\":false}}]}}";
    String filter = "{\"term\":{\"testDefinition.dataQualityDimension.keyword\":\"Completeness\"}}";

    JsonObject result = aggregationManager.aggregate(query, indexName, aggregation, filter);

    assertNotNull(result, "Result should not be null");
  }

  @Test
  void testAggregateWithFilter_OnlyQuery() throws Exception {
    String indexName = testIndexPrefix + "_filter";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    indexTestDocument(actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), 1, now));

    SearchAggregation aggregation = createTermsAggregation();
    String query = "{\"bool\":{\"must\":[{\"term\":{\"deleted\":false}}]}}";
    String filter = null;

    JsonObject result = aggregationManager.aggregate(query, indexName, aggregation, filter);

    assertNotNull(result, "Result should not be null");
  }

  @Test
  void testAggregateWithFilter_OnlyFilter() throws Exception {
    String indexName = testIndexPrefix + "_filter";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    indexTestDocument(actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), 1, now));

    SearchAggregation aggregation = createTermsAggregation();
    String query = null;
    String filter = "{\"term\":{\"deleted\":false}}";

    JsonObject result = aggregationManager.aggregate(query, indexName, aggregation, filter);

    assertNotNull(result, "Result should not be null");
  }

  @Test
  void testAggregateWithFilter_WithNullAggregation() throws Exception {
    String indexName = testIndexPrefix + "_filter";
    String query = "{\"term\":{\"deleted\":false}}";
    String filter = null;

    JsonObject result = aggregationManager.aggregate(query, indexName, null, filter);

    assertNull(result, "Result should be null with null aggregation");
  }

  @Test
  void testAggregateWithFilter_WithNullClient() {
    ElasticSearchAggregationManager nullClientManager = new ElasticSearchAggregationManager(null);

    SearchAggregation aggregation = createTermsAggregation();
    String query = "{\"term\":{\"deleted\":false}}";

    assertThrows(
        IOException.class,
        () -> nullClientManager.aggregate(query, "test_index", aggregation, null),
        "Should throw IOException with null client");
  }

  @Test
  void testAggregateWithFilter_WithEmptyFilter() throws Exception {
    String indexName = testIndexPrefix + "_filter";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    indexTestDocument(actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), 1, now));

    SearchAggregation aggregation = createTermsAggregation();
    String query = "{\"term\":{\"deleted\":false}}";
    String filter = "{}";

    JsonObject result = aggregationManager.aggregate(query, indexName, aggregation, filter);

    assertNotNull(result, "Result should not be null with empty filter");
  }

  @Test
  void testDateHistogram_CalendarInterval_Day() throws Exception {
    String indexName = testIndexPrefix + "_date_histogram";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    for (int i = 0; i < 3; i++) {
      long timestamp = now - (i * 86400000L);
      indexTestDocument(
          actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), i, timestamp));
    }

    SearchAggregation aggregation = createDateHistogramAggregation();

    DataQualityReport report = aggregationManager.genericAggregation(null, indexName, aggregation);

    assertNotNull(report, "Report should not be null");
  }

  @Test
  void testAggregateWithFilter_WithQueryWrapperFormat() throws Exception {
    String indexName = testIndexPrefix + "_filter";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    indexTestDocument(actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), 1, now));

    SearchAggregation aggregation = createTermsAggregation();
    String query = "{\"query\":{\"term\":{\"deleted\":false}}}";
    String filter = null;

    JsonObject result = aggregationManager.aggregate(query, indexName, aggregation, filter);

    assertNotNull(result, "Result should not be null");
  }

  @Test
  void testAggregateWithFilter_WithFilterWrapperFormat() throws Exception {
    String indexName = testIndexPrefix + "_filter";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    indexTestDocument(actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), 1, now));

    SearchAggregation aggregation = createTermsAggregation();
    String query = null;
    String filter = "{\"query\":{\"term\":{\"deleted\":false}}}";

    JsonObject result = aggregationManager.aggregate(query, indexName, aggregation, filter);

    assertNotNull(result, "Result should not be null");
  }

  @Test
  void testAggregateWithFilter_WithBothQueryAndFilterWrapperFormat() throws Exception {
    String indexName = testIndexPrefix + "_filter";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    for (int i = 0; i < 3; i++) {
      indexTestDocument(actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), i, now));
    }

    SearchAggregation aggregation = createTermsAggregation();
    String query = "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"deleted\":false}}]}}}";
    String filter =
        "{\"query\":{\"term\":{\"testDefinition.dataQualityDimension.keyword\":\"Completeness\"}}}";

    JsonObject result = aggregationManager.aggregate(query, indexName, aggregation, filter);

    assertNotNull(result, "Result should not be null");
  }

  @Test
  void testAggregate_ResponseStructure() throws Exception {
    String indexName = testIndexPrefix + "_basic";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    for (int i = 0; i < 5; i++) {
      indexTestDocument(actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), i, now));
    }

    AggregationRequest request = new AggregationRequest();
    request.setIndex(indexName);
    request.setFieldName("testDefinition.dataQualityDimension.keyword");
    request.setSize(10);
    request.setFieldValue(".*");

    Response response = aggregationManager.aggregate(request);

    assertNotNull(response, "Response should not be null");
    assertEquals(200, response.getStatus(), "Response status should be OK");

    String responseJson = (String) response.getEntity();
    assertNotNull(responseJson, "Response JSON should not be null");

    Map<String, Object> responseMap = parseJson(responseJson);

    // Verify response structure
    assertNotNull(responseMap.get("took"), "Response should contain 'took' field");
    assertNotNull(responseMap.get("timed_out"), "Response should contain 'timed_out' field");
    assertNotNull(responseMap.get("_shards"), "Response should contain '_shards' field");
    assertNotNull(responseMap.get("hits"), "Response should contain 'hits' field");
    assertNotNull(responseMap.get("aggregations"), "Response should contain 'aggregations' field");

    // Verify aggregations structure with typed keys
    Map<String, Object> aggregations = (Map<String, Object>) responseMap.get("aggregations");
    assertNotNull(
        aggregations.get("sterms#testDefinition.dataQualityDimension.keyword"),
        "Aggregations should contain the field name with typed key prefix");

    Map<String, Object> aggResult =
        (Map<String, Object>)
            aggregations.get("sterms#testDefinition.dataQualityDimension.keyword");
    assertNotNull(aggResult.get("buckets"), "Aggregation should contain 'buckets'");
  }

  @Test
  void testGenericAggregation_ResponseWithTypedKeys() throws Exception {
    String indexName = testIndexPrefix + "_generic";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    for (int i = 0; i < 5; i++) {
      indexTestDocument(actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), i, now));
    }

    SearchAggregation aggregation = createTermsAggregation();

    DataQualityReport report = aggregationManager.genericAggregation(null, indexName, aggregation);

    assertNotNull(report, "Report should not be null");
    assertNotNull(report.getMetadata(), "Report metadata should not be null");
    assertNotNull(report.getMetadata().getKeys(), "Report keys should not be null");

    // Verify typed keys are preserved
    List<String> keys = report.getMetadata().getKeys();
    assertNotNull(keys, "Keys should not be null");
    assertEquals(1, keys.size(), "Should have one key");
    assertEquals(
        "sterms#dimension",
        keys.get(0),
        "Key should have typed prefix 'sterms#' for terms aggregation");
  }

  @Test
  void testAggregateWithFilter_ResponseStructure() throws Exception {
    String indexName = testIndexPrefix + "_filter";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    for (int i = 0; i < 5; i++) {
      indexTestDocument(actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), i, now));
    }

    SearchAggregation aggregation = createTermsAggregation();
    String query = "{\"bool\":{\"must\":[{\"term\":{\"deleted\":false}}]}}";

    JsonObject result = aggregationManager.aggregate(query, indexName, aggregation, null);

    assertNotNull(result, "Result should not be null");

    // Verify the result contains aggregations with typed keys
    assertNotNull(result.get("sterms#dimension"), "Should contain 'sterms#dimension' key");

    JsonObject aggResult = result.getJsonObject("sterms#dimension");
    assertNotNull(aggResult, "Aggregation result should not be null");
    assertNotNull(aggResult.get("buckets"), "Should contain 'buckets'");
  }

  @Test
  void testDateHistogram_ResponseWithTypedKeys() throws Exception {
    String indexName = testIndexPrefix + "_date_histogram";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    for (int i = 0; i < 5; i++) {
      long timestamp = now - (i * 86400000L);
      indexTestDocument(
          actualIndexName, String.format(TEST_DOCUMENT, UUID.randomUUID(), i, timestamp));
    }

    SearchAggregation aggregation = createDateHistogramAggregation();

    DataQualityReport report = aggregationManager.genericAggregation(null, indexName, aggregation);

    assertNotNull(report, "Report should not be null");
    assertNotNull(report.getMetadata(), "Report metadata should not be null");

    List<String> keys = report.getMetadata().getKeys();
    assertNotNull(keys, "Keys should not be null");
    assertEquals(2, keys.size(), "Should have two keys (date_histogram and value_count)");
    assertEquals("date_histogram#dates", keys.get(0), "First key should be date_histogram");
    assertEquals("value_count#count", keys.get(1), "Second key should be value_count");
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
                                  .properties("name", p -> p.keyword(k -> k))
                                  .properties("description", p -> p.text(t -> t))
                                  .properties("timestamp", p -> p.date(d -> d))
                                  .properties("deleted", p -> p.boolean_(b -> b))
                                  .properties(
                                      "testDefinition",
                                      p ->
                                          p.object(
                                              o ->
                                                  o.properties(
                                                      "dataQualityDimension",
                                                      ep -> ep.keyword(k -> k))))));

      client.indices().create(request);
      LOG.info("Created test index: {}", indexName);
    } catch (Exception e) {
      LOG.debug("Index {} might already exist", indexName);
    }
  }

  private void indexTestDocument(String indexName, String docJson) throws Exception {
    Map<String, Object> doc = parseJson(docJson);
    IndexRequest<Map> indexRequest =
        IndexRequest.of(
            i ->
                i.index(indexName)
                    .id(UUID.randomUUID().toString())
                    .document(doc)
                    .refresh(Refresh.True));
    client.index(indexRequest);
  }

  private Map<String, Object> parseJson(String json) {
    try {
      return objectMapper.readValue(json, new TypeReference<>() {});
    } catch (Exception e) {
      throw new RuntimeException("Failed to parse JSON: " + json, e);
    }
  }

  private SearchAggregation createTermsAggregation() {
    SearchAggregationNode root = new SearchAggregationNode("root", "root", null);

    Map<String, String> termsParams = new HashMap<>();
    termsParams.put("field", "testDefinition.dataQualityDimension.keyword");
    SearchAggregationNode termsNode = new SearchAggregationNode("terms", "dimension", termsParams);

    root.addChild(termsNode);

    return SearchAggregation.fromTree(root);
  }

  private SearchAggregation createDateHistogramAggregation() {
    SearchAggregationNode root = new SearchAggregationNode("root", "root", null);

    Map<String, String> dateHistParams = new HashMap<>();
    dateHistParams.put("field", "timestamp");
    dateHistParams.put("calendar_interval", "1d");
    SearchAggregationNode dateHistNode =
        new SearchAggregationNode("date_histogram", "dates", dateHistParams);

    // Add a value_count metric as child to make date_histogram a proper bucketing aggregation
    Map<String, String> countParams = new HashMap<>();
    countParams.put("field", "id.keyword");
    SearchAggregationNode countNode =
        new SearchAggregationNode("value_count", "count", countParams);

    root.addChild(dateHistNode);
    dateHistNode.addChild(countNode);

    return SearchAggregation.fromTree(root);
  }
}
