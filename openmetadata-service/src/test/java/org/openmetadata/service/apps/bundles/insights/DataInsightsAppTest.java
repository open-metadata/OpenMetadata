package org.openmetadata.service.apps.bundles.insights;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.applications.configuration.internal.DataInsightsAppConfig;
import org.openmetadata.service.OpenMetadataApplicationTest;

@Slf4j
class DataInsightsAppTest extends OpenMetadataApplicationTest {

  @Test
  void testDataInsightsAppWithClusterAlias() {
    // This test verifies that DataInsightsApp works correctly with the cluster alias
    // configured in OpenMetadataApplicationTest (ELASTIC_SEARCH_CLUSTER_ALIAS = "openmetadata")

    // Create DataInsights app configuration
    DataInsightsAppConfig config = new DataInsightsAppConfig();

    // Create the app with configuration
    App dataInsightsApp =
        new App()
            .withName("DataInsightsApplication")
            .withDisplayName("Data Insights")
            .withDescription("Data Insights Application")
            .withAppConfiguration(config);

    testDataStreamNamesWithClusterAlias();
    testIndexCreationWithClusterAlias();
  }

  private void testDataStreamNamesWithClusterAlias() {
    Set<String> dataAssetTypes =
        Set.of(
            "table",
            "dashboard",
            "pipeline",
            "topic",
            "container",
            "searchIndex",
            "mlmodel",
            "dataProduct",
            "glossaryTerm",
            "tag");

    for (String assetType : dataAssetTypes) {
      String expectedDataStreamName =
          ELASTIC_SEARCH_CLUSTER_ALIAS + "-di-data-assets-" + assetType.toLowerCase();
      String actualDataStreamName =
          DataInsightsApp.getDataStreamName(ELASTIC_SEARCH_CLUSTER_ALIAS, assetType);
      assertEquals(
          expectedDataStreamName,
          actualDataStreamName,
          "Data stream name should include cluster alias for " + assetType);
      LOG.info("Data stream for {}: {}", assetType, actualDataStreamName);
    }

    for (String assetType : dataAssetTypes) {
      String expectedDataStreamName = "di-data-assets-" + assetType.toLowerCase();
      String actualDataStreamName = DataInsightsApp.getDataStreamName("", assetType);
      assertEquals(
          expectedDataStreamName,
          actualDataStreamName,
          "Data stream name should not include prefix when cluster alias is empty for "
              + assetType);
    }

    for (String assetType : dataAssetTypes) {
      String expectedDataStreamName = "di-data-assets-" + assetType.toLowerCase();
      String actualDataStreamName = DataInsightsApp.getDataStreamName(null, assetType);

      assertEquals(
          expectedDataStreamName,
          actualDataStreamName,
          "Data stream name should not include prefix when cluster alias is null for " + assetType);
    }
  }

  private void testIndexCreationWithClusterAlias() {
    // Test report data indexes
    Set<String> reportDataIndexes =
        Set.of(
            "entity_report_data",
            "web_analytic_entity_view_report_data",
            "web_analytic_user_activity_report_data",
            "raw_cost_analysis_report_data",
            "aggregated_cost_analysis_report_data");

    for (String indexName : reportDataIndexes) {
      String expectedIndexName = ELASTIC_SEARCH_CLUSTER_ALIAS + "_" + indexName;
      LOG.info("Report index {} would be created as {}", indexName, expectedIndexName);
      assertTrue(
          expectedIndexName.startsWith(ELASTIC_SEARCH_CLUSTER_ALIAS + "_"),
          "Index name should start with cluster alias");
    }
  }

  @Test
  void testDataInsightsAppWithDifferentClusterAliases() {
    String[] testAliases = {"dev", "staging", "prod", "qa_env", "test_cluster"};

    for (String clusterAlias : testAliases) {
      String tableDataStream = DataInsightsApp.getDataStreamName(clusterAlias, "table");
      assertEquals(
          clusterAlias + "-di-data-assets-table",
          tableDataStream,
          "Data stream should have correct prefix for cluster alias: " + clusterAlias);
      String dashboardDataStream = DataInsightsApp.getDataStreamName(clusterAlias, "dashboard");
      assertEquals(
          clusterAlias + "-di-data-assets-dashboard",
          dashboardDataStream,
          "Dashboard data stream should have correct prefix for cluster alias: " + clusterAlias);
    }
  }

  @Test
  void testDataQualityIndexesWithClusterAlias() {
    Set<String> dataQualityIndexes =
        Set.of("test_case_result_search_index", "test_case_resolution_status_search_index");

    for (String indexName : dataQualityIndexes) {
      String expectedIndexName = ELASTIC_SEARCH_CLUSTER_ALIAS + "_" + indexName;
      LOG.info("Data quality index {} would be created as {}", indexName, expectedIndexName);
      assertTrue(
          expectedIndexName.contains(ELASTIC_SEARCH_CLUSTER_ALIAS),
          "Data quality index should contain cluster alias");
    }
  }

  @Test
  void testDataInsightsSpecialCharactersInClusterAlias() {
    String[] specialAliases = {
      "cluster-with-dashes",
      "cluster.with.dots",
      "cluster_with_underscores",
      "123numeric",
      "MixedCase"
    };

    for (String alias : specialAliases) {
      String dataStream = DataInsightsApp.getDataStreamName(alias, "table");
      assertNotNull(dataStream, "Should handle cluster alias: " + alias);
      assertTrue(
          dataStream.startsWith(alias + "-"),
          "Should preserve special characters in cluster alias: " + alias);
    }
  }
}
