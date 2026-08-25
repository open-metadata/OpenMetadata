package org.openmetadata.service.search.lineage;

import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.SearchLineageResult;

/**
 * Strategy for handling very large lineage graphs (>100K nodes).
 * Uses strict memory limits with scroll-only processing and detailed progress tracking.
 *
 * <p>This strategy:
 * - ALWAYS uses scroll API (no in-memory fallback)
 * - Uses smallest batch size (500) for minimal memory footprint
 * - Enables detailed progress tracking with frequent reporting
 * - Warns users about extremely long query times
 * - May recommend reducing depth or adding filters
 * - Suitable for enterprise-wide or data lake-wide lineage queries
 *
 * <p>Performance characteristics:
 * - Memory: Minimal (strict streaming, no in-memory accumulation)
 * - Latency: 2-10 minutes typical for 100K-500K node graphs
 * - Throughput: Optimized for massive graphs with strict memory constraints
 * - Warning: Queries this large may indicate need for filtering or depth reduction
 *
 * <p>Use cases:
 * - Complete organizational lineage
 * - Data lake-wide queries
 * - Compliance/audit queries across all systems
 * - Graph visualization with extreme depth
 *
 * <p>Recommendations for users:
 * - Consider adding filters (owner, domain, tags)
 * - Reduce depth (try depth 3 instead of 5)
 * - Query specific subgraphs instead of entire organization
 * - Use pagination if supported
 */
@Slf4j
public class StreamingGraphStrategy implements LineageGraphStrategy {

  private final LineageGraphExecutor executor;

  public StreamingGraphStrategy(LineageGraphExecutor executor) {
    this.executor = executor;
  }

  @Override
  public SearchLineageResult buildGraph(LineageQueryContext context) throws IOException {
    int estimatedNodes = context.getEstimatedNodeCount();
    LineageGraphConfiguration config = context.getConfig();

    LOG.error(
        "Using StreamingGraphStrategy for graph '{}' with ~{} estimated nodes (batch size: {}). "
            + "This query may take 2-10 minutes. STRONGLY RECOMMEND: "
            + "1) Reduce depth, 2) Add filters (owner/domain/tags), 3) Query specific subgraphs. "
            + "Graphs this large may indicate overly broad query scope.",
        context.getRootFqn(),
        estimatedNodes,
        context.getBatchSize());

    long startTime = System.currentTimeMillis();

    // Use progress tracker from context (created by buildQueryContext)
    LineageProgressTracker tracker = context.getProgressTracker();

    try {
      // SCROLL ONLY - no in-memory fallback for graphs this large
      LOG.info(
          "Starting scroll-based streaming execution for graph '{}' with estimated {} nodes",
          context.getRootFqn(),
          estimatedNodes);

      SearchLineageResult result = executor.executeWithScroll(context, context.getBatchSize());

      long duration = System.currentTimeMillis() - startTime;
      int actualNodes = result.getNodes() != null ? result.getNodes().size() : 0;

      // Log completion with warnings if query was extremely large
      if (actualNodes > 500000) {
        LOG.error(
            "COMPLETED StreamingGraphStrategy for '{}': {} nodes in {}ms (estimated: {}). "
                + "WARNING: Graph has over 500K nodes. Consider implementing query limits or pagination. "
                + "Actual/Estimated ratio: {,number,#.##}",
            context.getRootFqn(),
            actualNodes,
            duration,
            estimatedNodes,
            (double) actualNodes / estimatedNodes);
      } else {
        LOG.warn(
            "Completed StreamingGraphStrategy for '{}': {} nodes in {}ms (estimated: {}). "
                + "Actual/Estimated ratio: {,number,#.##}",
            context.getRootFqn(),
            actualNodes,
            duration,
            estimatedNodes,
            (double) actualNodes / estimatedNodes);
      }

      // Provide guidance for future queries
      if (duration > 300000) { // 5 minutes
        LOG.warn(
            "Query for '{}' took over 5 minutes. Consider: "
                + "1) Reducing depth (current: up={}, down={}), "
                + "2) Adding filters, "
                + "3) Querying specific subsystems instead of entire organization.",
            context.getRootFqn(),
            context.getRequest().getUpstreamDepth(),
            context.getRequest().getDownstreamDepth());
      }

      return result;
    } finally {
      // Clean up progress tracker resources
      if (tracker != null) {
        tracker.complete(context.getRootFqn(), 0, 0);
      }
    }
  }

  @Override
  public boolean canHandle(LineageQueryContext context) {
    int nodeCount = context.getEstimatedNodeCount();
    int maxInMemory = context.getConfig().getMaxInMemoryNodes();

    // Handle all graphs >= maxInMemoryNodes (100K by default)
    return nodeCount >= maxInMemory;
  }

  @Override
  public String getStrategyName() {
    return "StreamingGraph";
  }

  @Override
  public int getPriority() {
    return 25; // Lowest priority - fallback for massive graphs
  }
}
