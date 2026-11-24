/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResult;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.LineChartMetric;
import org.openmetadata.schema.dataInsight.custom.SummaryCard;
import org.openmetadata.schema.dataInsight.custom.SummaryChartMetric;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

/**
 * Proves that the "total data assets" summary card and the per-entity-type breakdown below it count
 * the same documents (issue #31478).
 *
 * <p>{@code di-data-assets-*} resolves the data-quality aliases as well as the data-asset data
 * streams, and a test case result is a time series, not an entity, so its document carries no
 * {@code entityType}. The breakdown aggregates with a {@code terms} aggregation on {@code
 * entityType.keyword}, which puts a document missing that field in no bucket at all; the card used
 * to filter with a list of {@code must_not} term clauses, every one of which such a document
 * satisfies. The card therefore ran ahead of the chart by exactly the number of data-quality
 * documents in the window.
 *
 * <p>The fixture mirrors that shape against a real OpenSearch node and drives the production
 * aggregators end to end through {@link OpenSearchClient#buildDIChart}.
 */
class DataAssetChartScopeTest {

  private static final long TIMESTAMP = 1_700_000_000_000L;
  private static final long ONE_DAY = 24L * 60 * 60 * 1000;
  private static final long START = TIMESTAMP - ONE_DAY;
  private static final long END = TIMESTAMP + ONE_DAY;

  private static final int DASHBOARD_COUNT = 2;
  private static final int GLOSSARY_TERM_COUNT = 1;
  private static final int DATA_PRODUCT_COUNT = 1;
  private static final int TEST_CASE_RESULT_COUNT = 4;
  private static final int STAMPED_TEST_CASE_COUNT = 3;
  private static final List<String> TABLE_FQNS =
      List.of("svc.db.sch.orders", "svc.db.sch.users", "svc.db.sch.events");
  private static final int TABLE_COUNT = TABLE_FQNS.size();
  // Two tables are covered: orders by two test cases, users by one. events has
  // none.
  private static final List<String> TEST_CASE_ORIGINS =
      List.of("svc.db.sch.orders", "svc.db.sch.orders", "svc.db.sch.users");

  private static final double EXPECTED_DATA_ASSETS = TABLE_COUNT + DASHBOARD_COUNT;

  private static final String ASSET_MAPPING =
      """
      {"mappings":{"properties":{
        "@timestamp":{"type":"date","format":"epoch_millis"},
        "id":{"type":"keyword","fields":{"keyword":{"type":"keyword"}}},
        "fullyQualifiedName":{"type":"keyword","fields":{"keyword":{"type":"keyword"}}},
        "entityType":{"type":"keyword","fields":{"keyword":{"type":"keyword"}}}}}}""";

  /**
   * The live test case index. Like the real one it has no {@code @timestamp}, so non-live charts
   * never match its documents; entityType.keyword and originEntityFQN are lowercase-normalized.
   */
  private static final String TEST_CASE_MAPPING =
      """
      {"settings":{"analysis":{"normalizer":{"lowercase_normalizer":{
          "type":"custom","char_filter":[],"filter":["lowercase"]}}}},
       "mappings":{"properties":{
        "id":{"type":"text","fields":{"keyword":{"type":"keyword","ignore_above":256}}},
        "originEntityFQN":{"type":"keyword","normalizer":"lowercase_normalizer"},
        "entityType":{"type":"keyword","fields":{"keyword":{
          "type":"keyword","normalizer":"lowercase_normalizer","ignore_above":256}}}}}}""";

  /** A test case index that does carry a timestamp: the scope must hold even then. */
  private static final String STAMPED_TEST_CASE_MAPPING =
      """
      {"settings":{"analysis":{"normalizer":{"lowercase_normalizer":{
          "type":"custom","char_filter":[],"filter":["lowercase"]}}}},
       "mappings":{"properties":{
        "@timestamp":{"type":"date","format":"epoch_millis"},
        "id":{"type":"keyword","fields":{"keyword":{"type":"keyword"}}},
        "entityType":{"type":"keyword","fields":{"keyword":{
          "type":"keyword","normalizer":"lowercase_normalizer","ignore_above":256}}}}}}""";

