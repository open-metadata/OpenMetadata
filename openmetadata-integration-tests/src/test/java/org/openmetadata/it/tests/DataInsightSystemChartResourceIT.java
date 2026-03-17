package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;

/**
 * Integration tests for DataInsight System Charts APIs.
 *
 * <p>These tests verify that DataInsight APIs return valid responses and don't return null chart
 * data when charts exist. This catches regressions where interface methods are added but not
 * implemented in all SearchClient implementations.
 *
 * <p>Test Strategy:
 * <ul>
 *   <li>System charts created by migrations should exist and return non-null data
 *   <li>Filter parameter should work correctly with chart data APIs
 *   <li>For aggregate charts (depend on report indexes), we accept 404 if indexes don't exist
 * </ul>
 */
@Execution(ExecutionMode.CONCURRENT)
public class DataInsightSystemChartResourceIT {

  private static final String BASE_URL = SdkClients.getServerUrl();
  private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();

  // ===================================================================
  // SYSTEM CHARTS - Created by v190 migration
  // These charts MUST exist if migrations ran correctly
  // ===================================================================

  @Test
  void test_listChartData_assetsWithDescriptionLive_notNull() throws Exception {
    assertSystemChartReturnsNonNullData("assets_with_description_live");
  }

  @Test
  void test_listChartData_totalDataAssetsLive_notNull() throws Exception {
    assertSystemChartReturnsNonNullData("total_data_assets_live");
  }

  @Test
  void test_listChartData_assetsWithOwnerLive_notNull() throws Exception {
    assertSystemChartReturnsNonNullData("assets_with_owner_live");
  }

  @Test
  void test_listChartData_assetsWithTierLive_notNull() throws Exception {
    assertSystemChartReturnsNonNullData("assets_with_tier_live");
  }

  @Test
  void test_listChartData_assetsWithPiiLive_notNull() throws Exception {
    assertSystemChartReturnsNonNullData("assets_with_pii_live");
  }

  // ===================================================================
  // FILTER PARAMETER TESTS - Validates the fix for PR #26406
  // The bug was: buildDIChart with filter returned null
  // ===================================================================

  @Test
  void test_listChartData_withEmptyFilter_notNull() throws Exception {
    long end = System.currentTimeMillis();
    long start = end - (7 * 24 * 60 * 60 * 1000);
    String filter = URLEncoder.encode("{}", StandardCharsets.UTF_8);

    HttpResponse<String> response =
        sendGetRequest(
            "/v1/analytics/dataInsights/system/charts/listChartData"
                + "?chartNames=assets_with_description_live"
                + "&start="
                + start
                + "&end="
                + end
                + "&filter="
                + filter);

    assertEquals(
        200,
        response.statusCode(),
        "Chart should exist from v190 migration. Got: " + response.body());
    assertChartDataNotNull(response.body(), "assets_with_description_live");
  }

  @Test
  void test_listChartData_differentChart_notNull() throws Exception {
    // Test a different chart to validate the fix works across multiple charts
    long end = System.currentTimeMillis();
    long start = end - (7 * 24 * 60 * 60 * 1000);

    HttpResponse<String> response =
        sendGetRequest(
            "/v1/analytics/dataInsights/system/charts/listChartData"
                + "?chartNames=total_data_assets_live"
                + "&start="
                + start
                + "&end="
                + end
                + "&live=true");

    assertEquals(
        200,
        response.statusCode(),
        "Chart should exist from v190 migration. Got: " + response.body());
    assertChartDataNotNull(response.body(), "total_data_assets_live");
  }

