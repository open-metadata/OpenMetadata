package org.openmetadata.service.search.lineage;

import lombok.extern.slf4j.Slf4j;

/**
 * Simple progress tracker that logs to SLF4J.
 * Reports progress at configured intervals for visibility into long-running queries.
 */
@Slf4j
public class LoggingProgressTracker implements LineageProgressTracker {

  private final int reportInterval;

  /**
   * Creates a logging progress tracker.
   *
   * @param reportInterval Report progress every N nodes (e.g., 1000)
   */
  public LoggingProgressTracker(int reportInterval) {
    this.reportInterval = reportInterval;
  }

  @Override
  public void start(String rootFqn, int estimatedNodes) {
    LOG.info("Starting lineage query for '{}' (estimated {} nodes)", rootFqn, estimatedNodes);
  }

  @Override
  public void reportProgress(String rootFqn, int processedNodes, int currentDepth) {
    // Only log at configured intervals to avoid spam
    if (processedNodes > 0 && processedNodes % reportInterval == 0) {
      LOG.info(
          "Lineage progress for '{}': {} nodes processed at depth {}",
          rootFqn,
          processedNodes,
          currentDepth);
    }
  }

  @Override
  public void complete(String rootFqn, int actualNodes, long durationMs) {
    LOG.info(
        "Completed lineage query for '{}': {} nodes in {}ms", rootFqn, actualNodes, durationMs);
  }

  @Override
  public void error(String rootFqn, Exception error) {
    LOG.error("Lineage query failed for '{}': {}", rootFqn, error.getMessage(), error);
  }
}