  /** The live {@code all} alias, which the summary card reads in live mode. */
  private static final String ALL_MAPPING =
      """
      {"settings":{"analysis":{"normalizer":{"lowercase_normalizer":{
          "type":"custom","char_filter":[],"filter":["lowercase"]}}}},
       "mappings":{"properties":{
        "id":{"type":"keyword","fields":{"keyword":{"type":"keyword"}}},
        "service":{"properties":{"name":{"type":"keyword","fields":{"keyword":{"type":"keyword"}}}}},
        "fullyQualifiedName":{"type":"keyword","fields":{"keyword":{"type":"keyword"}}},
        "originEntityFQN":{"type":"keyword","normalizer":"lowercase_normalizer"},
        "entityType":{"type":"keyword","fields":{"keyword":{
          "type":"keyword","normalizer":"lowercase_normalizer","ignore_above":256}}}}}}""";

  private static final String DATA_QUALITY_MAPPING =
      """
      {"mappings":{"properties":{
        "@timestamp":{"type":"date","format":"epoch_millis"},
        "id":{"type":"keyword","fields":{"keyword":{"type":"keyword"}}}}}}""";

  private static final HttpClient HTTP = HttpClient.newHttpClient();

  private static GenericContainer<?> opensearch;
  private static OpenSearchClient osClient;
  private static String baseUrl;

  @BeforeAll
  static void startOpenSearch() throws Exception {
    assumeTrue(DockerClientFactory.instance().isDockerAvailable(), "Docker is required");
    opensearch =
        new GenericContainer<>(DockerImageName.parse("opensearchproject/opensearch:2.13.0"))
            .withEnv("discovery.type", "single-node")
            .withEnv("DISABLE_SECURITY_PLUGIN", "true")
            .withEnv("DISABLE_INSTALL_DEMO_CONFIG", "true")
            .withEnv("OPENSEARCH_JAVA_OPTS", "-Xms1g -Xmx1g")
            .withExposedPorts(9200)
            .waitingFor(Wait.forHttp("/").forPort(9200).forStatusCode(200))
            .withStartupTimeout(Duration.ofMinutes(3));
    opensearch.start();
    baseUrl = String.format("http://%s:%d", opensearch.getHost(), opensearch.getMappedPort(9200));

    SearchRepository searchRepository = mock(SearchRepository.class);
    lenient().when(searchRepository.getClusterAlias()).thenReturn(null);
    Entity.setSearchRepository(searchRepository);

    osClient =
        new OpenSearchClient(
            new ElasticSearchConfiguration()
                .withHost(opensearch.getHost())
                .withPort(opensearch.getMappedPort(9200))
                .withScheme("http")
                .withConnectionTimeoutSecs(10)
                .withSocketTimeoutSecs(60)
                .withBatchSize(10)
                .withClusterAlias("")
                .withSearchType(ElasticSearchConfiguration.SearchType.OPENSEARCH));

    seedDataInsightsIndices();
  }

  @AfterAll
  static void stopOpenSearch() {
    if (osClient != null) {
      osClient.close();
    }
    if (opensearch != null) {
      opensearch.stop();
    }
  }

  @Test
  void summaryCardCountsOnlyWhatTheBreakdownCharts() throws Exception {
    double cardTotal =
        onlyCount(osClient.buildDIChart(totalDataAssetsSummaryCard(), START, END, false));
    List<DataInsightCustomChartResult> breakdown =
        osClient.buildDIChart(totalDataAssets(), START, END, false).getResults();

    double breakdownTotal =
        breakdown.stream().mapToDouble(DataInsightCustomChartResult::getCount).sum();

    assertEquals(
        EXPECTED_DATA_ASSETS,
        breakdownTotal,
        "Breakdown must cover every data asset and nothing else");
    assertEquals(
        breakdownTotal,
        cardTotal,
        "Summary card must not count documents the breakdown leaves out");
  }

