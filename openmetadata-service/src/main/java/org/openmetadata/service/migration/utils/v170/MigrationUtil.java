package org.openmetadata.service.migration.utils.v170;

import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.LineChartMetric;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.flowable.MainWorkflow;
import org.openmetadata.service.jdbi3.AppMarketPlaceRepository;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class MigrationUtil {
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

  @SneakyThrows
  private static void setDefaultInputNamespaceMap(WorkflowNodeDefinitionInterface nodeDefinition) {
    try {
      Class<?> clazz = nodeDefinition.getClass();
      var field = clazz.getDeclaredField("inputNamespaceMap");

      field.setAccessible(true);

      Object fieldValue = field.get(nodeDefinition);

      if (fieldValue == null) {
        Class<?> fieldType = field.getType();

        Object newValue = fieldType.getDeclaredConstructor().newInstance();

        field.set(nodeDefinition, newValue);
      }
    } catch (NoSuchFieldException ignored) {

    }
  }

  @SneakyThrows
  private static void updateInputNamespaceMap(
      WorkflowNodeDefinitionInterface nodeDefinition, Map<String, String> inputNamespaceMap) {
    try {
      Class<?> clazz = nodeDefinition.getClass();
      var field = clazz.getDeclaredField("inputNamespaceMap");
      field.setAccessible(true);
      Object inputNamespaceMapObj = field.get(nodeDefinition);

      if (inputNamespaceMapObj != null) {
        Class<?> fieldType = field.getType();

        Field[] inputNamespaceMapFields = fieldType.getDeclaredFields();

        for (Field inputNamespaceMapField : inputNamespaceMapFields) {
          inputNamespaceMapField.setAccessible(true);
          String fieldName = inputNamespaceMapField.getName();

          if (inputNamespaceMap.containsKey(fieldName)) {
            inputNamespaceMapField.set(inputNamespaceMapObj, inputNamespaceMap.get(fieldName));
          }
        }
      }
    } catch (NoSuchFieldException ignored) {

    }
  }

  public static void updateGovernanceWorkflowDefinitions() {
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    List<WorkflowDefinition> workflowDefinitions =
        repository.listAll(EntityUtil.Fields.EMPTY_FIELDS, new ListFilter());

    for (WorkflowDefinition workflowDefinition : workflowDefinitions) {
      MainWorkflow.WorkflowGraph graph = new MainWorkflow.WorkflowGraph(workflowDefinition);

      for (WorkflowNodeDefinitionInterface nodeDefinition : workflowDefinition.getNodes()) {
        setDefaultInputNamespaceMap(nodeDefinition);

        Map<String, String> nodeInputNamespaceMap =
            (Map<String, String>)
                JsonUtils.readOrConvertValue(nodeDefinition.getInputNamespaceMap(), Map.class);

        if (nodeInputNamespaceMap == null) {
          continue;
        }

        if (nodeDefinition.getInput().contains(UPDATED_BY_VARIABLE)
            && nodeInputNamespaceMap.get(UPDATED_BY_VARIABLE) == null) {
          if (graph.getIncomingEdgesMap().containsKey(nodeDefinition.getName())) {
            for (String incomeNodeName :
                graph.getIncomingEdgesMap().get(nodeDefinition.getName())) {
              List<String> incomeNodeOutput = graph.getNodeMap().get(incomeNodeName).getOutput();
              if (incomeNodeOutput != null && incomeNodeOutput.contains(UPDATED_BY_VARIABLE)) {
                nodeInputNamespaceMap.put(UPDATED_BY_VARIABLE, incomeNodeName);
                updateInputNamespaceMap(nodeDefinition, nodeInputNamespaceMap);
                break;
              }
            }
          }
        }
      }
      repository.createOrUpdate(null, workflowDefinition);
    }
  }

  static DataInsightSystemChartRepository dataInsightSystemChartRepository;

  public static void createChart(String chartName, Object chartObject) {
    createChart(chartName, chartObject, DataInsightCustomChart.ChartType.LINE_CHART);
  }

  public static void createChart(
      String chartName, Object chartObject, DataInsightCustomChart.ChartType chartType) {
    DataInsightCustomChart chart =
        new DataInsightCustomChart()
            .withId(UUID.randomUUID())
            .withName(chartName)
            .withChartDetails(chartObject)
            .withUpdatedAt(System.currentTimeMillis())
            .withUpdatedBy("ingestion-bot")
            .withDeleted(false)
            .withChartType(chartType)
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

  public static void createServiceCharts() {
    dataInsightSystemChartRepository = new DataInsightSystemChartRepository();
    createChart(
        "assets_with_pii_bar",
        new LineChart()
            .withMetrics(List.of(new LineChartMetric().withFormula("count(k='id.keyword')")))
            .withxAxisField("tags.tagFQN")
            .withIncludeXAxisFiled(List.of("pii.none", "pii.sensitive", "pii.none")),
        DataInsightCustomChart.ChartType.BAR_CHART);

    createChart(
        "assets_with_tier_bar",
        new LineChart()
            .withMetrics(List.of(new LineChartMetric().withFormula("count(k='id.keyword')")))
            .withxAxisField("tags.tagFQN")
            .withIncludeXAxisFiled(
                List.of("tier.tier1", "tier.tier2", "tier.tier3", "tier.tier4", "tier.tier5")),
        DataInsightCustomChart.ChartType.BAR_CHART);

    createChart(
        "assets_with_description",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula("count(k='id.keyword',q='hasDescription: 1')"))));

    createChart(
        "assets_with_owners",
        new LineChart()
            .withMetrics(
                List.of(new LineChartMetric().withFormula("count(k='id.keyword',q='owners: *')"))));
  }
}
