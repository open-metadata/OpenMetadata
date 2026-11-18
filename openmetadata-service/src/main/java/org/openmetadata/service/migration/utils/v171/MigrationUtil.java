package org.openmetadata.service.migration.utils.v171;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import java.util.ArrayList;
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
      LOG.warn("Error updating chart {} ", chart);
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

    // Best-effort: keep backfilling the remaining definitions so a single bad row does not
    // block the rest, but collect each failure and propagate after the loop. Returning
    // normally after a failed createOrUpdate — as the previous per-definition catch did —
    // lets MigrationWorkflow record v1.7.1 as complete, leaving that definition with
    // config = null permanently (the NPE-on-edit/redeploy failure mode this PR fixes).
    // Throwing after the loop makes the next migrate/startup retry the whole backfill (see
    // DataMigrationStep: "A step that fails records nothing, so the next run retries it").
    List<Exception> failures = new ArrayList<>();
    for (WorkflowDefinition workflowDefinition : workflowDefinitions) {
      try {
        if (workflowDefinition.getConfig() == null) {
          workflowDefinition.setConfig(new WorkflowConfiguration().withStoreStageStatus(false));
        } else if (workflowDefinition.getConfig().getStoreStageStatus() == null) {
          workflowDefinition.getConfig().setStoreStageStatus(false);
        }

        workflowDefinitionRepository.createOrUpdate(null, workflowDefinition, ADMIN_USER_NAME);
      } catch (Exception ex) {
        LOG.warn(ex.toString());
        LOG.warn("Error updating workflow definition {}", workflowDefinition.getName());
        failures.add(ex);
      }
    }

    if (!failures.isEmpty()) {
      throw new IllegalStateException(
          "v1.7.1 workflow config backfill failed for "
              + failures.size()
              + " workflow definition(s); see preceding warnings. The migration will not be"
              + " recorded complete and will retry on the next migrate/startup.",
          failures.get(0));
    }
  }
}
