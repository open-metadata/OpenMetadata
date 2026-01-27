package org.openmetadata.service.search.lineage;

/**
 * Interface for tracking lineage query progress.
 * Useful for monitoring long-running queries and providing visibility to users.
 */
public interface LineageProgressTracker {

  /**
   * Called when lineage query starts.
   *
   * @param rootFqn The root entity FQN
   * @param estimatedNodes Estimated number of nodes
   */
  void start(String rootFqn, int estimatedNodes);

  /**
   * Called periodically during lineage traversal to report progress.
   *
   * @param rootFqn The root entity FQN
   * @param processedNodes Number of nodes processed so far
   * @param currentDepth Current depth level being processed
   */
  void reportProgress(String rootFqn, int processedNodes, int currentDepth);

  /**
   * Called when lineage query completes successfully.
   *
   * @param rootFqn The root entity FQN
   * @param actualNodes Actual number of nodes in result
   * @param durationMs Query duration in milliseconds
   */
  void complete(String rootFqn, int actualNodes, long durationMs);

  /**
   * Called when lineage query fails with an error.
   *
   * @param rootFqn The root entity FQN
   * @param error The exception that occurred
   */
  void error(String rootFqn, Exception error);
}
