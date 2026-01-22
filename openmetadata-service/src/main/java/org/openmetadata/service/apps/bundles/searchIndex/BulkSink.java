package org.openmetadata.service.apps.bundles.searchIndex;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.system.StepStats;

public interface BulkSink {
  void write(List<?> entities, Map<String, Object> contextData) throws Exception;

  void updateStats(int currentSuccess, int currentFailed);

  StepStats getStats();

  /**
   * Returns the count of entities that failed during SearchIndex document construction. These are
   * entities that were passed to write() but failed before being added to the bulk request.
   */
  default long getEntityBuildFailures() {
    return 0;
  }

  void close() throws IOException;

  /** Callback interface for receiving failure notifications when documents fail to index. */
  @FunctionalInterface
  interface FailureCallback {
    /**
     * Called when a document fails to index in ES/OpenSearch.
     *
     * @param entityType The type of entity that failed
     * @param entityId The ID of the entity (from document ID), may be null for build failures
     * @param entityFqn The FQN of the entity, may be null if not available
     * @param errorMessage The error message from ES/OpenSearch
     */
    void onFailure(String entityType, String entityId, String entityFqn, String errorMessage);
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
}