  @Test
  void test_listChartData_multipleCharts_allReturnNonNull() throws Exception {
    long end = System.currentTimeMillis();
    long start = end - (7 * 24 * 60 * 60 * 1000);

    HttpResponse<String> response =
        sendGetRequest(
            "/v1/analytics/dataInsights/system/charts/listChartData"
                + "?chartNames=assets_with_description_live,total_data_assets_live,assets_with_owner_live"
                + "&start="
                + start
                + "&end="
                + end);

    assertEquals(
        200, response.statusCode(), "Charts should exist from migration. Got: " + response.body());
    assertChartDataNotNull(response.body(), "assets_with_description_live");
    assertChartDataNotNull(response.body(), "total_data_assets_live");
    assertChartDataNotNull(response.body(), "assets_with_owner_live");
  }

  @Test
  void test_listChartData_multipleChartsWithServiceFilter_notNull() throws Exception {
    long end = System.currentTimeMillis();
    long start = end - (7 * 24 * 60 * 60 * 1000);
    String filter =
        URLEncoder.encode(
            "{\"query\":{\"match\":{\"service.name.keyword\":\"postgres_sample\"}}}",
            StandardCharsets.UTF_8);

    HttpResponse<String> response =
        sendGetRequest(
            "/v1/analytics/dataInsights/system/charts/listChartData"
                + "?chartNames=assets_with_description_live,assets_with_tier_live,assets_with_owner_live"
                + "&start="
                + start
                + "&end="
                + end
                + "&filter="
                + filter);

    assertEquals(
        200,
        response.statusCode(),
        "Charts with filter should return 200 (filter may be ignored). Got: " + response.body());
    assertChartDataNotNull(response.body(), "assets_with_description_live");
    assertChartDataNotNull(response.body(), "assets_with_tier_live");
    assertChartDataNotNull(response.body(), "assets_with_owner_live");
  }

  // ===================================================================
  // SINGLE CHART DATA API - Tests /name/{fqn}/data endpoint
  // ===================================================================

  @Test
  void test_singleChartData_withFilter_notNull() throws Exception {
    long end = System.currentTimeMillis();
    long start = end - (7 * 24 * 60 * 60 * 1000);
    String filter = URLEncoder.encode("{}", StandardCharsets.UTF_8);

    HttpResponse<String> response =
        sendGetRequest(
            "/v1/analytics/dataInsights/system/charts/name/assets_with_description_live/data"
                + "?start="
                + start
                + "&end="
                + end
                + "&filter="
                + filter);

    assertEquals(
        200,
        response.statusCode(),
        "Chart should exist from v190 migration. Got: " + response.body());
    assertNotNull(response.body());
    assertFalse(
        response.body().equals("null"),
        "Single chart data should not return literal 'null'. Response: " + response.body());
  }

  @Test
  void test_singleChartData_withoutFilter_notNull() throws Exception {
    long end = System.currentTimeMillis();
    long start = end - (7 * 24 * 60 * 60 * 1000);

    HttpResponse<String> response =
        sendGetRequest(
            "/v1/analytics/dataInsights/system/charts/name/total_data_assets_live/data"
                + "?start="
                + start
                + "&end="
                + end);

    assertEquals(
        200,
        response.statusCode(),
        "Chart should exist from v190 migration. Got: " + response.body());
    assertNotNull(response.body());
    assertFalse(
        response.body().equals("null"),
        "Single chart data should not return literal 'null'. Response: " + response.body());
  }

  // ===================================================================
  // AGGREGATE CHART API - Depends on report data indexes
  // These may not exist in minimal test environments
  // ===================================================================

  @Test
  void test_aggregateChart_pageViewsByEntities_apiWorks() throws Exception {
    long end = System.currentTimeMillis();
    long start = end - (7 * 24 * 60 * 60 * 1000);

    HttpResponse<String> response =
        sendGetRequest(
            "/v1/analytics/dataInsights/charts/aggregate"
                + "?startTs="
                + start
                + "&endTs="
                + end
                + "&dataInsightChartName=PageViewsByEntities"
                + "&dataReportIndex=web_analytic_entity_view_report_data_index");

    assertAggregateApiResponds(response, "PageViewsByEntities");
  }