  @Test
  void breakdownOmitsGovernanceArtifacts() throws Exception {
    Set<String> groups =
        osClient.buildDIChart(totalDataAssets(), START, END, false).getResults().stream()
            .map(DataInsightCustomChartResult::getGroup)
            .collect(Collectors.toSet());

    assertEquals(Set.of("table", "dashboard"), groups);
  }

  @Test
  void liveChartCountsTestCasesPerTable() throws Exception {
    List<DataInsightCustomChartResult> perTable =
        osClient.buildDIChart(testCasesByTable(), START, END, true).getResults();

    Map<String, Double> countsByTable =
        perTable.stream()
            .collect(
                Collectors.toMap(
                    DataInsightCustomChartResult::getTerm, DataInsightCustomChartResult::getCount));
    // originEntityFQN is lowercase-normalized, so the bucket keys are lowercase table FQNs.
    assertEquals(Map.of("svc.db.sch.orders", 2.0, "svc.db.sch.users", 1.0), countsByTable);
  }

  @Test
  void shareOfTablesWithoutTestsMatchesTheSeededDataset() throws Exception {
    List<DataInsightCustomChartResult> results =
        osClient.buildDIChart(tablesWithoutTestsShare(), START, END, true).getResults();
    assertEquals(1, results.size(), "Tables and test cases of one service must share its bucket");
    double share = results.getFirst().getCount();

    double expected =
        100.0 * (TABLE_FQNS.size() - Set.copyOf(TEST_CASE_ORIGINS).size()) / TABLE_FQNS.size();
    assertEquals(expected, share, 0.01);
  }

  private static double onlyCount(DataInsightCustomChartResultList result) {
    assertEquals(1, result.getResults().size(), "A summary card reports a single value");
    return result.getResults().getFirst().getCount();
  }

  private static DataInsightCustomChart totalDataAssetsSummaryCard() {
    return storedChart(
        "total_data_assets_summary_card",
        new SummaryCard()
            .withMetrics(
                List.of(
                    new SummaryChartMetric()
                        .withFormula("count(k='id.keyword')")
                        .withFilter(DataInsightSystemChartRepository.DATA_ASSET_FILTER))));
  }

  private static DataInsightCustomChart totalDataAssets() {
    return storedChart(
        "total_data_assets",
        new LineChart()
            .withMetrics(List.of(new LineChartMetric().withFormula("count(k='id.keyword')")))
            .withGroupBy("entityType.keyword")
            .withExcludeGroups(DataInsightSystemChartRepository.NON_DATA_ASSET_BUCKET_KEYS));
  }

