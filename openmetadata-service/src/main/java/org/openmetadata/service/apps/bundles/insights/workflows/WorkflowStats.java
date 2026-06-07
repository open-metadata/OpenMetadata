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
  @Getter private final List<String> failures = new ArrayList<>();
  @Getter private final StepStats workflowStats = new StepStats();
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

  public void reset() {
    failures.clear();
    workflowStepStats.clear();
    workflowStats.setTotalRecords(0);
    workflowStats.setSuccessRecords(0);
    workflowStats.setFailedRecords(0);
    workflowStats.setWarningRecords(0);
    workflowStats.setVectorSuccessRecords(0);
    workflowStats.setVectorFailedRecords(0);
    workflowStats.setTotalTimeMs(0L);
    workflowStats.setReaderTimeMs(0L);
    workflowStats.setProcessTimeMs(0L);
    workflowStats.setSinkTimeMs(0L);
    workflowStats.setVectorTimeMs(0L);
  }

  public void merge(WorkflowStats other) {
    failures.addAll(other.getFailures());
    other
        .getWorkflowStepStats()
        .forEach(
            (stepName, stepStats) ->
                workflowStepStats.merge(stepName, copyStepStats(stepStats), this::mergeStepStats));
    mergeStepStats(workflowStats, other.getWorkflowStats());
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

  private int getStepStatValue(Integer value) {
    return value == null ? 0 : value;
  }

  private StepStats copyStepStats(StepStats stats) {
    return new StepStats()
        .withTotalRecords(stats.getTotalRecords())
        .withSuccessRecords(stats.getSuccessRecords())
        .withFailedRecords(stats.getFailedRecords())
        .withWarningRecords(stats.getWarningRecords())
        .withVectorSuccessRecords(stats.getVectorSuccessRecords())
        .withVectorFailedRecords(stats.getVectorFailedRecords())
        .withTotalTimeMs(stats.getTotalTimeMs())
        .withReaderTimeMs(stats.getReaderTimeMs())
        .withProcessTimeMs(stats.getProcessTimeMs())
        .withSinkTimeMs(stats.getSinkTimeMs())
        .withVectorTimeMs(stats.getVectorTimeMs());
  }

  private StepStats mergeStepStats(StepStats currentStats, StepStats newStats) {
    mergeRecordCounts(currentStats, newStats);
    mergeVectorCounts(currentStats, newStats);
    mergeTimings(currentStats, newStats);
    return currentStats;
  }

  private void mergeRecordCounts(StepStats currentStats, StepStats newStats) {
    currentStats.setTotalRecords(sum(currentStats.getTotalRecords(), newStats.getTotalRecords()));
    currentStats.setSuccessRecords(
        sum(currentStats.getSuccessRecords(), newStats.getSuccessRecords()));
    currentStats.setFailedRecords(
        sum(currentStats.getFailedRecords(), newStats.getFailedRecords()));
    currentStats.setWarningRecords(
        sum(currentStats.getWarningRecords(), newStats.getWarningRecords()));
  }

  private void mergeVectorCounts(StepStats currentStats, StepStats newStats) {
    currentStats.setVectorSuccessRecords(
        sum(currentStats.getVectorSuccessRecords(), newStats.getVectorSuccessRecords()));
    currentStats.setVectorFailedRecords(
        sum(currentStats.getVectorFailedRecords(), newStats.getVectorFailedRecords()));
  }

  private void mergeTimings(StepStats currentStats, StepStats newStats) {
    currentStats.setTotalTimeMs(sum(currentStats.getTotalTimeMs(), newStats.getTotalTimeMs()));
    currentStats.setReaderTimeMs(sum(currentStats.getReaderTimeMs(), newStats.getReaderTimeMs()));
    currentStats.setProcessTimeMs(
        sum(currentStats.getProcessTimeMs(), newStats.getProcessTimeMs()));
    currentStats.setSinkTimeMs(sum(currentStats.getSinkTimeMs(), newStats.getSinkTimeMs()));
    currentStats.setVectorTimeMs(sum(currentStats.getVectorTimeMs(), newStats.getVectorTimeMs()));
  }

  private int sum(Integer currentValue, Integer newValue) {
    return getStepStatValue(currentValue) + getStepStatValue(newValue);
  }

  private long sum(Long currentValue, Long newValue) {
    return getStepStatValue(currentValue) + getStepStatValue(newValue);
  }

  private long getStepStatValue(Long value) {
    return value == null ? 0 : value;
  }
}
