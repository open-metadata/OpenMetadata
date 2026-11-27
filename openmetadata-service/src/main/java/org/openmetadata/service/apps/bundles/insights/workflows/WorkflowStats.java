package org.openmetadata.service.apps.bundles.insights.workflows;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import lombok.Getter;
import org.openmetadata.schema.system.StepStats;

public class WorkflowStats {
  /**
   * Marks a diagnostic step, kept in entityStats but left out of every job and workflow total.
   * ADR:2026-11-19-enricher-diagnostic-steps-are-excluded-from-data-insights-job-totals
   */
  public static final String ENRICHER_STEP_PREFIX = "[Enricher] ";

  @Getter private final String name;
  @Getter private final List<String> failures = new ArrayList<>();
  @Getter private final StepStats workflowStats = new StepStats();
  @Getter private final Map<String, StepStats> workflowStepStats = new HashMap<>();

  public WorkflowStats(final String name) {
    this.name = name;
  }

  public static boolean isDiagnosticStep(final String stepName) {
    return stepName != null && stepName.startsWith(ENRICHER_STEP_PREFIX);
  }

  public static int sumTotalRecords(final Map<String, StepStats> stepStatsMap) {
    return sumNonDiagnostic(stepStatsMap, StepStats::getTotalRecords);
  }

  public static int sumSuccessRecords(final Map<String, StepStats> stepStatsMap) {
    return sumNonDiagnostic(stepStatsMap, StepStats::getSuccessRecords);
  }

  public static int sumFailedRecords(final Map<String, StepStats> stepStatsMap) {
    return sumNonDiagnostic(stepStatsMap, StepStats::getFailedRecords);
  }

  private static int sumNonDiagnostic(
      final Map<String, StepStats> stepStatsMap, final Function<StepStats, Integer> extractor) {
    if (nullOrEmpty(stepStatsMap)) {
      return 0;
    }
    return stepStatsMap.entrySet().stream()
        .filter(entry -> !isDiagnosticStep(entry.getKey()) && entry.getValue() != null)
        .map(entry -> extractor.apply(entry.getValue()))
        .mapToInt(count -> count == null ? 0 : count)
        .sum();
  }

  public void setWorkflowStatsTotalRecords(final int totalRecords) {
    workflowStats.setTotalRecords(totalRecords);
  }

  public void addWorkflowStatsTotalRecords(final int totalRecordsToAdd) {
    workflowStats.setTotalRecords(workflowStats.getTotalRecords() + totalRecordsToAdd);
  }

  public void addFailure(final String msg) {
    failures.add(msg);
  }

  public Boolean hasFailed() {
    return !failures.isEmpty();
  }

  public void updateWorkflowStats(final int currentSuccess, final int currentFailed) {
    getUpdatedStats(workflowStats, currentSuccess, currentFailed);
  }

  public void updateWorkflowStepStats(final String stepName, final StepStats newStepStats) {
    workflowStepStats.put(stepName, newStepStats);
  }

  /**
   * Adds an independent iteration's counters. Cumulative progress snapshots must use {@link
   * #updateWorkflowStepStats(String, StepStats)} to avoid counting earlier work again.
   */
  public void accumulateWorkflowStepStats(
      final String stepName, final StepStats completedStepStats) {
    final StepStats accumulatedStats =
        workflowStepStats.computeIfAbsent(stepName, ignored -> new StepStats());
    accumulatedStats.setTotalRecords(
        accumulatedStats.getTotalRecords() + completedStepStats.getTotalRecords());
    accumulatedStats.setSuccessRecords(
        accumulatedStats.getSuccessRecords() + completedStepStats.getSuccessRecords());
    accumulatedStats.setFailedRecords(
        accumulatedStats.getFailedRecords() + completedStepStats.getFailedRecords());
  }
}
