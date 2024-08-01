package org.openmetadata.service.migration.utils.v150;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import javax.json.Json;
import javax.json.JsonArray;
import javax.json.JsonArrayBuilder;
import javax.json.JsonObject;
import javax.json.JsonObjectBuilder;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.SummaryCard;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.ScheduleType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.type.DataQualityDimensions;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class MigrationUtil {
  private static final String QUERY_AUTOMATOR =
      "SELECT json FROM ingestion_pipeline_entity where appType = 'Automator'";
  private static final String ADD_OWNER_ACTION = "AddOwnerAction";

  /**
   * We need to update the `AddOwnerAction` action in the automator to have a list of owners
   */
  public static void migrateAutomatorOwner(Handle handle, CollectionDAO collectionDAO) {
    try {

      handle
          .createQuery(QUERY_AUTOMATOR)
          .mapToMap()
          .forEach(
              row -> {
                try {
                  // Prepare the current json objects
                  JsonObject json = JsonUtils.readJson((String) row.get("json")).asJsonObject();
                  JsonObject sourceConfig = json.getJsonObject("sourceConfig");
                  JsonObject config = sourceConfig.getJsonObject("config");
                  JsonObject appConfig = config.getJsonObject("appConfig");
                  JsonArray actions = appConfig.getJsonArray("actions");

                  JsonArrayBuilder updatedActions = Json.createArrayBuilder();

                  // update the AddOwnerAction payloads to have a list of owners
                  actions.forEach(
                      action -> {
                        JsonObject actionObj = (JsonObject) action;
                        if (ADD_OWNER_ACTION.equals(actionObj.getString("type"))) {
                          JsonObject owner = actionObj.getJsonObject("owner");
                          JsonArrayBuilder owners = Json.createArrayBuilder();
                          owners.add(owner);
                          actionObj =
                              Json.createObjectBuilder(actionObj)
                                  .add("owners", owners)
                                  .remove("owner")
                                  .build();
                        }
                        updatedActions.add(actionObj);
                      });

                  // Recreate the json object
                  JsonObjectBuilder updatedAppConfig =
                      Json.createObjectBuilder(appConfig).add("actions", updatedActions);

                  JsonObjectBuilder updatedConfig =
                      Json.createObjectBuilder(config).add("appConfig", updatedAppConfig);

                  JsonObjectBuilder updatedSourceConfig =
                      Json.createObjectBuilder(sourceConfig).add("config", updatedConfig);

                  JsonObject finalJsonObject =
                      Json.createObjectBuilder(json)
                          .add("sourceConfig", updatedSourceConfig)
                          .build();

                  // Update the Ingestion Pipeline
                  IngestionPipeline ingestionPipeline =
                      JsonUtils.readValue(finalJsonObject.toString(), IngestionPipeline.class);
                  collectionDAO.ingestionPipelineDAO().update(ingestionPipeline);

                } catch (Exception ex) {
                  LOG.warn(String.format("Error updating automator [%s] due to [%s]", row, ex));
                }
              });
    } catch (Exception ex) {
      LOG.warn("Error running the automator migration ", ex);
    }
  }
 
  public static void deleteLegacyDataInsightPipelines(
      PipelineServiceClientInterface pipelineServiceClient) {
    // Delete Data Insights Pipeline
    String dataInsightsPipelineNameFqn = "OpenMetadata.OpenMetadata_dataInsight";

    Optional<IngestionPipeline> oDataInsightsPipeline = Optional.empty();
    try {
      oDataInsightsPipeline =
          Optional.ofNullable(
              Entity.getEntityByName(
                  Entity.INGESTION_PIPELINE,
                  dataInsightsPipelineNameFqn,
                  "*",
                  Include.NON_DELETED));
    } catch (EntityNotFoundException ex) {
      LOG.debug("DataInsights Pipeline not found.");
    }

    if (oDataInsightsPipeline.isPresent()) {
      IngestionPipeline dataInsightsPipeline = oDataInsightsPipeline.get();

      IngestionPipelineRepository entityRepository =
          (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
      entityRepository.setPipelineServiceClient(pipelineServiceClient);
      entityRepository.delete("admin", dataInsightsPipeline.getId(), true, true);
    }
  }
  
  public static void updateDataInsightsApplication() {
    AppRepository appRepository = new AppRepository();

    App dataInsightsApp = appRepository.getByName(null, "DataInsightsApplication", new EntityUtil.Fields(Set.of("*")));
    App updatedDataInsightsApp = appRepository.getByName(null, "DataInsightsApplication", new EntityUtil.Fields(Set.of("*")));

    updatedDataInsightsApp.setAppType(AppType.Internal);
    updatedDataInsightsApp.setScheduleType(ScheduleType.ScheduledOrManual);
    Map<String, Object> appConfig = new HashMap<>();
    appConfig.put("type", "DataInsights");
    appConfig.put("batchSize", 100);
    updatedDataInsightsApp.setAppConfiguration(appConfig);
    updatedDataInsightsApp.setAllowConfiguration(true);

    appRepository.update(null, dataInsightsApp, updatedDataInsightsApp);
  }

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
                  testCaseDefinition.setDataQualityDimension(dimension);
                  collectionDAO.testDefinitionDAO().update(testCaseDefinition);
                } catch (Exception e) {
                  LOG.warn("Error migrating test case dimension", e);
                }
              });
    } catch (Exception e) {
      LOG.warn("Error running the test case resolution migration ", e);
    }
  }

  static DataInsightSystemChartRepository dataInsightSystemChartRepository;

  private static void createChart(String chartName, Object chartObject) {
    DataInsightCustomChart chart =
        new DataInsightCustomChart()
            .withId(UUID.randomUUID())
            .withName(chartName)
            .withChartDetails(chartObject)
            .withUpdatedAt(System.currentTimeMillis())
            .withUpdatedBy("ingestion-bot")
            .withDeleted(false)
            .withIsSystemChart(true);
    dataInsightSystemChartRepository.prepareInternal(chart, false);
    try {
      dataInsightSystemChartRepository
          .getDao()
          .insert("fqnHash", chart, chart.getFullyQualifiedName());
    } catch (Exception ex) {
      LOG.warn(ex.toString());
      LOG.warn(String.format("Chart %s exists", chart));
    }
  }

  public static void createSystemDICharts() {
    dataInsightSystemChartRepository = new DataInsightSystemChartRepository();

    // total data assets
    createChart(
        "total_data_assets",
        new LineChart().withFormula("count(k='id.keyword')").withGroupBy("entityType.keyword"));

    // Percentage of Data Asset with Description
    createChart(
        "percentage_of_data_asset_with_description",
        new LineChart()
            .withFormula("(count(k='id.keyword',q='hasDescription: 1')/count(k='id.keyword'))*100")
            .withGroupBy("entityType.keyword"));

    // Percentage of Data Asset with Owner
    createChart(
        "percentage_of_data_asset_with_owner",
        new LineChart()
            .withFormula(
                "(count(k='id.keyword',q='owners.name.keyword: *')/count(k='id.keyword'))*100")
            .withGroupBy("entityType.keyword"));

    // Percentage of Service with Description
    createChart(
        "percentage_of_service_with_description",
        new LineChart()
            .withFormula("(count(k='id.keyword',q='hasDescription: 1')/count(k='id.keyword'))*100")
            .withGroupBy("service.name.keyword"));

    // Percentage of Service with Owner
    createChart(
        "percentage_of_service_with_owner",
        new LineChart()
            .withFormula(
                "(count(k='id.keyword',q='owners.name.keyword: *')/count(k='id.keyword'))*100")
            .withGroupBy("service.name.keyword"));

    // total data assets by tier
    createChart(
        "total_data_assets_by_tier",
        new LineChart().withFormula("count(k='id.keyword')").withGroupBy("tier.keyword"));

    // total data assets summary card
    createChart(
        "total_data_assets_summary_card", new SummaryCard().withFormula("count(k='id.keyword')"));

    // data assets with description summary card
    createChart(
        "data_assets_with_description_summary_card",
        new SummaryCard()
            .withFormula(
                "(count(k='id.keyword',q='hasDescription: 1')/count(k='id.keyword'))*100"));

    // data assets with owner summary card
    createChart(
        "data_assets_with_owner_summary_card",
        new SummaryCard()
            .withFormula(
                "(count(k='id.keyword',q='owners.name.keyword: *')/count(k='id.keyword'))*100"));

    // total data assets with tier summary card
    createChart(
        "total_data_assets_with_tier_summary_card",
        new SummaryCard()
            .withFormula("(count(k='id.keyword',q='tier.keyword: *')/count(k='id.keyword'))*100"));

    // percentage of Data Asset with Description KPI
    createChart(
        "percentage_of_data_asset_with_description_kpi",
        new LineChart()
            .withFormula(
                "(count(k='id.keyword',q='hasDescription: 1')/count(k='id.keyword'))*100"));

    // Number of Data Asset with Owner KPI
    createChart(
        "percentage_of_data_asset_with_owner_kpi",
        new LineChart()
            .withFormula(
                "(count(k='id.keyword',q='owners.name.keyword: *')/count(k='id.keyword'))*100"));

    // number of Data Asset with Description KPI
    createChart(
        "number_of_data_asset_with_description_kpi",
        new LineChart().withFormula("count(k='id.keyword',q='hasDescription: 1')"));

    // Number of Data Asset with Owner KPI
    createChart(
        "number_of_data_asset_with_owner_kpi",
        new LineChart().withFormula("count(k='id.keyword',q='owners.name.keyword: *')"));
  }
}
