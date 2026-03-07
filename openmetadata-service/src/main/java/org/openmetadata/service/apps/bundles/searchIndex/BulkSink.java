package org.openmetadata.service.apps.bundles.searchIndex;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.system.StepStats;

public interface BulkSink {
  void write(List<?> entities, Map<String, Object> contextData) throws Exception;

  void updateStats(int currentSuccess, int currentFailed);

  StepStats getStats();

  void close() throws IOException;

  /**
   * Flush any pending bulk requests and wait for them to complete. Unlike close(), this does not
   * shut down the sink - it can still be used for more writes after flush.
   *
   * @param timeoutSeconds Maximum time to wait for pending requests to complete
   * @return true if all requests completed within timeout, false otherwise
   */
  default boolean flushAndAwait(int timeoutSeconds) {
    // Default implementation does nothing - subclasses should override
    return true;
  }

  /** Callback interface for receiving failure notifications when documents fail to index. */
  @FunctionalInterface
  interface FailureCallback {
    /**
     * Called when a document fails to index.
     *
     * @param entityType The type of entity that failed
     * @param entityId The ID of the entity (from document ID), may be null for build failures
     * @param entityFqn The FQN of the entity, may be null if not available
     * @param errorMessage The error message describing the failure
     * @param stage The pipeline stage where the failure occurred (PROCESS or SINK)
     */
    void onFailure(
        String entityType,
        String entityId,
        String entityFqn,
        String errorMessage,
        IndexingFailureRecorder.FailureStage stage);
  }

  /**
   * Set a callback to be notified when documents fail to index. The callback will be called for
   * each failed document in a bulk response.
   *
   * @param callback The failure callback, or null to clear
   */
  default void setFailureCallback(FailureCallback callback) {
    // Default implementation does nothing - subclasses should override
  }

  /**
   * Returns the vector indexing statistics. This is used for tracking vector embedding
   * indexing separately from the main search index stats.
   *
   * @return StepStats with vector indexing success/failed counts, or null if not supported
   */
  default StepStats getVectorStats() {
    return null;
  }

  /**
   * Returns the process stage statistics. This tracks document building/transformation
   * separately from the actual sink (bulk indexing) stats.
   *
   * @return StepStats with process success/failed counts, or null if not supported
   */
  default StepStats getProcessStats() {
    return null;
  }

  /**
   * Wait for all pending vector embedding tasks to complete. This is important for ensuring
   * no vector tasks are lost when the job completes. The sink's close() method should also
   * call this, but this method allows explicit waiting before close if needed.
   *
   * @param timeoutSeconds Maximum time to wait for vector tasks to complete
   * @return true if all tasks completed within timeout, false otherwise
   */
  default boolean awaitVectorCompletion(int timeoutSeconds) {
    // Default: no async vector tasks, nothing to wait for
    return true;
  }

  /**
   * Get the count of pending vector embedding tasks.
   *
   * @return Number of vector tasks still in progress
   */
  default int getPendingVectorTaskCount() {
    return 0;
  }

  /**
   * Returns the number of currently active (in-flight) bulk requests.
   *
   * @return Number of active bulk requests
   */
  default int getActiveBulkRequestCount() {
    return 0;
  }

  /**
   * Wait for vector embedding tasks to complete and return detailed result including timing.
   *
   * @param timeoutSeconds Maximum time to wait
   * @return VectorCompletionResult with completion status, pending count, and wait time
   */
  default VectorCompletionResult awaitVectorCompletionWithDetails(int timeoutSeconds) {
    long start = System.currentTimeMillis();
    boolean ok = awaitVectorCompletion(timeoutSeconds);
    long waited = System.currentTimeMillis() - start;
    return ok
        ? VectorCompletionResult.success(waited)
        : VectorCompletionResult.timeout(getPendingVectorTaskCount(), waited);
  }

  /**
   * Returns the column indexing statistics. Columns are indexed as a side effect of table
   * processing, so their stats are tracked separately.
   *
   * @return StepStats with column indexing success/failed counts, or null if not supported
   */
  default StepStats getColumnStats() {
    return null;
  }

  /** Key for passing StageStatsTracker through context data to the sink. */
  String STATS_TRACKER_CONTEXT_KEY = "stageStatsTracker";
}
