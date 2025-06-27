package org.openmetadata.service.migration.utils.v150;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonArrayBuilder;
import jakarta.json.JsonObject;
import jakarta.json.JsonObjectBuilder;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.LineChartMetric;
import org.openmetadata.schema.dataInsight.custom.SummaryCard;
import org.openmetadata.schema.dataInsight.custom.SummaryChartMetric;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.type.DataQualityDimensions;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.AppMarketPlaceRepository;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.resources.databases.DatasourceConfig;

@Slf4j
public class MigrationUtil {
  private static final String QUERY_AUTOMATOR =
      "SELECT json FROM ingestion_pipeline_entity where appType = 'Automator'";
  private static final String ADD_OWNER_ACTION = "AddOwnerAction";
  private static final String OWNER_KEY = "owner";

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
                  JsonObject json = JsonUtils.readJson(row.get("json").toString()).asJsonObject();
                  JsonObject sourceConfig = json.getJsonObject("sourceConfig");
                  JsonObject config = sourceConfig.getJsonObject("config");
                  JsonObject appConfig = config.getJsonObject("appConfig");
                  JsonArray actions = appConfig.getJsonArray("actions");

                  JsonArrayBuilder updatedActions = Json.createArrayBuilder();

                  // update the AddOwnerAction payloads to have a list of owners
                  actions.forEach(
                      action -> {
                        JsonObject actionObj = (JsonObject) action;
                        // Only process the automations with AddOwnerAction that still have the
                        // `owner` key present
                        if (ADD_OWNER_ACTION.equals(actionObj.getString("type"))
                            && actionObj.containsKey(OWNER_KEY)) {
                          JsonObject owner = actionObj.getJsonObject(OWNER_KEY);
                          JsonArrayBuilder owners = Json.createArrayBuilder();
                          owners.add(owner);
                          actionObj =
                              Json.createObjectBuilder(actionObj)
                                  .add("owners", owners)
                                  .remove(OWNER_KEY)
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
    // Delete DataInsightsApplication - It will be recreated on AppStart
    AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);

    try {
      appRepository.deleteByName("admin", "DataInsightsApplication", true, true);
    } catch (EntityNotFoundException ex) {
      LOG.debug("DataInsights Application not found.");
    } catch (UnableToExecuteStatementException ex) {
      // Note: Due to a change in the code this delete fails on a postDelete step that is not
      LOG.debug("[UnableToExecuteStatementException]: {}", ex.getMessage());
    }

    // Update DataInsightsApplication MarketplaceDefinition - It will be recreated on AppStart
    AppMarketPlaceRepository marketPlaceRepository =
        (AppMarketPlaceRepository) Entity.getEntityRepository(Entity.APP_MARKET_PLACE_DEF);

    try {
      marketPlaceRepository.deleteByName("admin", "DataInsightsApplication", true, true);
    } catch (EntityNotFoundException ex) {
      LOG.debug("DataInsights Application Marketplace Definition not found.");
    } catch (UnableToExecuteStatementException ex) {
      // Note: Due to a change in the code this delete fails on a postDelete step that is not
      LOG.debug("[UnableToExecuteStatementException]: {}", ex.getMessage());
    }
  }

  public static void migratePolicies(Handle handle, CollectionDAO collectionDAO) {
    String DB_POLICY_QUERY = "SELECT json FROM policy_entity";
    try {
      handle
          .createQuery(DB_POLICY_QUERY)
          .mapToMap()
          .forEach(
              row -> {
                try {
                  ObjectMapper objectMapper = new ObjectMapper();
                  JsonNode rootNode = objectMapper.readTree(row.get("json").toString());
                  ArrayNode rulesArray = (ArrayNode) rootNode.path("rules");

                  rulesArray.forEach(
                      ruleNode -> {
                        ArrayNode operationsArray = (ArrayNode) ruleNode.get("operations");
                        for (int i = 0; i < operationsArray.size(); i++) {
                          if ("EditOwner".equals(operationsArray.get(i).asText())) {
                            operationsArray.set(i, operationsArray.textNode("EditOwners"));
                          }
                        }
                      });
                  String updatedJsonString =
                      objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(rootNode);
                  Policy policy = JsonUtils.readValue(updatedJsonString, Policy.class);
                  policy.setUpdatedBy("ingestion-bot");
                  policy.setUpdatedAt(System.currentTimeMillis());
                  collectionDAO.policyDAO().update(policy);
                } catch (Exception e) {
                  LOG.warn("Error migrating policies", e);
                }
              });
    } catch (Exception e) {
      LOG.warn("Error running the policy migration ", e);
    }
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

    String exclude_tags_filter =
        "{\"query\":{\"bool\":{\"must\":[{\"bool\":{\"must_not\":{\"term\":{\"entityType.keyword\":\"tag\"}}}},{\"bool\":{\"must_not\":{\"term\":{\"entityType.keyword\":\"glossaryTerm\"}}}},{\"bool\":{\"must_not\":{\"term\":{\"entityType.keyword\":\"dataProduct\"}}}}]}}}";

    // total data assets
    List<String> excludeList = List.of("tag", "glossaryTerm");
    createChart(
        "total_data_assets",
        new LineChart()
            .withMetrics(List.of(new LineChartMetric().withFormula("count(k='id.keyword')")))
            .withGroupBy("entityType.keyword")
            .withExcludeGroups(excludeList));

    // Percentage of Data Asset with Description
    createChart(
        "percentage_of_data_asset_with_description",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "(count(k='id.keyword',q='hasDescription: 1')/count(k='id.keyword'))*100")))
            .withGroupBy("entityType.keyword")
            .withExcludeGroups(excludeList));

    // Percentage of Data Asset with Owner
    createChart(
        "percentage_of_data_asset_with_owner",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "(count(k='id.keyword',q='owners.name.keyword: *')/count(k='id.keyword'))*100")))
            .withGroupBy("entityType.keyword")
            .withExcludeGroups(excludeList));

    // Percentage of Service with Description
    createChart(
        "percentage_of_service_with_description",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "(count(k='id.keyword',q='hasDescription: 1')/count(k='id.keyword'))*100")))
            .withGroupBy("service.name.keyword"));

    // Percentage of Service with Owner
    createChart(
        "percentage_of_service_with_owner",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "(count(k='id.keyword',q='owners.name.keyword: *')/count(k='id.keyword'))*100")))
            .withGroupBy("service.name.keyword"));

    // total data assets by tier
    createChart(
        "total_data_assets_by_tier",
        new LineChart()
            .withMetrics(List.of(new LineChartMetric().withFormula("count(k='id.keyword')")))
            .withGroupBy("tier.keyword"));

    // total data assets summary card
    createChart(
        "total_data_assets_summary_card",
        new SummaryCard()
            .withMetrics(
                List.of(
                    new SummaryChartMetric()
                        .withFormula("count(k='id.keyword')")
                        .withFilter(exclude_tags_filter))));

    // data assets with description summary card
    createChart(
        "data_assets_with_description_summary_card",
        new SummaryCard()
            .withMetrics(
                List.of(
                    new SummaryChartMetric()
                        .withFormula(
                            "(count(k='id.keyword',q='hasDescription: 1')/count(k='id.keyword'))*100")
                        .withFilter(exclude_tags_filter))));

    // data assets with owner summary card
    createChart(
        "data_assets_with_owner_summary_card",
        new SummaryCard()
            .withMetrics(
                List.of(
                    new SummaryChartMetric()
                        .withFormula(
                            "(count(k='id.keyword',q='owners.name.keyword: *')/count(k='id.keyword'))*100")
                        .withFilter(exclude_tags_filter))));

    // total data assets with tier summary card
    createChart(
        "total_data_assets_with_tier_summary_card",
        new SummaryCard()
            .withMetrics(
                List.of(
                    new SummaryChartMetric()
                        .withFormula(
                            "(count(k='id.keyword',q='NOT tier.keyword:\"NoTier\"')/count(k='id.keyword'))*100")
                        .withFilter(exclude_tags_filter))));

    // percentage of Data Asset with Description KPI
    createChart(
        "percentage_of_data_asset_with_description_kpi",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "(count(k='id.keyword',q='hasDescription: 1')/count(k='id.keyword'))*100")
                        .withFilter(exclude_tags_filter))));

    // Number of Data Asset with Owner KPI
    createChart(
        "percentage_of_data_asset_with_owner_kpi",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "(count(k='id.keyword',q='owners.name.keyword: *')/count(k='id.keyword'))*100")
                        .withFilter(exclude_tags_filter))));
    ;

    // number of Data Asset with Description KPI
    createChart(
        "number_of_data_asset_with_description_kpi",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula("count(k='id.keyword',q='hasDescription: 1')")
                        .withFilter(exclude_tags_filter))));

    // Number of Data Asset with Owner KPI
    createChart(
        "number_of_data_asset_with_owner_kpi",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula("count(k='id.keyword',q='owners.name.keyword: *')")
                        .withFilter(exclude_tags_filter))));
  }
}
