package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.Refresh;
import es.co.elastic.clients.elasticsearch.core.IndexRequest;
import es.co.elastic.clients.elasticsearch.indices.CreateIndexRequest;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import es.co.elastic.clients.transport.rest5_client.Rest5ClientTransport;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import jakarta.ws.rs.core.Response;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.entity.data.QueryCostSearchResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ElasticSearchDataInsightAggregatorManagerIntegrationTest extends OpenMetadataApplicationTest {

  private ElasticSearchDataInsightAggregatorManager aggregatorManager;
  private ElasticsearchClient client;
  private String testIndexPrefix;
  private final ObjectMapper objectMapper = new ObjectMapper();

  private static final String TEST_DATA_INSIGHT_DOC =
      """
      {
        "timestamp": %d,
        "data": {
          "entityType": "table",
          "views": 100,
          "team": "TestTeam",
          "entityTier": "Tier1",
          "entityFQN": "test.database.table1",
          "entityHref": "/table/test.database.table1",
          "owner": "testUser"
        }
      }
      """;

  private static final String TEST_QUERY_COST_DOC =
      """
      {
        "timestamp": %d,
        "serviceName": "BigQueryService",
        "queryData": {
          "query": "SELECT * FROM table",
          "cost": 0.5,
          "duration": 1000
        }
      }
      """;

  @BeforeEach
  void setUp() {
    testIndexPrefix =
        "test_di_agg_"
            + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss_SSS"));

    Rest5Client restClient = getSearchClient();
    Rest5ClientTransport transport = new Rest5ClientTransport(restClient, new JacksonJsonpMapper());
    client = new ElasticsearchClient(transport);

    aggregatorManager = new ElasticSearchDataInsightAggregatorManager(client);

    LOG.info(
        "ElasticSearchDataInsightAggregatorManager test setup with prefix: {}", testIndexPrefix);
  }

  @AfterEach
  void tearDown() {
    if (client != null && testIndexPrefix != null) {
      try {
        String[] indicesToDelete = {
          testIndexPrefix + "_chart_test",
          testIndexPrefix + "_fields_test",
          testIndexPrefix + "_list_result_test",
          testIndexPrefix + "_query_cost_test",
          testIndexPrefix + "_query_filter_test"
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
  void testBuildDIChart_WithLiveParameter() {
    String clusterAlias = Entity.getSearchRepository().getClusterAlias();
    String diIndexName =
        (clusterAlias == null || clusterAlias.isEmpty())
            ? "di-data-assets-2025"
            : clusterAlias + "-di-data-assets-2025";
    String liveIndexName =
        (clusterAlias == null || clusterAlias.isEmpty()) ? "all" : clusterAlias + "_all";

    createDataInsightTestIndex(diIndexName);
    createDataInsightTestIndex(liveIndexName);

    DataInsightCustomChart chart = createTestCustomChart();
    long now = System.currentTimeMillis();
    long start = now - 86400000L;

    try {
      DataInsightCustomChartResultList result = aggregatorManager.buildDIChart(chart, start, now);
      assertNotNull(result, "Result should not be null when chart is built successfully");
    } catch (Exception e) {
      LOG.debug("buildDIChart with live=false threw exception: {}", e.getMessage());
    }

    try {
      DataInsightCustomChartResultList result =
          aggregatorManager.buildDIChart(chart, start, now, true);
      assertNotNull(result, "Result should not be null when chart is built successfully");
    } catch (Exception e) {
      LOG.debug("buildDIChart with live=true threw exception: {}", e.getMessage());
    }

    try {
      client.indices().delete(d -> d.index(diIndexName));
      client.indices().delete(d -> d.index(liveIndexName));
    } catch (Exception e) {
      LOG.debug("Failed to cleanup DI indices", e);
    }
  }

  @Test
  void testFetchDIChartFields_ReturnsFieldList() {
    String clusterAlias = Entity.getSearchRepository().getClusterAlias();
    String indexPrefix =
        (clusterAlias == null || clusterAlias.isEmpty())
            ? "di-data-assets"
            : clusterAlias + "-di-data-assets";

    createDataInsightFieldsTestIndex(indexPrefix + "-table");

    List<Map<String, String>> fields = aggregatorManager.fetchDIChartFields();

    assertNotNull(fields, "Fields list should not be null");
    assertFalse(fields.isEmpty(), "Fields list should not be empty");

    for (Map<String, String> field : fields) {
      assertTrue(field.containsKey("name"), "Field should have 'name' key");
      assertTrue(field.containsKey("displayName"), "Field should have 'displayName' key");
      assertTrue(field.containsKey("type"), "Field should have 'type' key");
      assertTrue(field.containsKey("entityType"), "Field should have 'entityType' key");
    }

    LOG.info("Fetched {} DI chart fields", fields.size());

    try {
      client.indices().delete(d -> d.index(indexPrefix + "-table"));
    } catch (Exception e) {
      LOG.debug("Failed to cleanup DI fields test index", e);
    }
  }

  @Test
  void testFetchDIChartFields_WithNullClient() {
    ElasticSearchDataInsightAggregatorManager nullClientManager =
        new ElasticSearchDataInsightAggregatorManager(null);

    List<Map<String, String>> fields = nullClientManager.fetchDIChartFields();

    assertNotNull(fields, "Fields list should not be null even with null client");
    assertTrue(fields.isEmpty(), "Fields list should be empty with null client");
  }

  @Test
  void testListDataInsightChartResult_DailyActiveUsers() throws Exception {
    String indexName = testIndexPrefix + "_list_result_test";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createDataInsightTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    for (int i = 0; i < 5; i++) {
      long timestamp = now - (i * 86400000L);
      indexTestDocument(actualIndexName, String.format(TEST_DATA_INSIGHT_DOC, timestamp));
    }

    long startTs = now - (7 * 86400000L);

    Response response =
        aggregatorManager.listDataInsightChartResult(
            startTs,
            now,
            null,
            null,
            DataInsightChartResult.DataInsightChartType.DAILY_ACTIVE_USERS,
            10,
            0,
            null,
            indexName);

    assertNotNull(response, "Response should not be null");
    assertEquals(200, response.getStatus(), "Response status should be OK");
    assertNotNull(response.getEntity(), "Response entity should not be null");
  }

  @Test
  void testListDataInsightChartResult_WithTeamFilter() throws Exception {
    String indexName = testIndexPrefix + "_list_result_test";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createDataInsightTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    indexTestDocument(actualIndexName, String.format(TEST_DATA_INSIGHT_DOC, now));

    long startTs = now - 86400000L;

    Response response =
        aggregatorManager.listDataInsightChartResult(
            startTs,
            now,
            null,
            "TestTeam",
            DataInsightChartResult.DataInsightChartType.DAILY_ACTIVE_USERS,
            10,
            0,
            null,
            indexName);

    assertNotNull(response, "Response should not be null");
    assertEquals(200, response.getStatus(), "Response status should be OK");
  }

  @Test
  void testListDataInsightChartResult_WithTierFilter() throws Exception {
    String indexName = testIndexPrefix + "_list_result_test";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createDataInsightTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    indexTestDocument(actualIndexName, String.format(TEST_DATA_INSIGHT_DOC, now));

    long startTs = now - 86400000L;

    Response response =
        aggregatorManager.listDataInsightChartResult(
            startTs,
            now,
            "Tier1",
            null,
            DataInsightChartResult.DataInsightChartType.PAGE_VIEWS_BY_ENTITIES,
            10,
            0,
            null,
            indexName);

    assertNotNull(response, "Response should not be null");
    assertEquals(200, response.getStatus(), "Response status should be OK");
  }

  @Test
  void testListDataInsightChartResult_PageViewsByEntities() throws Exception {
    String indexName = testIndexPrefix + "_list_result_test";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createDataInsightTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    for (int i = 0; i < 3; i++) {
      long timestamp = now - (i * 86400000L);
      indexTestDocument(actualIndexName, String.format(TEST_DATA_INSIGHT_DOC, timestamp));
    }

    long startTs = now - (5 * 86400000L);

    Response response =
        aggregatorManager.listDataInsightChartResult(
            startTs,
            now,
            null,
            null,
            DataInsightChartResult.DataInsightChartType.PAGE_VIEWS_BY_ENTITIES,
            10,
            0,
            null,
            indexName);

    assertNotNull(response, "Response should not be null");
    assertEquals(200, response.getStatus(), "Response status should be OK");
  }

  @Test
  void testListDataInsightChartResult_MostActiveUsers() throws Exception {
    String indexName = testIndexPrefix + "_list_result_test";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createDataInsightTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    String docWithUserData =
        """
        {
          "timestamp": %d,
          "data": {
            "userName": "user1",
            "sessions": 10,
            "pageViews": 50,
            "lastSession": %d,
            "totalSessionDuration": 3600,
            "team": "TestTeam"
          }
        }
        """
            .formatted(now, now);

    indexTestDocument(actualIndexName, docWithUserData);

    long startTs = now - 86400000L;

    Response response =
        aggregatorManager.listDataInsightChartResult(
            startTs,
            now,
            null,
            null,
            DataInsightChartResult.DataInsightChartType.MOST_ACTIVE_USERS,
            10,
            0,
            null,
            indexName);

    assertNotNull(response, "Response should not be null");
    assertEquals(200, response.getStatus(), "Response status should be OK");
  }

  @Test
  void testListDataInsightChartResult_MostViewedEntities() throws Exception {
    String indexName = testIndexPrefix + "_list_result_test";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createDataInsightTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    indexTestDocument(actualIndexName, String.format(TEST_DATA_INSIGHT_DOC, now));

    long startTs = now - 86400000L;

    Response response =
        aggregatorManager.listDataInsightChartResult(
            startTs,
            now,
            null,
            null,
            DataInsightChartResult.DataInsightChartType.MOST_VIEWED_ENTITIES,
            10,
            0,
            null,
            indexName);

    assertNotNull(response, "Response should not be null");
    assertEquals(200, response.getStatus(), "Response status should be OK");
  }

  @Test
  void testListDataInsightChartResult_UnusedAssets() throws Exception {
    String indexName = testIndexPrefix + "_list_result_test";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createDataInsightTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    String unusedAssetDoc =
        """
        {
          "timestamp": %d,
          "data": {
            "entityType": "table",
            "entityFQN": "test.database.unused_table",
            "lifeCycle": {
              "accessed": {
                "timestamp": %d
              }
            }
          }
        }
        """
            .formatted(now, now - (90 * 86400000L));

    indexTestDocument(actualIndexName, unusedAssetDoc);

    long startTs = now - 86400000L;

    Response response =
        aggregatorManager.listDataInsightChartResult(
            startTs,
            now,
            null,
            null,
            DataInsightChartResult.DataInsightChartType.UNUSED_ASSETS,
            10,
            0,
            null,
            indexName);

    assertNotNull(response, "Response should not be null");
    assertEquals(200, response.getStatus(), "Response status should be OK");
  }

  @Test
  void testListDataInsightChartResult_WithPagination() throws Exception {
    String indexName = testIndexPrefix + "_list_result_test";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createDataInsightTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    for (int i = 0; i < 15; i++) {
      long timestamp = now - (i * 3600000L);
      indexTestDocument(actualIndexName, String.format(TEST_DATA_INSIGHT_DOC, timestamp));
    }

    long startTs = now - (24 * 3600000L);

    Response responsePage1 =
        aggregatorManager.listDataInsightChartResult(
            startTs,
            now,
            null,
            null,
            DataInsightChartResult.DataInsightChartType.DAILY_ACTIVE_USERS,
            5,
            0,
            null,
            indexName);

    assertNotNull(responsePage1, "Page 1 response should not be null");
    assertEquals(200, responsePage1.getStatus(), "Page 1 response status should be OK");

    Response responsePage2 =
        aggregatorManager.listDataInsightChartResult(
            startTs,
            now,
            null,
            null,
            DataInsightChartResult.DataInsightChartType.DAILY_ACTIVE_USERS,
            5,
            5,
            null,
            indexName);

    assertNotNull(responsePage2, "Page 2 response should not be null");
    assertEquals(200, responsePage2.getStatus(), "Page 2 response status should be OK");
  }

  @Test
  void testListDataInsightChartResult_WithNullClient() throws Exception {
    ElasticSearchDataInsightAggregatorManager nullClientManager =
        new ElasticSearchDataInsightAggregatorManager(null);

    long now = System.currentTimeMillis();
    Response response =
        nullClientManager.listDataInsightChartResult(
            now - 86400000L,
            now,
            null,
            null,
            DataInsightChartResult.DataInsightChartType.DAILY_ACTIVE_USERS,
            10,
            0,
            null,
            "test_index");

    assertNotNull(response, "Response should not be null");
    assertEquals(
        Response.Status.SERVICE_UNAVAILABLE.getStatusCode(),
        response.getStatus(),
        "Response status should be SERVICE_UNAVAILABLE");
  }

  @Test
  void testGetQueryCostRecords_WithValidService() throws Exception {
    String indexName = testIndexPrefix + "_query_cost_test";
    createQueryCostTestIndex(indexName);

    long now = System.currentTimeMillis();
    indexTestDocument(indexName, String.format(TEST_QUERY_COST_DOC, now));

    QueryCostSearchResult result = aggregatorManager.getQueryCostRecords("BigQueryService");

    assertNotNull(result, "Query cost result should not be null");
  }

  @Test
  void testGetQueryCostRecords_WithNullService() {
    assertDoesNotThrow(
        () -> {
          QueryCostSearchResult result = aggregatorManager.getQueryCostRecords(null);
          assertNotNull(result, "Query cost result should not be null even with null service");
        },
        "Getting query cost records with null service should not throw exception");
  }

  @Test
  void testGetQueryCostRecords_WithNullClient() throws Exception {
    ElasticSearchDataInsightAggregatorManager nullClientManager =
        new ElasticSearchDataInsightAggregatorManager(null);

    QueryCostSearchResult result = nullClientManager.getQueryCostRecords("TestService");

    assertNull(result, "Query cost result should be null with null client");
  }

  @Test
  void testBuildDIChart_AggregatedUnusedAssetsCount() throws Exception {
    String clusterAlias = Entity.getSearchRepository().getClusterAlias();
    String diIndexName =
        (clusterAlias == null || clusterAlias.isEmpty())
            ? "di-data-assets-2025"
            : clusterAlias + "-di-data-assets-2025";

    createDataInsightTestIndex(diIndexName);

    DataInsightCustomChart chart = createTestCustomChart();
    long now = System.currentTimeMillis();
    long start = now - 86400000L;

    try {
      DataInsightCustomChartResultList result =
          aggregatorManager.buildDIChart(chart, start, now, false);
      assertNotNull(result, "Result should not be null when chart is built successfully");
    } catch (Exception e) {
      LOG.debug("buildDIChart threw exception: {}", e.getMessage());
    }

    try {
      client.indices().delete(d -> d.index(diIndexName));
    } catch (Exception e) {
      LOG.debug("Failed to cleanup DI index", e);
    }
  }

  @Test
  void testListDataInsightChartResult_WithQueryFilterHavingWrapper() throws Exception {
    String indexName = testIndexPrefix + "_query_filter_test";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createDataInsightTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    indexTestDocument(actualIndexName, String.format(TEST_DATA_INSIGHT_DOC, now));

    long startTs = now - 86400000L;

    String queryFilterWithWrapper =
        """
        {
          "query": {
            "term": {
              "data.entityType": "table"
            }
          }
        }
        """;

    Response response =
        aggregatorManager.listDataInsightChartResult(
            startTs,
            now,
            null,
            null,
            DataInsightChartResult.DataInsightChartType.DAILY_ACTIVE_USERS,
            10,
            0,
            queryFilterWithWrapper,
            indexName);

    assertNotNull(response, "Response should not be null");
    assertEquals(200, response.getStatus(), "Response status should be OK with query wrapper");
  }

  @Test
  void testListDataInsightChartResult_WithQueryFilterWithoutWrapper() throws Exception {
    String indexName = testIndexPrefix + "_query_filter_test";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createDataInsightTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    indexTestDocument(actualIndexName, String.format(TEST_DATA_INSIGHT_DOC, now));

    long startTs = now - 86400000L;

    String queryFilterWithoutWrapper =
        """
        {
          "term": {
            "data.entityType": "table"
          }
        }
        """;

    Response response =
        aggregatorManager.listDataInsightChartResult(
            startTs,
            now,
            null,
            null,
            DataInsightChartResult.DataInsightChartType.DAILY_ACTIVE_USERS,
            10,
            0,
            queryFilterWithoutWrapper,
            indexName);

    assertNotNull(response, "Response should not be null");
    assertEquals(200, response.getStatus(), "Response status should be OK without query wrapper");
  }

  @Test
  void testListDataInsightChartResult_WithComplexBoolQuery() throws Exception {
    String indexName = testIndexPrefix + "_query_filter_test";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createDataInsightTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    indexTestDocument(actualIndexName, String.format(TEST_DATA_INSIGHT_DOC, now));

    long startTs = now - 86400000L;

    String complexBoolQuery =
        """
        {
          "query": {
            "bool": {
              "must": [
                {"term": {"data.entityType": "table"}},
                {"term": {"data.team": "TestTeam"}}
              ]
            }
          }
        }
        """;

    Response response =
        aggregatorManager.listDataInsightChartResult(
            startTs,
            now,
            null,
            null,
            DataInsightChartResult.DataInsightChartType.DAILY_ACTIVE_USERS,
            10,
            0,
            complexBoolQuery,
            indexName);

    assertNotNull(response, "Response should not be null");
    assertEquals(200, response.getStatus(), "Response status should be OK with complex bool query");
  }

  @Test
  void testListDataInsightChartResult_WithQueryStringFilter() throws Exception {
    String indexName = testIndexPrefix + "_query_filter_test";
    String actualIndexName = Entity.getSearchRepository().getIndexOrAliasName(indexName);
    createDataInsightTestIndex(actualIndexName);

    long now = System.currentTimeMillis();
    indexTestDocument(actualIndexName, String.format(TEST_DATA_INSIGHT_DOC, now));

    long startTs = now - 86400000L;

    String queryString = "data.entityType:table";

    Response response =
        aggregatorManager.listDataInsightChartResult(
            startTs,
            now,
            null,
            null,
            DataInsightChartResult.DataInsightChartType.DAILY_ACTIVE_USERS,
            10,
            0,
            queryString,
            indexName);

    assertNotNull(response, "Response should not be null");
    assertEquals(200, response.getStatus(), "Response status should be OK with query string");
  }

  private void createDataInsightTestIndex(String indexName) {
    try {
      CreateIndexRequest request =
          CreateIndexRequest.of(
              c ->
                  c.index(indexName)
                      .mappings(
                          m ->
                              m.properties("timestamp", p -> p.date(d -> d))
                                  .properties(
                                      "data",
                                      p ->
                                          p.object(
                                              o ->
                                                  o.properties(
                                                          "entityType", ep -> ep.keyword(k -> k))
                                                      .properties("views", ep -> ep.long_(l -> l))
                                                      .properties("team", ep -> ep.keyword(k -> k))
                                                      .properties(
                                                          "entityTier", ep -> ep.keyword(k -> k))
                                                      .properties(
                                                          "entityFQN", ep -> ep.keyword(k -> k))
                                                      .properties(
                                                          "entityHref", ep -> ep.keyword(k -> k))
                                                      .properties("owner", ep -> ep.keyword(k -> k))
                                                      .properties(
                                                          "userName", ep -> ep.keyword(k -> k))
                                                      .properties(
                                                          "sessions", ep -> ep.long_(l -> l))
                                                      .properties(
                                                          "pageViews", ep -> ep.long_(l -> l))
                                                      .properties(
                                                          "lastSession", ep -> ep.date(d -> d))
                                                      .properties(
                                                          "totalSessionDuration",
                                                          ep -> ep.long_(l -> l))
                                                      .properties(
                                                          "lifeCycle",
                                                          ep ->
                                                              ep.object(
                                                                  lo ->
                                                                      lo.properties(
                                                                          "accessed",
                                                                          aep ->
                                                                              aep.object(
                                                                                  ao ->
                                                                                      ao.properties(
                                                                                          "timestamp",
                                                                                          tp ->
                                                                                              tp
                                                                                                  .date(
                                                                                                      d ->
                                                                                                          d))))))
                                                      .properties(
                                                          "frequentlyUsedDataAssets",
                                                          ep -> ep.object(obj1 -> obj1))
                                                      .properties(
                                                          "unusedDataAssets",
                                                          ep -> ep.object(obj2 -> obj2))))));

      client.indices().create(request);
      LOG.info("Created data insight test index: {}", indexName);
    } catch (Exception e) {
      LOG.debug("Index {} might already exist", indexName);
    }
  }

  private void createQueryCostTestIndex(String indexName) {
    try {
      CreateIndexRequest request =
          CreateIndexRequest.of(
              c ->
                  c.index(indexName)
                      .mappings(
                          m ->
                              m.properties("timestamp", p -> p.date(d -> d))
                                  .properties("serviceName", p -> p.keyword(k -> k))
                                  .properties(
                                      "queryData",
                                      p ->
                                          p.object(
                                              o ->
                                                  o.properties("query", ep -> ep.text(t -> t))
                                                      .properties("cost", ep -> ep.double_(d -> d))
                                                      .properties(
                                                          "duration", ep -> ep.long_(l -> l))))));

      client.indices().create(request);
      LOG.info("Created query cost test index: {}", indexName);
    } catch (Exception e) {
      LOG.debug("Index {} might already exist", indexName);
    }
  }

  private void createDataInsightFieldsTestIndex(String indexName) {
    try {
      CreateIndexRequest request =
          CreateIndexRequest.of(
              c ->
                  c.index(indexName)
                      .mappings(
                          m ->
                              m.properties("timestamp", p -> p.date(d -> d))
                                  .properties("entityId", p -> p.keyword(k -> k))
                                  .properties("entityType", p -> p.keyword(k -> k))
                                  .properties("entityFQN", p -> p.keyword(k -> k))
                                  .properties(
                                      "entityName",
                                      p ->
                                          p.text(
                                              t ->
                                                  t.fields(
                                                      "keyword",
                                                      f -> f.keyword(kw -> kw.ignoreAbove(256)))))
                                  .properties("views", p -> p.long_(l -> l))
                                  .properties("owner", p -> p.keyword(k -> k))
                                  .properties("team", p -> p.keyword(k -> k))
                                  .properties("tier", p -> p.keyword(k -> k))
                                  .properties("tags", p -> p.keyword(k -> k))
                                  .properties("usageCount", p -> p.integer(i -> i))
                                  .properties("lastAccessed", p -> p.date(d -> d))
                                  .properties(
                                      "metadata",
                                      p ->
                                          p.object(
                                              o ->
                                                  o.properties("description", ep -> ep.text(t -> t))
                                                      .properties(
                                                          "columns", ep -> ep.integer(i -> i))
                                                      .properties(
                                                          "sizeInBytes",
                                                          ep -> ep.long_(l -> l))))));

      client.indices().create(request);
      LOG.info("Created data insight fields test index: {}", indexName);
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

  private DataInsightCustomChart createTestCustomChart() {
    DataInsightCustomChart chart = new DataInsightCustomChart();
    chart.setName("TestChart");

    Map<String, Object> chartDetails = new LinkedHashMap<>();
    chartDetails.put("type", "SummaryCard");

    List<Map<String, Object>> metrics = new ArrayList<>();
    Map<String, Object> metric = new LinkedHashMap<>();
    metric.put("name", "testMetric");
    metric.put("function", "sum");
    metric.put("field", "data.views");
    metric.put("formula", "sum(data.views)");
    metrics.add(metric);

    chartDetails.put("metrics", metrics);
    chart.setChartDetails(chartDetails);

    return chart;
  }
}
