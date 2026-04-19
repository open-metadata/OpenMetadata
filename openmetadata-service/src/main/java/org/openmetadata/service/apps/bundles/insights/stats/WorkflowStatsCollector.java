package org.openmetadata.service.apps.bundles.insights.stats;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;

public final class WorkflowStatsCollector {

  private final String workflowName;
  private final List<IndexingError> failures = new ArrayList<>();
  private final Map<String, StepStats> stepStats = new HashMap<>();

  public WorkflowStatsCollector(String workflowName) {
    this.workflowName = workflowName;
  }

  public void record(StepResult result) {
    StepStats incoming =
        new StepStats()
            .withSuccessRecords(result.successCount())
            .withFailedRecords(result.failedCount())
            .withTotalRecords(result.successCount() + result.failedCount());
    stepStats.merge(
        result.stepName(),
        incoming,
        (existing, next) ->
            new StepStats()
                .withSuccessRecords(existing.getSuccessRecords() + next.getSuccessRecords())
                .withFailedRecords(existing.getFailedRecords() + next.getFailedRecords())
                .withTotalRecords(existing.getTotalRecords() + next.getTotalRecords()));
  }

  public void recordIndexingError(IndexingError error) {
    failures.add(error);
  }

  public void recordWorkflowError(Exception ex) {
    failures.add(
        new IndexingError()
            .withErrorSource(IndexingError.ErrorSource.JOB)
            .withMessage(ex.getMessage())
            .withStackTrace(ExceptionUtils.getStackTrace(ex)));
  }

  public WorkflowResult buildResult() {
    return new WorkflowResult(
        workflowName, Map.copyOf(stepStats), List.copyOf(failures), !failures.isEmpty());
  }
}
