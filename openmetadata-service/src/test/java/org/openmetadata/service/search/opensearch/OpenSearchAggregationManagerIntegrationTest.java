package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.hc.core5.http.HttpHost;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.search.TopHits;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.tests.Datum;
import org.openmetadata.schema.tests.type.DataQualityReportMetadata;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.search.SearchAggregation;
import org.openmetadata.service.search.SearchAggregationNode;
import org.openmetadata.service.search.SearchIndexUtils;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.Refresh;
import os.org.opensearch.client.opensearch.core.IndexRequest;
import os.org.opensearch.client.opensearch.indices.CreateIndexRequest;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5Transport;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5TransportBuilder;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class OpenSearchAggregationManagerIntegrationTest extends OpenMetadataApplicationTest {

  private OpenSearchAggregationManager aggregationManager;
  private OpenSearchClient client;
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
        "test_agg_os_"
            + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss_SSS"));

    client = createOpenSearchClient();
    aggregationManager = new OpenSearchAggregationManager(client);

    LOG.info("OpenSearchAggregationManager test setup with prefix: {}", testIndexPrefix);
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
    OpenSearchAggregationManager nullClientManager = new OpenSearchAggregationManager(null);

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
    OpenSearchAggregationManager nullClientManager = new OpenSearchAggregationManager(null);

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
    OpenSearchAggregationManager nullClientManager = new OpenSearchAggregationManager(null);

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

  @Test
  void testParseAggregationResults_DateHistogramWithValueCount() {
    SearchAggregationNode root = new SearchAggregationNode("root", "root", null);

    Map<String, String> dateHistParams = new HashMap<>();
    dateHistParams.put("field", "timestamp");
    dateHistParams.put("calendar_interval", "1d");
    SearchAggregationNode dateHistNode =
        new SearchAggregationNode("date_histogram", "byDay", dateHistParams);

    Map<String, String> countParams = new HashMap<>();
    countParams.put("field", "id.keyword");
    SearchAggregationNode countNode =
        new SearchAggregationNode("value_count", "count", countParams);

    root.addChild(dateHistNode);
    dateHistNode.addChild(countNode);

    SearchAggregation aggregation = SearchAggregation.fromTree(root);
    DataQualityReportMetadata metadata = aggregation.getAggregationMetadata();

    JsonObject aggregationResults =
        Json.createObjectBuilder()
            .add(
                "date_histogram#byDay",
                Json.createObjectBuilder()
                    .add(
                        "buckets",
                        Json.createArrayBuilder()
                            .add(
                                Json.createObjectBuilder()
                                    .add("key", 1704067200000L)
                                    .add("doc_count", 5)
                                    .add(
                                        "value_count#count",
                                        Json.createObjectBuilder().add("value", 5)))))
            .build();

    DataQualityReport report =
        SearchIndexUtils.parseAggregationResults(Optional.of(aggregationResults), metadata);

    assertNotNull(report);
    assertNotNull(report.getData());
    assertEquals(1, report.getData().size());

    Datum datum = report.getData().get(0);
    assertEquals("1704067200000", datum.getAdditionalProperties().get("timestamp"));
    assertEquals("5", datum.getAdditionalProperties().get("id.keyword"));
  }

  @Test
  void testParseAggregationResults_DateHistogramWithNestedTermsAndMetric() {
    SearchAggregationNode root = new SearchAggregationNode("root", "root", null);

    Map<String, String> dateHistParams = new HashMap<>();
    dateHistParams.put("field", "timestamp");
    dateHistParams.put("calendar_interval", "1d");
    SearchAggregationNode dateHistNode =
        new SearchAggregationNode("date_histogram", "byDay", dateHistParams);

    Map<String, String> nestedParams = new HashMap<>();
    nestedParams.put("path", "testCaseResults");
    SearchAggregationNode nestedNode = new SearchAggregationNode("nested", "byTerm", nestedParams);

    Map<String, String> termsParams = new HashMap<>();
    termsParams.put("field", "testCaseResults.testCaseStatus.keyword");
    SearchAggregationNode termsNode = new SearchAggregationNode("terms", "status", termsParams);

    Map<String, String> avgParams = new HashMap<>();
    avgParams.put("field", "testCaseResults.result");
    SearchAggregationNode avgNode = new SearchAggregationNode("avg", "avgMetric", avgParams);

    root.addChild(dateHistNode);
    dateHistNode.addChild(nestedNode);
    nestedNode.addChild(termsNode);
    termsNode.addChild(avgNode);

    SearchAggregation aggregation = SearchAggregation.fromTree(root);
    DataQualityReportMetadata metadata = aggregation.getAggregationMetadata();

    assertEquals(
        List.of("date_histogram#byDay", "nested#byTerm", "sterms#status", "avg#avgMetric"),
        metadata.getKeys());
    assertEquals(
        List.of("timestamp", "testCaseResults.testCaseStatus.keyword"), metadata.getDimensions());
    assertEquals(List.of("testCaseResults.result"), metadata.getMetrics());

    JsonObject aggregationResults =
        Json.createObjectBuilder()
            .add(
                "date_histogram#byDay",
                Json.createObjectBuilder()
                    .add(
                        "buckets",
                        Json.createArrayBuilder()
                            .add(
                                Json.createObjectBuilder()
                                    .add("key", 1704067200000L)
                                    .add("doc_count", 10)
                                    .add(
                                        "nested#byTerm",
                                        Json.createObjectBuilder()
                                            .add("doc_count", 10)
                                            .add(
                                                "sterms#status",
                                                Json.createObjectBuilder()
                                                    .add(
                                                        "buckets",
                                                        Json.createArrayBuilder()
                                                            .add(
                                                                Json.createObjectBuilder()
                                                                    .add("key", "Success")
                                                                    .add("doc_count", 8)
                                                                    .add(
                                                                        "avg#avgMetric",
                                                                        Json.createObjectBuilder()
                                                                            .add("value", 95)))
                                                            .add(
                                                                Json.createObjectBuilder()
                                                                    .add("key", "Failed")
                                                                    .add("doc_count", 2)
                                                                    .add(
                                                                        "avg#avgMetric",
                                                                        Json.createObjectBuilder()
                                                                            .add(
                                                                                "value", 42)))))))))
            .build();

    DataQualityReport report =
        SearchIndexUtils.parseAggregationResults(Optional.of(aggregationResults), metadata);

    assertNotNull(report);
    assertNotNull(report.getData());
    assertEquals(2, report.getData().size());

    Datum successDatum = report.getData().get(0);
    assertEquals("1704067200000", successDatum.getAdditionalProperties().get("timestamp"));
    assertEquals(
        "Success",
        successDatum.getAdditionalProperties().get("testCaseResults.testCaseStatus.keyword"));
    assertEquals("95", successDatum.getAdditionalProperties().get("testCaseResults.result"));

    Datum failedDatum = report.getData().get(1);
    assertEquals("1704067200000", failedDatum.getAdditionalProperties().get("timestamp"));
    assertEquals(
        "Failed",
        failedDatum.getAdditionalProperties().get("testCaseResults.testCaseStatus.keyword"));
    assertEquals("42", failedDatum.getAdditionalProperties().get("testCaseResults.result"));
  }

  @Test
  void testParseAggregationResults_MultipleDateBucketsWithNestedTerms() {
    SearchAggregationNode root = new SearchAggregationNode("root", "root", null);

    Map<String, String> dateHistParams = new HashMap<>();
    dateHistParams.put("field", "timestamp");
    dateHistParams.put("calendar_interval", "1d");
    SearchAggregationNode dateHistNode =
        new SearchAggregationNode("date_histogram", "byDay", dateHistParams);

    Map<String, String> nestedParams = new HashMap<>();
    nestedParams.put("path", "testCaseResults");
    SearchAggregationNode nestedNode = new SearchAggregationNode("nested", "byTerm", nestedParams);

    Map<String, String> termsParams = new HashMap<>();
    termsParams.put("field", "testCaseResults.status");
    SearchAggregationNode termsNode = new SearchAggregationNode("terms", "status", termsParams);

    Map<String, String> avgParams = new HashMap<>();
    avgParams.put("field", "testCaseResults.result");
    SearchAggregationNode avgNode = new SearchAggregationNode("avg", "avgMetric", avgParams);

    root.addChild(dateHistNode);
    dateHistNode.addChild(nestedNode);
    nestedNode.addChild(termsNode);
    termsNode.addChild(avgNode);

    SearchAggregation aggregation = SearchAggregation.fromTree(root);
    DataQualityReportMetadata metadata = aggregation.getAggregationMetadata();

    JsonObject aggregationResults =
        Json.createObjectBuilder()
            .add(
                "date_histogram#byDay",
                Json.createObjectBuilder()
                    .add(
                        "buckets",
                        Json.createArrayBuilder()
                            .add(
                                Json.createObjectBuilder()
                                    .add("key", 1704067200000L)
                                    .add("doc_count", 10)
                                    .add(
                                        "nested#byTerm",
                                        Json.createObjectBuilder()
                                            .add("doc_count", 10)
                                            .add(
                                                "sterms#status",
                                                Json.createObjectBuilder()
                                                    .add(
                                                        "buckets",
                                                        Json.createArrayBuilder()
                                                            .add(
                                                                Json.createObjectBuilder()
                                                                    .add("key", "Success")
                                                                    .add("doc_count", 8)
                                                                    .add(
                                                                        "avg#avgMetric",
                                                                        Json.createObjectBuilder()
                                                                            .add("value", 95)))))))
                            .add(
                                Json.createObjectBuilder()
                                    .add("key", 1704153600000L)
                                    .add("doc_count", 6)
                                    .add(
                                        "nested#byTerm",
                                        Json.createObjectBuilder()
                                            .add("doc_count", 6)
                                            .add(
                                                "sterms#status",
                                                Json.createObjectBuilder()
                                                    .add(
                                                        "buckets",
                                                        Json.createArrayBuilder()
                                                            .add(
                                                                Json.createObjectBuilder()
                                                                    .add("key", "Failed")
                                                                    .add("doc_count", 4)
                                                                    .add(
                                                                        "avg#avgMetric",
                                                                        Json.createObjectBuilder()
                                                                            .add("value", 30)))
                                                            .add(
                                                                Json.createObjectBuilder()
                                                                    .add("key", "Success")
                                                                    .add("doc_count", 2)
                                                                    .add(
                                                                        "avg#avgMetric",
                                                                        Json.createObjectBuilder()
                                                                            .add(
                                                                                "value", 88)))))))))
            .build();

    DataQualityReport report =
        SearchIndexUtils.parseAggregationResults(Optional.of(aggregationResults), metadata);

    assertNotNull(report);
    assertEquals(3, report.getData().size());

    Datum day1 = report.getData().get(0);
    assertEquals("1704067200000", day1.getAdditionalProperties().get("timestamp"));
    assertEquals("Success", day1.getAdditionalProperties().get("testCaseResults.status"));
    assertEquals("95", day1.getAdditionalProperties().get("testCaseResults.result"));

    Datum day2Failed = report.getData().get(1);
    assertEquals("1704153600000", day2Failed.getAdditionalProperties().get("timestamp"));
    assertEquals("Failed", day2Failed.getAdditionalProperties().get("testCaseResults.status"));
    assertEquals("30", day2Failed.getAdditionalProperties().get("testCaseResults.result"));

    Datum day2Success = report.getData().get(2);
    assertEquals("1704153600000", day2Success.getAdditionalProperties().get("timestamp"));
    assertEquals("Success", day2Success.getAdditionalProperties().get("testCaseResults.status"));
    assertEquals("88", day2Success.getAdditionalProperties().get("testCaseResults.result"));
  }

  @Test
  void testParseAggregationResults_SimpleTermsAggregation() {
    SearchAggregationNode root = new SearchAggregationNode("root", "root", null);

    Map<String, String> termsParams = new HashMap<>();
    termsParams.put("field", "status.keyword");
    SearchAggregationNode termsNode = new SearchAggregationNode("terms", "byStatus", termsParams);

    root.addChild(termsNode);

    SearchAggregation aggregation = SearchAggregation.fromTree(root);
    DataQualityReportMetadata metadata = aggregation.getAggregationMetadata();

    assertEquals(List.of("sterms#byStatus"), metadata.getKeys());
    assertEquals(List.of("status.keyword"), metadata.getDimensions());
    assertEquals(List.of("document_count"), metadata.getMetrics());

    JsonObject aggregationResults =
        Json.createObjectBuilder()
            .add(
                "sterms#byStatus",
                Json.createObjectBuilder()
                    .add(
                        "buckets",
                        Json.createArrayBuilder()
                            .add(
                                Json.createObjectBuilder()
                                    .add("key", "Active")
                                    .add("doc_count", 10))
                            .add(
                                Json.createObjectBuilder()
                                    .add("key", "Inactive")
                                    .add("doc_count", 3))))
            .build();

    DataQualityReport report =
        SearchIndexUtils.parseAggregationResults(Optional.of(aggregationResults), metadata);

    assertNotNull(report);
    assertEquals(2, report.getData().size());

    Datum active = report.getData().get(0);
    assertEquals("Active", active.getAdditionalProperties().get("status.keyword"));
    assertEquals("10", active.getAdditionalProperties().get("document_count"));

    Datum inactive = report.getData().get(1);
    assertEquals("Inactive", inactive.getAdditionalProperties().get("status.keyword"));
    assertEquals("3", inactive.getAdditionalProperties().get("document_count"));
  }

  @Test
  void testParseAggregationResults_EmptyResults() {
    SearchAggregationNode root = new SearchAggregationNode("root", "root", null);

    Map<String, String> dateHistParams = new HashMap<>();
    dateHistParams.put("field", "timestamp");
    dateHistParams.put("calendar_interval", "1d");
    SearchAggregationNode dateHistNode =
        new SearchAggregationNode("date_histogram", "byDay", dateHistParams);

    Map<String, String> countParams = new HashMap<>();
    countParams.put("field", "id.keyword");
    SearchAggregationNode countNode =
        new SearchAggregationNode("value_count", "count", countParams);

    root.addChild(dateHistNode);
    dateHistNode.addChild(countNode);

    SearchAggregation aggregation = SearchAggregation.fromTree(root);
    DataQualityReportMetadata metadata = aggregation.getAggregationMetadata();

    DataQualityReport report = SearchIndexUtils.parseAggregationResults(Optional.empty(), metadata);

    assertNotNull(report);
    assertNotNull(report.getData());
    assertEquals(0, report.getData().size());
  }

  @Test
  void testParseAggregationResults_EmptyBuckets() {
    SearchAggregationNode root = new SearchAggregationNode("root", "root", null);

    Map<String, String> dateHistParams = new HashMap<>();
    dateHistParams.put("field", "timestamp");
    dateHistParams.put("calendar_interval", "1d");
    SearchAggregationNode dateHistNode =
        new SearchAggregationNode("date_histogram", "byDay", dateHistParams);

    Map<String, String> countParams = new HashMap<>();
    countParams.put("field", "id.keyword");
    SearchAggregationNode countNode =
        new SearchAggregationNode("value_count", "count", countParams);

    root.addChild(dateHistNode);
    dateHistNode.addChild(countNode);

    SearchAggregation aggregation = SearchAggregation.fromTree(root);
    DataQualityReportMetadata metadata = aggregation.getAggregationMetadata();

    JsonObject aggregationResults =
        Json.createObjectBuilder()
            .add(
                "date_histogram#byDay",
                Json.createObjectBuilder().add("buckets", Json.createArrayBuilder()))
            .build();

    DataQualityReport report =
        SearchIndexUtils.parseAggregationResults(Optional.of(aggregationResults), metadata);

    assertNotNull(report);
    assertNotNull(report.getData());
    assertEquals(0, report.getData().size());
  }

  @Test
  void testParseAggregationResults_NestedWithEmptyTermsBuckets() {
    SearchAggregationNode root = new SearchAggregationNode("root", "root", null);

    Map<String, String> dateHistParams = new HashMap<>();
    dateHistParams.put("field", "timestamp");
    dateHistParams.put("calendar_interval", "1d");
    SearchAggregationNode dateHistNode =
        new SearchAggregationNode("date_histogram", "byDay", dateHistParams);

    Map<String, String> nestedParams = new HashMap<>();
    nestedParams.put("path", "testCaseResults");
    SearchAggregationNode nestedNode = new SearchAggregationNode("nested", "byTerm", nestedParams);

    Map<String, String> termsParams = new HashMap<>();
    termsParams.put("field", "testCaseResults.status");
    SearchAggregationNode termsNode = new SearchAggregationNode("terms", "status", termsParams);

    Map<String, String> avgParams = new HashMap<>();
    avgParams.put("field", "testCaseResults.result");
    SearchAggregationNode avgNode = new SearchAggregationNode("avg", "avgMetric", avgParams);

    root.addChild(dateHistNode);
    dateHistNode.addChild(nestedNode);
    nestedNode.addChild(termsNode);
    termsNode.addChild(avgNode);

    SearchAggregation aggregation = SearchAggregation.fromTree(root);
    DataQualityReportMetadata metadata = aggregation.getAggregationMetadata();

    JsonObject aggregationResults =
        Json.createObjectBuilder()
            .add(
                "date_histogram#byDay",
                Json.createObjectBuilder()
                    .add(
                        "buckets",
                        Json.createArrayBuilder()
                            .add(
                                Json.createObjectBuilder()
                                    .add("key", 1704067200000L)
                                    .add("doc_count", 0)
                                    .add(
                                        "nested#byTerm",
                                        Json.createObjectBuilder()
                                            .add("doc_count", 0)
                                            .add(
                                                "sterms#status",
                                                Json.createObjectBuilder()
                                                    .add("buckets", Json.createArrayBuilder()))))))
            .build();

    DataQualityReport report =
        SearchIndexUtils.parseAggregationResults(Optional.of(aggregationResults), metadata);

    assertNotNull(report);
    assertNotNull(report.getData());
    assertEquals(0, report.getData().size());
  }

  @Test
  void testParseAggregationResults_WithAggregationQueryString() {
    String aggQuery =
        "aggType=date_histogram:bucketName=byDay:field=timestamp&calendar_interval=1d,"
            + "aggType=nested:bucketName=byTerm:path=testCaseResults,"
            + "aggType=terms:bucketName=status:field=testCaseResults.testCaseStatus.keyword,"
            + "aggType=avg:bucketName=avgMetric:field=testCaseResults.result";

    SearchAggregation aggregation = SearchIndexUtils.buildAggregationTree(aggQuery);
    DataQualityReportMetadata metadata = aggregation.getAggregationMetadata();

    assertEquals(
        List.of("date_histogram#byDay", "nested#byTerm", "sterms#status", "avg#avgMetric"),
        metadata.getKeys());
    assertEquals(
        List.of("timestamp", "testCaseResults.testCaseStatus.keyword"), metadata.getDimensions());
    assertEquals(List.of("testCaseResults.result"), metadata.getMetrics());

    JsonObject aggregationResults =
        Json.createObjectBuilder()
            .add(
                "date_histogram#byDay",
                Json.createObjectBuilder()
                    .add(
                        "buckets",
                        Json.createArrayBuilder()
                            .add(
                                Json.createObjectBuilder()
                                    .add("key", 1704067200000L)
                                    .add("doc_count", 5)
                                    .add(
                                        "nested#byTerm",
                                        Json.createObjectBuilder()
                                            .add("doc_count", 5)
                                            .add(
                                                "sterms#status",
                                                Json.createObjectBuilder()
                                                    .add(
                                                        "buckets",
                                                        Json.createArrayBuilder()
                                                            .add(
                                                                Json.createObjectBuilder()
                                                                    .add("key", "Success")
                                                                    .add("doc_count", 5)
                                                                    .add(
                                                                        "avg#avgMetric",
                                                                        Json.createObjectBuilder()
                                                                            .add(
                                                                                "value",
                                                                                100)))))))))
            .build();

    DataQualityReport report =
        SearchIndexUtils.parseAggregationResults(Optional.of(aggregationResults), metadata);

    assertNotNull(report);
    assertEquals(1, report.getData().size());

    Datum datum = report.getData().get(0);
    assertEquals("1704067200000", datum.getAdditionalProperties().get("timestamp"));
    assertEquals(
        "Success", datum.getAdditionalProperties().get("testCaseResults.testCaseStatus.keyword"));
    assertEquals("100", datum.getAdditionalProperties().get("testCaseResults.result"));
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
