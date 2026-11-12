/*
 *  Copyright 2026 Collate
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
package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResult;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.LineChartMetric;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * Test case definitions reach the ordinary preview through the Data Insights alias and live charts
 * through the {@code testCase} index, so a chart can
 * count them per table and the per-table figures agree with the Data Quality list for the same
 * tables. A table with no test case has no bucket at all, which is exactly what makes "share of
 * tables without tests" expressible.
 *
 * <p>Assertions are scoped to the tables seeded here: the index is shared with every other test.
 */
@ExtendWith(TestNamespaceExtension.class)
class DataInsightTestCaseCoverageIT {

  private static final Duration INDEXING_TIMEOUT = Duration.ofSeconds(120);
  private static final long WINDOW_MS = Duration.ofDays(1).toMillis();

  private final OpenMetadataClient client = SdkClients.adminClient();

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void perTableTestCaseCountReconcilesWithTheDataQualityList(boolean live, TestNamespace ns)
      throws IOException {
    Table covered = ShortStackFactory.table(ns);
    Table uncovered = ShortStackFactory.table(ns);
    createTableTestCase(ns, covered, "row_count_a");
    createTableTestCase(ns, covered, "row_count_b");

    double expected = dataQualityTotal(covered);
    Map<String, Double> countsByTable =
        awaitCounts(
            testCasesByTable(List.of(covered, uncovered)), lowerCase(covered), expected, live);

    assertEquals(2, expected);
    assertEquals(expected, countsByTable.get(lowerCase(covered)));
    var outsideWindow =
        Entity.getSearchRepository()
            .getSearchClient()
            .buildDIChart(testCasesByTable(List.of(covered)), 0L, 1L);
    assertTrue(outsideWindow.getResults().stream().allMatch(result -> result.getCount() == 0.0));
    assertFalse(
        countsByTable.containsKey(lowerCase(uncovered)),
        "A table without test cases must have no bucket, so it is counted as uncovered");
  }

  @Test
  void ordinaryPreviewCanAggregateTestCasesByDate(TestNamespace ns) {
    Table table = ShortStackFactory.table(ns);
    createTableTestCase(ns, table, "dated_row_count");
    DataInsightCustomChart chart = testCasesByTable(List.of(table));
    LineChart details = JsonUtils.convertValue(chart.getChartDetails(), LineChart.class);
    details.withxAxisField("@timestamp").withSearchIndex(null);
    chart.withChartDetails(JsonUtils.getMap(details));

    await()
        .atMost(INDEXING_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () -> {
              long end = System.currentTimeMillis();
              var result =
                  Entity.getSearchRepository()
                      .getSearchClient()
                      .buildDIChart(chart, end - WINDOW_MS, end);
              assertEquals(
                  1.0,
                  result.getResults().stream()
                      .mapToDouble(DataInsightCustomChartResult::getCount)
                      .sum());
            });
  }

  @Test
  void fieldCatalogExposesTestCaseGroupingFields() {
    List<Map<String, String>> fields =
        Entity.getSearchRepository().getSearchClient().fetchDIChartFields();
    for (String name :
        List.of(
            "originEntityFQN",
            "testSuite.fullyQualifiedName",
            "testDefinition.fullyQualifiedName")) {
      assertTrue(
          fields.stream()
              .anyMatch(
                  field ->
                      Entity.TEST_CASE.equals(field.get("entityType"))
                          && name.equals(field.get("name"))),
          "Missing test case field: " + name);
    }
  }

  private void createTableTestCase(TestNamespace ns, Table table, String name) {
    TestCaseBuilder.create(client)
        .name(ns.prefix(name))
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .create();
  }

  private Map<String, Double> awaitCounts(
      DataInsightCustomChart chart, String tableKey, double expected, boolean live) {
    return await()
        .atMost(INDEXING_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> countsByTable(chart, live),
            counts -> Double.valueOf(expected).equals(counts.get(tableKey)));
  }

  private Map<String, Double> countsByTable(DataInsightCustomChart chart, boolean live)
      throws IOException {
    long end = System.currentTimeMillis();
    var searchClient = Entity.getSearchRepository().getSearchClient();
    var result =
        live
            ? searchClient.buildDIChart(chart, end - WINDOW_MS, end, true)
            : searchClient.buildDIChart(chart, end - WINDOW_MS, end);
    return result.getResults().stream()
        .collect(
            Collectors.toMap(
                DataInsightCustomChartResult::getTerm, DataInsightCustomChartResult::getCount));
  }

  private static DataInsightCustomChart testCasesByTable(List<Table> tables) {
    String fqns =
        tables.stream()
            .map(table -> "\"" + lowerCase(table) + "\"")
            .collect(Collectors.joining(","));
    LineChart details =
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula("count(k='id.keyword')")
                        .withFilter(
                            "{\"query\":{\"terms\":{\"originEntityFQN\":[" + fqns + "]}}}")))
            .withxAxisField("originEntityFQN")
            .withSearchIndex(Entity.TEST_CASE);
    return new DataInsightCustomChart()
        .withName("test_cases_by_table_it")
        .withChartDetails(JsonUtils.getMap(details));
  }

  private int dataQualityTotal(Table table) {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityLink", "<#E::table::" + table.getFullyQualifiedName() + ">")
            .queryParam("includeAllTests", "true")
            .queryParam("limit", "100")
            .build();
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/dataQuality/testCases", null, options);
    return JsonUtils.readValue(response, new TypeReference<ResultList<TestCase>>() {})
        .getPaging()
        .getTotal();
  }

  private static String lowerCase(Table table) {
    return table.getFullyQualifiedName().toLowerCase(Locale.ROOT);
  }
}
