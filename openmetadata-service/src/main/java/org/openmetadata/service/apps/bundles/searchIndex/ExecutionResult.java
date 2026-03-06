package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import org.openmetadata.schema.system.Stats;

/**
 * Result of a reindexing execution. This record provides a summary of the execution including
 * status, counts, timing, and final statistics.
 */
public record ExecutionResult(
    Status status,
    long totalRecords,
    long successRecords,
    long failedRecords,
    long startTime,
    long endTime,
    Stats finalStats,
    Map<String, Object> metadata) {

  public ExecutionResult(
      Status status,
      long totalRecords,
      long successRecords,
      long failedRecords,
      long startTime,
      long endTime,
      Stats finalStats) {
    this(
        status,
        totalRecords,
        successRecords,
        failedRecords,
        startTime,
        endTime,
        finalStats,
        Collections.emptyMap());
  }

  /** Execution status values */
  public enum Status {
    COMPLETED,
    COMPLETED_WITH_ERRORS,
    FAILED,
    STOPPED
  }

  public long getDurationMillis() {
    return endTime - startTime;
  }

  public long getDurationSeconds() {
    return getDurationMillis() / 1000;
  }

  public double getSuccessRate() {
    return totalRecords > 0 ? (successRecords * 100.0) / totalRecords : 0;
  }

  public double getRecordsPerSecond() {
    long durationSeconds = getDurationSeconds();
    return durationSeconds > 0 ? (double) successRecords / durationSeconds : 0;
  }

  public boolean isSuccessful() {
    return status == Status.COMPLETED;
  }

  public boolean isCompleted() {
    return status == Status.COMPLETED || status == Status.COMPLETED_WITH_ERRORS;
  }

  public static Builder builder() {
    return new Builder();
  }

  public static class Builder {
    private Status status;
    private long totalRecords;
    private long successRecords;
    private long failedRecords;
    private long startTime;
    private long endTime;
    private Stats finalStats;
    private Map<String, Object> metadata = new HashMap<>();

    public Builder status(Status status) {
      this.status = status;
      return this;
    }

    public Builder totalRecords(long totalRecords) {
      this.totalRecords = totalRecords;
      return this;
    }

    public Builder successRecords(long successRecords) {
      this.successRecords = successRecords;
      return this;
    }

    public Builder failedRecords(long failedRecords) {
      this.failedRecords = failedRecords;
      return this;
    }

    public Builder startTime(long startTime) {
      this.startTime = startTime;
      return this;
    }

    public Builder endTime(long endTime) {
      this.endTime = endTime;
      return this;
    }

    public Builder finalStats(Stats finalStats) {
      this.finalStats = finalStats;
      return this;
    }

    public Builder metadata(Map<String, Object> metadata) {
      this.metadata = metadata != null ? metadata : new HashMap<>();
      return this;
    }

    public Builder addMetadata(String key, Object value) {
      this.metadata.put(key, value);
      return this;
    }

    public ExecutionResult build() {
      return new ExecutionResult(
          status,
          totalRecords,
          successRecords,
          failedRecords,
          startTime,
          endTime,
          finalStats,
          Collections.unmodifiableMap(metadata));
    }
  }

  /** Create an ExecutionResult from Stats */
  public static ExecutionResult fromStats(Stats stats, Status status, long startTime) {
    long total = 0;
    long success = 0;
    long failed = 0;

    if (stats != null && stats.getJobStats() != null) {
      total =
          stats.getJobStats().getTotalRecords() != null ? stats.getJobStats().getTotalRecords() : 0;
      success =
          stats.getJobStats().getSuccessRecords() != null
              ? stats.getJobStats().getSuccessRecords()
              : 0;
      failed =
          stats.getJobStats().getFailedRecords() != null
              ? stats.getJobStats().getFailedRecords()
              : 0;
    }

    return new ExecutionResult(
        status, total, success, failed, startTime, System.currentTimeMillis(), stats);
  }
}
