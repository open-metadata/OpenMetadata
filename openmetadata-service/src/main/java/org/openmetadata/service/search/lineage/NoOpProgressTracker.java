package org.openmetadata.service.search.lineage;

/**
 * No-op progress tracker that does nothing.
 * Used when progress tracking is disabled for performance.
 */
public class NoOpProgressTracker implements LineageProgressTracker {

  public static final NoOpProgressTracker INSTANCE = new NoOpProgressTracker();

  private NoOpProgressTracker() {
    // Singleton
  }

  @Override
  public void start(String rootFqn, int estimatedNodes) {
    // No-op
  }

  @Override
  public void reportProgress(String rootFqn, int processedNodes, int currentDepth) {
    // No-op
  }

  @Override
  public void complete(String rootFqn, int actualNodes, long durationMs) {
    // No-op
  }

  @Override
  public void error(String rootFqn, Exception error) {
    // No-op
  }
}
