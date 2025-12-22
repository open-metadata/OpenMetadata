package org.openmetadata.service.search.lineage;

import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.SearchLineageResult;

/**
 * Strategy for handling large lineage graphs (50K-100K nodes by default).
 * Uses aggressive memory optimization with scroll API support and mandatory progress tracking.
 *
 * <p>This strategy:
 * - Uses scroll API when configured for better memory efficiency
 * - Reduces batch size to 1000 for conservative memory usage
 * - Always enables progress tracking for visibility
 * - Suitable for graphs that are too large for medium strategy but fit in memory with optimization
 * - Warns users about potentially long query times
 *
 * <p>Performance characteristics:
 * - Memory: Conservative (small batches, scroll-based when enabled)
 * - Latency: 30-120 seconds typical for 50K-100K node graphs
 * - Throughput: Optimized for large but not massive graphs
 * - Warning: Graphs approaching 100K nodes should consider reducing depth or using filters
 */
@Slf4j
public class LargeGraphStrategy implements LineageGraphStrategy {

  private final LineageGraphExecutor executor;

  public LargeGraphStrategy(LineageGraphExecutor executor) {
    this.executor = executor;
  }

  @Override
  public SearchLineageResult buildGraph(LineageQueryContext context) throws IOException {
    int estimatedNodes = context.getEstimatedNodeCount();
    LineageGraphConfiguration config = context.getConfig();

    LOG.warn(
        "Using LargeGraphStrategy for graph '{}' with ~{} estimated nodes (batch size: {}). "
            + "This may take 30-120 seconds. Consider reducing depth or using filters.",
        context.getRootFqn(),
        estimatedNodes,
        context.getBatchSize());

    long startTime = System.currentTimeMillis();

    // Use progress tracker from context (created by buildQueryContext)
    LineageProgressTracker tracker = context.getProgressTracker();

    try {
      SearchLineageResult result;

      // Use scroll API if configured for better performance with large result sets
      if (config.isUseScrollForLargeGraphs()) {
        LOG.debug("Using scroll API for large graph '{}'", context.getRootFqn());
        result = executor.executeWithScroll(context, context.getBatchSize());
      } else {
        LOG.debug("Using in-memory approach for large graph '{}'", context.getRootFqn());
        result = executor.executeInMemory(context, context.getBatchSize());
      }

      long duration = System.currentTimeMillis() - startTime;
      int actualNodes = result.getNodes() != null ? result.getNodes().size() : 0;

      LOG.warn(
          "Completed LargeGraphStrategy for '{}': {} nodes in {}ms (estimated: {}). "
              + "Actual/Estimated ratio: {,number,#.##}",
          context.getRootFqn(),
          actualNodes,
          duration,
          estimatedNodes,
          (double) actualNodes / estimatedNodes);

      return result;
    } finally {
      // Clean up progress tracker resources if needed
      if (tracker != null) {
        tracker.complete(context.getRootFqn(), 0, 0);
      }
    }
  }

  @Override
  public boolean canHandle(LineageQueryContext context) {
    int nodeCount = context.getEstimatedNodeCount();
    int mediumThreshold = context.getConfig().getMediumGraphThreshold();
    int maxInMemory = context.getConfig().getMaxInMemoryNodes();

    return nodeCount >= mediumThreshold && nodeCount < maxInMemory;
  }

  @Override
  public String getStrategyName() {
    return "LargeGraph";
  }

  @Override
  public int getPriority() {
    return 50; // Lower than MediumGraph (75), higher than future StreamingGraph (25)
  }
}
