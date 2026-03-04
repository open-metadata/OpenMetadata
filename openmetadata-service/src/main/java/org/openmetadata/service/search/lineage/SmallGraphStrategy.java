package org.openmetadata.service.search.lineage;

import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.SearchLineageResult;

/**
 * Strategy for handling small lineage graphs (< 5K nodes by default).
 * Uses in-memory approach with optional caching for optimal performance.
 *
 * <p>This strategy:
 * - Loads entire graph into memory
 * - Uses current batch size from configuration
 * - Eligible for result caching
 * - Best for typical lineage queries (most graphs are small)
 */
@Slf4j
public class SmallGraphStrategy implements LineageGraphStrategy {

  private final LineageGraphExecutor executor;

  public SmallGraphStrategy(LineageGraphExecutor executor) {
    this.executor = executor;
  }

  @Override
  public SearchLineageResult buildGraph(LineageQueryContext context) throws IOException {
    LOG.debug("Using SmallGraphStrategy for graph with ~{} nodes", context.getEstimatedNodeCount());

    LineageProgressTracker tracker = context.getProgressTracker();
    String rootFqn = context.getRequest().getFqn();

    // Start tracking (lightweight for small graphs)
    if (tracker != null) {
      tracker.start(rootFqn, context.getEstimatedNodeCount());
    }

    long startTime = System.currentTimeMillis();

    try {
      // Use the current in-memory approach with configurable batch size
      SearchLineageResult result = executor.executeInMemory(context, context.getBatchSize());

      // Complete tracking
      if (tracker != null) {
        int actualNodes = result.getNodes() != null ? result.getNodes().size() : 0;
        long duration = System.currentTimeMillis() - startTime;
        tracker.complete(rootFqn, actualNodes, duration);
      }

      return result;
    } catch (Exception e) {
      if (tracker != null) {
        tracker.error(rootFqn, e);
      }
      throw e;
    }
  }

  @Override
  public boolean canHandle(LineageQueryContext context) {
    int threshold = context.getConfig().getSmallGraphThreshold();
    return context.getEstimatedNodeCount() < threshold;
  }

  @Override
  public String getStrategyName() {
    return "SmallGraph";
  }

  @Override
  public int getPriority() {
    return 100; // High priority for small graphs
  }
}
