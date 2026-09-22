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

  private static final int TABLE_COUNT = 3;
  private static final int DASHBOARD_COUNT = 2;
  private static final int GLOSSARY_TERM_COUNT = 1;
  private static final int DATA_PRODUCT_COUNT = 1;
  private static final int TEST_CASE_RESULT_COUNT = 4;
  private static final double EXPECTED_DATA_ASSETS = TABLE_COUNT + DASHBOARD_COUNT;

  private static final String ASSET_MAPPING =
      """
      {"mappings":{"properties":{
        "@timestamp":{"type":"date","format":"epoch_millis"},
        "id":{"type":"keyword","fields":{"keyword":{"type":"keyword"}}},
        "entityType":{"type":"keyword","fields":{"keyword":{"type":"keyword"}}}}}}""";

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
            .withExcludeGroups(DataInsightSystemChartRepository.NON_DATA_ASSET_ENTITY_TYPES));
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

    indexAssets("di-data-assets-table", "table", TABLE_COUNT);
    indexAssets("di-data-assets-dashboard", "dashboard", DASHBOARD_COUNT);
    indexAssets("di-data-assets-glossaryterm", "glossaryTerm", GLOSSARY_TERM_COUNT);
    indexAssets("di-data-assets-dataproduct", "dataProduct", DATA_PRODUCT_COUNT);
    indexAssets("di-data-assets-testcaseresult", null, TEST_CASE_RESULT_COUNT);

    send("POST", "/di-data-assets-*/_refresh", null);
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
