package org.openmetadata.service.apps.bundles.searchIndex;

public record VectorCompletionResult(boolean completed, int pendingTaskCount, long waitedMillis) {

  public static VectorCompletionResult success(long waitedMillis) {
    return new VectorCompletionResult(true, 0, waitedMillis);
  }

  public static VectorCompletionResult timeout(int pendingCount, long waitedMillis) {
    return new VectorCompletionResult(false, pendingCount, waitedMillis);
  }
}
