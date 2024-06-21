package org.openmetadata.service.migration.utils.v150;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.type.DataQualityDimensions;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.util.JsonUtils;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.dataInsightNew.DIChart;
import org.openmetadata.service.jdbi3.DIChartRepository;



@Slf4j
public class MigrationUtil {
  public static void migrateTestCaseDimension(Handle handle, CollectionDAO collectionDAO) {
    String MYSQL_TEST_CASE_DIMENSION_QUERY =
        "SELECT json FROM test_definition WHERE JSON_CONTAINS(json -> '$.testPlatforms', '\"OpenMetadata\"')";
    String POSTGRES_TEST_CASE_DIMENSION_QUERY =
        "SELECT json FROM test_definition WHERE json -> 'testPlatforms' @> '\"OpenMetadata\"'";
    Map<String, DataQualityDimensions> fqnToDimension =
        Map.ofEntries(
            Map.entry("columnValueMaxToBeBetween", DataQualityDimensions.ACCURACY),
            Map.entry("columnValueMeanToBeBetween", DataQualityDimensions.ACCURACY),
            Map.entry("columnValueMedianToBeBetween", DataQualityDimensions.ACCURACY),
            Map.entry("columnValueMinToBeBetween", DataQualityDimensions.ACCURACY),
            Map.entry("columnValueLengthsToBeBetween", DataQualityDimensions.ACCURACY),
            Map.entry("columnValuesSumToBeBetween", DataQualityDimensions.ACCURACY),
            Map.entry("columnValueStdDevToBeBetween", DataQualityDimensions.ACCURACY),
            Map.entry("columnValuesToBeBetween", DataQualityDimensions.ACCURACY),
            Map.entry("columnValuesToBeInSet", DataQualityDimensions.VALIDITY),
            Map.entry("columnValuesToBeNotInSet", DataQualityDimensions.VALIDITY),
            Map.entry("columnValuesToMatchRegex", DataQualityDimensions.VALIDITY),
            Map.entry("columnValuesToNotMatchRegex", DataQualityDimensions.VALIDITY),
            Map.entry("tableColumnCountToBeBetween", DataQualityDimensions.INTEGRITY),
            Map.entry("tableColumnCountToEqual", DataQualityDimensions.INTEGRITY),
            Map.entry("tableColumnNameToExist", DataQualityDimensions.INTEGRITY),
            Map.entry("tableColumnToMatchSet", DataQualityDimensions.INTEGRITY),
            Map.entry("tableRowCountToBeBetween", DataQualityDimensions.INTEGRITY),
            Map.entry("tableRowCountToEqual", DataQualityDimensions.INTEGRITY),
            Map.entry("tableRowInsertedCountToBeBetween", DataQualityDimensions.INTEGRITY),
            Map.entry("columnValuesToBeUnique", DataQualityDimensions.UNIQUENESS),
            Map.entry("columnValuesMissingCount", DataQualityDimensions.COMPLETENESS),
            Map.entry("columnValuesToBeNotNull", DataQualityDimensions.COMPLETENESS),
            Map.entry("tableCustomSQLQuery", DataQualityDimensions.SQL),
            Map.entry("tableDiff", DataQualityDimensions.CONSISTENCY));

    try {
      String query = POSTGRES_TEST_CASE_DIMENSION_QUERY;
      if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
        query = MYSQL_TEST_CASE_DIMENSION_QUERY;
      }
      handle
          .createQuery(query)
          .mapToMap()
          .forEach(
              row -> {
                try {
                  TestDefinition testCaseDefinition =
                      JsonUtils.readValue(row.get("json").toString(), TestDefinition.class);
                  DataQualityDimensions dimension =
                      fqnToDimension.get(testCaseDefinition.getFullyQualifiedName());
                  if (dimension == null) {
                    LOG.warn(
                        "No dimension found for test case {}",
                        testCaseDefinition.getFullyQualifiedName());
                    return;
                  }
                  testCaseDefinition.setDatatQualityDimension(dimension);
                  collectionDAO.testDefinitionDAO().update(testCaseDefinition);
                } catch (Exception e) {
                  LOG.warn("Error migrating test case dimension", e);
                }
              });
    } catch (Exception e) {
      LOG.warn("Error running the test case resolution migration ", e);
    }
  }
  static DIChartRepository diChartRepository;

  private static void createChart(DIChart chart) {
    diChartRepository.prepareInternal(chart, false);
    try {
      diChartRepository.getDao().insert("fqnHash", chart, chart.getFullyQualifiedName());
    } catch (Exception ex) {
      LOG.warn(ex.toString());
      LOG.warn(String.format("Chart %s exists", chart));
    }
  }

  public static void createSystemDICharts() {
    diChartRepository = new DIChartRepository();

    // total data assets
    DIChart totalDataAssets =
        new DIChart()
            .withId(UUID.randomUUID())
            .withName("total_data_assets")
            .withFormula("count(k='id.keyword')")
            .withGroupBy("entityType.keyword")
            .withUpdatedAt(System.currentTimeMillis())
            .withUpdatedBy("ingestion-bot")
            .withDeleted(false)
            .withIsSystemChart(true);
    createChart(totalDataAssets);

    // Percentage of Data Asset with Description
    DIChart percentageOfDataAssetsWithDescription =
        new DIChart()
            .withId(UUID.randomUUID())
            .withName("percentage_of_data_asset_with_description")
            .withFormula("(count(k='id.keyword',q='hasDescription: 1')/count(k='id.keyword'))*100")
            .withGroupBy("entityType.keyword")
            .withUpdatedAt(System.currentTimeMillis())
            .withUpdatedBy("ingestion-bot")
            .withDeleted(false)
            .withIsSystemChart(true);
    createChart(percentageOfDataAssetsWithDescription);

    // Percentage of Data Asset with Owner
    DIChart percentageOfDataAssetsWithOwner =
        new DIChart()
            .withId(UUID.randomUUID())
            .withName("percentage_of_data_asset_with_owner")
            .withFormula(
                "(count(k='id.keyword',q='owner.name.keyword: *')/count(k='id.keyword'))*100")
            .withGroupBy("entityType.keyword")
            .withUpdatedAt(System.currentTimeMillis())
            .withUpdatedBy("ingestion-bot")
            .withDeleted(false)
            .withIsSystemChart(true);
    createChart(percentageOfDataAssetsWithOwner);

    // Percentage of Service with Description
    DIChart percentageOfServiceWithDescription =
        new DIChart()
            .withId(UUID.randomUUID())
            .withName("percentage_of_service_with_description")
            .withFormula("(count(k='id.keyword',q='hasDescription: 1')/count(k='id.keyword'))*100")
            .withGroupBy("service.name.keyword")
            .withUpdatedAt(System.currentTimeMillis())
            .withUpdatedBy("ingestion-bot")
            .withDeleted(false)
            .withIsSystemChart(true);
    createChart(percentageOfServiceWithDescription);

    // Percentage of Service with Owner
    DIChart percentageOfServiceWithOwner =
        new DIChart()
            .withId(UUID.randomUUID())
            .withName("percentage_of_service_with_owner")
            .withFormula(
                "(count(k='id.keyword',q='owner.name.keyword: *')/count(k='id.keyword'))*100")
            .withGroupBy("service.name.keyword")
            .withUpdatedAt(System.currentTimeMillis())
            .withUpdatedBy("ingestion-bot")
            .withDeleted(false)
            .withIsSystemChart(true);
    createChart(percentageOfServiceWithOwner);

    // total data assets by tier
    DIChart totalDataAssetsByTier =
        new DIChart()
            .withId(UUID.randomUUID())
            .withName("total_data_assets_by_tier")
            .withFormula("count(k='id.keyword')")
            .withGroupBy("tier.keyword")
            .withUpdatedAt(System.currentTimeMillis())
            .withUpdatedBy("ingestion-bot")
            .withDeleted(false)
            .withIsSystemChart(true);
    createChart(totalDataAssetsByTier);
  }
  
}
