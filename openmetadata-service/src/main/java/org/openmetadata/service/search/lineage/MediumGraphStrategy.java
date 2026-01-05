package org.openmetadata.service.search.lineage;

import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.SearchLineageResult;

/**
 * Strategy for handling medium lineage graphs (5K-50K nodes by default).
 * Uses optimized batching with smaller batch sizes and progress tracking.
 *
 * <p>This strategy:
 * - Reduces batch size to 5000 for better memory management
 * - Tracks progress for visibility into long-running queries
 * - Pre-sizes collections based on estimated node count
 * - Suitable for graphs that are too large for aggressive caching but fit in memory
 *
 * <p>Performance characteristics:
 * - Memory: Moderate (pre-allocated collections)
 * - Latency: 5-15 seconds typical
 * - Throughput: Optimized for 10K-30K node graphs
 */
@Slf4j
public class MediumGraphStrategy implements LineageGraphStrategy {

  private final LineageGraphExecutor executor;

  public MediumGraphStrategy(LineageGraphExecutor executor) {
    this.executor = executor;
  }

  @Override
  public SearchLineageResult buildGraph(LineageQueryContext context) throws IOException {
    int estimatedNodes = context.getEstimatedNodeCount();
    String rootFqn = context.getRootFqn();

    LOG.info(
        "Using MediumGraphStrategy for graph '{}' with ~{} estimated nodes (batch size: {})",
        rootFqn,
        estimatedNodes,
        context.getBatchSize());

    LineageProgressTracker tracker = context.getProgressTracker();

    // Start progress tracking
    if (tracker != null) {
      tracker.start(rootFqn, estimatedNodes);
    }

    long startTime = System.currentTimeMillis();

    try {
      // Use optimized in-memory approach with smaller batch size
      SearchLineageResult result = executor.executeInMemory(context, context.getBatchSize());

      long duration = System.currentTimeMillis() - startTime;
      int actualNodes = result.getNodes() != null ? result.getNodes().size() : 0;

      LOG.info(
          "Completed MediumGraphStrategy for '{}': {} nodes in {}ms (estimated: {})",
          rootFqn,
          actualNodes,
          duration,
          estimatedNodes);

      // Complete progress tracking
      if (tracker != null) {
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
    int nodeCount = context.getEstimatedNodeCount();
    int smallThreshold = context.getConfig().getSmallGraphThreshold();
    int mediumThreshold = context.getConfig().getMediumGraphThreshold();

    return nodeCount >= smallThreshold && nodeCount < mediumThreshold;
  }

  @Override
  public String getStrategyName() {
    return "MediumGraph";
  }

  @Override
  public int getPriority() {
    return 75; // Lower than SmallGraph (100), higher than future LargeGraph strategies
  }
}
