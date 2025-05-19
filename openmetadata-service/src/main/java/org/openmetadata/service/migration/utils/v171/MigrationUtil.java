package org.openmetadata.service.migration.utils.v171;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.LineChartMetric;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class MigrationUtil {

  private MigrationUtil() {}

  static DataInsightSystemChartRepository dataInsightSystemChartRepository;
  static WorkflowDefinitionRepository workflowDefinitionRepository;

  public static void updateChart(String chartName, Object chartDetails) {
    DataInsightCustomChart chart =
        dataInsightSystemChartRepository.getByName(null, chartName, EntityUtil.Fields.EMPTY_FIELDS);
    chart.setChartDetails(chartDetails);
    dataInsightSystemChartRepository.prepareInternal(chart, false);
    try {
      dataInsightSystemChartRepository.getDao().update(chart);
    } catch (Exception ex) {
      LOG.warn(ex.toString());
      LOG.warn(String.format("Error updating chart %s ", chart));
    }
  }

  public static void updateServiceCharts() {
    dataInsightSystemChartRepository = new DataInsightSystemChartRepository();
    updateChart(
        "tag_source_breakdown",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "sum(k='tagSources.Ingested')+"
                                + "sum(k='tagSources.Manual')+"
                                + "sum(k='tagSources.Propagated')")
                        .withName("manual"),
                    new LineChartMetric()
                        .withFormula("sum(k='tagSources.Generated')")
                        .withName("ai"))));

    updateChart(
        "tier_source_breakdown",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "sum(k='tierSources.Ingested')+"
                                + "sum(k='tierSources.Manual')+"
                                + "sum(k='tierSources.Propagated')")
                        .withName("manual"),
                    new LineChartMetric()
                        .withFormula("sum(k='tierSources.Generated')")
                        .withName("ai"))));
  }

  public static void updateWorkflowDefinitions() {
    workflowDefinitionRepository = new WorkflowDefinitionRepository();
    List<WorkflowDefinition> workflowDefinitions =
        workflowDefinitionRepository.listAll(EntityUtil.Fields.EMPTY_FIELDS, new ListFilter());

    for (WorkflowDefinition workflow : workflowDefinitions) {
      try {
        if (workflow.getConfig() == null) {
          workflow.setConfig(new WorkflowConfiguration().withStoreStageStatus(false));
        } else if (workflow.getConfig().getStoreStageStatus() == null) {
          workflow.getConfig().setStoreStageStatus(false);
        }

        workflowDefinitionRepository.prepareInternal(workflow, false);
        workflowDefinitionRepository.getDao().update(workflow);
      } catch (Exception ex) {
        LOG.warn(ex.toString());
        LOG.warn(String.format("Error updating workflow definition %s", workflow.getName()));
      }
    }
  }
}