  private static DataInsightCustomChart testCasesByTable() {
    return storedChart(
        "test_cases_by_table",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula("count(k='id.keyword')")
                        .withFilter(
                            "{\"query\":{\"term\":{\"entityType.keyword\":\"testCase\"}}}")))
            .withxAxisField("originEntityFQN")
            .withSearchIndex(Entity.TEST_CASE));
  }

  /**
   * Live charts need a categorical axis, since live documents have no {@code @timestamp} to bucket
   * by. Tables and their test cases carry the same service, so grouping by it puts both populations
   * in one bucket per service and the formula can compare them: the share of that service's tables
   * with no test case.
   */
  private static DataInsightCustomChart tablesWithoutTestsShare() {
    return storedChart(
        "tables_without_tests_share",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "100 - unique(k='originEntityFQN', q='entityType.keyword: testCase')"
                                + " / unique(k='fullyQualifiedName.keyword', q='entityType.keyword: table')"
                                + " * 100")))
            .withxAxisField("service.name.keyword"));
  }

  /**
   * Chart details reach the aggregators as the map they deserialize to out of the chart table, never
   * as the typed builder, so round-trip them the same way.
   */
  private static DataInsightCustomChart storedChart(String name, Object chartDetails) {
    return new DataInsightCustomChart()
        .withName(name)
        .withChartDetails(JsonUtils.getMap(chartDetails));
  }

  private static void seedDataInsightsIndices() throws Exception {
    createIndex("di-data-assets-table", ASSET_MAPPING);
    createIndex("di-data-assets-dashboard", ASSET_MAPPING);
    createIndex("di-data-assets-glossaryterm", ASSET_MAPPING);
    createIndex("di-data-assets-dataproduct", ASSET_MAPPING);
    createIndex("di-data-assets-testcaseresult", DATA_QUALITY_MAPPING);
    createIndex("di-data-assets-testcasestamped", STAMPED_TEST_CASE_MAPPING);
    createIndex("test_case_search_index", TEST_CASE_MAPPING);
    send(
        "POST",
        "/_aliases",
        "{\"actions\":[{\"add\":{\"index\":\"test_case_search_index\",\"alias\":\"testCase\"}},"
            + "{\"add\":{\"index\":\"test_case_search_index\","
            + "\"alias\":\"di-data-assets-testcase\"}}]}");
    createIndex("all", ALL_MAPPING);

    indexTables();
    indexAssets("di-data-assets-dashboard", "dashboard", DASHBOARD_COUNT);
    indexAssets("di-data-assets-glossaryterm", "glossaryTerm", GLOSSARY_TERM_COUNT);
    indexAssets("di-data-assets-dataproduct", "dataProduct", DATA_PRODUCT_COUNT);
    indexAssets("di-data-assets-testcaseresult", null, TEST_CASE_RESULT_COUNT);
    indexAssets("di-data-assets-testcasestamped", "testCase", STAMPED_TEST_CASE_COUNT);
    indexTestCases();

    send("POST", "/_refresh", null);
  }

  private static void createIndex(String index, String mapping) throws Exception {
    send("PUT", "/" + index, mapping);
  }

  private static void indexAssets(String index, String entityType, int count) throws Exception {
    for (int i = 0; i < count; i++) {
      String entityTypeField =
          entityType == null ? "" : String.format(",\"entityType\":\"%s\"", entityType);
      String document =
          String.format(
              "{\"@timestamp\":%d,\"id\":\"%s\"%s}", TIMESTAMP, UUID.randomUUID(), entityTypeField);
      send("POST", "/" + index + "/_doc", document);
    }
  }

  private static void indexTables() throws Exception {
    for (String fullyQualifiedName : TABLE_FQNS) {
      String id = UUID.randomUUID().toString();
      send(
          "POST",
          "/di-data-assets-table/_doc",
          String.format(
              "{\"@timestamp\":%d,\"id\":\"%s\",\"entityType\":\"table\","
                  + "\"fullyQualifiedName\":\"%s\"}",
              TIMESTAMP, id, fullyQualifiedName));
      send(
          "POST",
          "/all/_doc",
          String.format(
              "{\"id\":\"%s\",\"service\":{\"name\":\"svc\"},\"entityType\":\"table\","
                  + "\"fullyQualifiedName\":\"%s\"}",
              id, fullyQualifiedName));
    }
  }

  /** Live test case documents carry no @timestamp; they sit in testCase and in the all alias. */
  private static void indexTestCases() throws Exception {
    for (String originEntityFqn : TEST_CASE_ORIGINS) {
      String document =
          String.format(
              "{\"id\":\"%s\",\"service\":{\"name\":\"svc\"},\"entityType\":\"testCase\","
                  + "\"originEntityFQN\":\"%s\"}",
              UUID.randomUUID(), originEntityFqn);
      send("POST", "/" + Entity.TEST_CASE + "/_doc", document);
      send("POST", "/all/_doc", document);
    }
  }

  private static void send(String method, String path, String body) throws Exception {
    HttpRequest.BodyPublisher payload =
        body == null
            ? HttpRequest.BodyPublishers.noBody()
            : HttpRequest.BodyPublishers.ofString(body);
    HttpRequest request =
        HttpRequest.newBuilder(URI.create(baseUrl + path))
            .header("Content-Type", "application/json")
            .method(method, payload)
            .build();
    HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 300) {
      throw new IllegalStateException(
          String.format(
              "%s %s failed with %d: %s", method, path, response.statusCode(), response.body()));
    }
  }
}
