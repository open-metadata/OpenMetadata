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
    currentStats.setTotalRecords(
        getStepStatValue(currentStats.getTotalRecords())
            + getStepStatValue(newStats.getTotalRecords()));
    currentStats.setSuccessRecords(
        getStepStatValue(currentStats.getSuccessRecords())
            + getStepStatValue(newStats.getSuccessRecords()));
    currentStats.setFailedRecords(
        getStepStatValue(currentStats.getFailedRecords())
            + getStepStatValue(newStats.getFailedRecords()));
    currentStats.setWarningRecords(
        getStepStatValue(currentStats.getWarningRecords())
            + getStepStatValue(newStats.getWarningRecords()));
    currentStats.setVectorSuccessRecords(
        getStepStatValue(currentStats.getVectorSuccessRecords())
            + getStepStatValue(newStats.getVectorSuccessRecords()));
    currentStats.setVectorFailedRecords(
        getStepStatValue(currentStats.getVectorFailedRecords())
            + getStepStatValue(newStats.getVectorFailedRecords()));
    currentStats.setTotalTimeMs(
        getStepStatValue(currentStats.getTotalTimeMs())
            + getStepStatValue(newStats.getTotalTimeMs()));
    currentStats.setReaderTimeMs(
        getStepStatValue(currentStats.getReaderTimeMs())
            + getStepStatValue(newStats.getReaderTimeMs()));
    currentStats.setProcessTimeMs(
        getStepStatValue(currentStats.getProcessTimeMs())
            + getStepStatValue(newStats.getProcessTimeMs()));
    currentStats.setSinkTimeMs(
        getStepStatValue(currentStats.getSinkTimeMs())
            + getStepStatValue(newStats.getSinkTimeMs()));
    currentStats.setVectorTimeMs(
        getStepStatValue(currentStats.getVectorTimeMs())
            + getStepStatValue(newStats.getVectorTimeMs()));
    return currentStats;
  }

  private long getStepStatValue(Long value) {
    return value == null ? 0 : value;
  }
}
