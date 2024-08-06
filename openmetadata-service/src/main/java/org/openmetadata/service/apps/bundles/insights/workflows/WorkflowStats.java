package org.openmetadata.service.apps.bundles.insights.workflows;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import org.openmetadata.schema.system.StepStats;

public class WorkflowStats {
  @Getter private final String name;
  @Getter private List<String> failures = new ArrayList<>();
  @Getter private StepStats workflowStats = new StepStats();
  @Getter private final Map<String, StepStats> workflowStepStats = new HashMap<>();

  public WorkflowStats(String name) {
    this.name = name;
  }

  public void setWorkflowStatsTotalRecords(int totalRecords) {
    workflowStats.setTotalRecords(totalRecords);
  }

  public void addWorkflowStatsTotalRecords(int totalRecordsToAdd) {
    workflowStats.setTotalRecords(workflowStats.getTotalRecords() + totalRecordsToAdd);
  }

  public void addFailure(String msg) {
    failures.add(msg);
  }

  public Boolean hasFailed() {
    return !failures.isEmpty();
  }

  public void updateWorkflowStats(int currentSuccess, int currentFailed) {
    getUpdatedStats(workflowStats, currentSuccess, currentFailed);
  }

  public void updateWorkflowStepStats(String stepName, StepStats newStepStats) {
    workflowStepStats.put(stepName, newStepStats);
  }
}