  @Test
  void test_aggregateChart_mostActiveUsers_apiWorks() throws Exception {
    long end = System.currentTimeMillis();
    long start = end - (7 * 24 * 60 * 60 * 1000);

    HttpResponse<String> response =
        sendGetRequest(
            "/v1/analytics/dataInsights/charts/aggregate"
                + "?startTs="
                + start
                + "&endTs="
                + end
                + "&dataInsightChartName=MostActiveUsers"
                + "&dataReportIndex=web_analytic_user_activity_report_data_index");

    assertAggregateApiResponds(response, "MostActiveUsers");
  }

  @Test
  void test_aggregateChart_dailyActiveUsers_apiWorks() throws Exception {
    long end = System.currentTimeMillis();
    long start = end - (7 * 24 * 60 * 60 * 1000);

    HttpResponse<String> response =
        sendGetRequest(
            "/v1/analytics/dataInsights/charts/aggregate"
                + "?startTs="
                + start
                + "&endTs="
                + end
                + "&dataInsightChartName=DailyActiveUsers"
                + "&dataReportIndex=web_analytic_user_activity_report_data_index");

    assertAggregateApiResponds(response, "DailyActiveUsers");
  }

  @Test
  void test_aggregateChart_unusedAssets_apiWorks() throws Exception {
    long end = System.currentTimeMillis();
    String queryFilter =
        URLEncoder.encode(
            "{\"query\":{\"range\":{\"data.lifeCycle.accessed.timestamp\":{\"lte\":" + end + "}}}}",
            StandardCharsets.UTF_8);

    HttpResponse<String> response =
        sendGetRequest(
            "/v1/analytics/dataInsights/charts/aggregate"
                + "?dataInsightChartName=UnusedAssets"
                + "&dataReportIndex=raw_cost_analysis_report_data_index"
                + "&from=0&size=10"
                + "&queryFilter="
                + queryFilter);

    assertAggregateApiResponds(response, "UnusedAssets");
  }

  // ===================================================================
  // HELPER METHODS
  // ===================================================================

  private void assertSystemChartReturnsNonNullData(String chartName) throws Exception {
    long end = System.currentTimeMillis();
    long start = end - (7 * 24 * 60 * 60 * 1000);

    HttpResponse<String> response =
        sendGetRequest(
            "/v1/analytics/dataInsights/system/charts/listChartData"
                + "?chartNames="
                + chartName
                + "&start="
                + start
                + "&end="
                + end
                + "&live=true");

    assertEquals(
        200,
        response.statusCode(),
        "Chart '"
            + chartName
            + "' should exist from v190 migration. "
            + "If you get 404, ensure migrations have run. Response: "
            + response.body());
    assertChartDataNotNull(response.body(), chartName);
  }

  private HttpResponse<String> sendGetRequest(String path) throws Exception {
    String url = BASE_URL + path;
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json")
            .GET()
            .build();

    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  /** Asserts that chart data is not null in the response. */
  private void assertChartDataNotNull(String responseBody, String chartName) {
    String nullPattern1 = "\"" + chartName + "\":null";
    String nullPattern2 = "\"" + chartName + "\": null";

    assertFalse(
        responseBody.contains(nullPattern1) || responseBody.contains(nullPattern2),
        "Chart '" + chartName + "' returned null data. Response: " + responseBody);
  }

  /**
   * Asserts that aggregate chart API responds correctly. Accepts 200 (success) or 404 (index not
   * found in test env) but verifies response is not literally null when 200.
   */
  private void assertAggregateApiResponds(HttpResponse<String> response, String chartType) {
    assertNotNull(response.body(), "Response body should not be null");

    assertTrue(
        response.statusCode() == 200 || response.statusCode() == 404,
        "Expected HTTP 200 or 404 for aggregate chart '"
            + chartType
            + "', got "
            + response.statusCode()
            + ": "
            + response.body());

    if (response.statusCode() == 200) {
      assertFalse(
          response.body().equals("null"),
          "Aggregate chart '" + chartType + "' returned null. Response: " + response.body());
    }
  }
}
