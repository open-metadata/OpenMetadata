package org.openmetadata.service.search.lineage;

import lombok.Builder;
import lombok.Getter;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;

/**
 * Immutable context object for lineage query execution.
 * Contains all information needed for strategy selection and execution.
 */
@Getter
@Builder
public class LineageQueryContext {

  private final SearchLineageRequest request;
  private final int estimatedNodeCount;
  private final LineageGraphConfiguration config;
  private final boolean requiresPathPreservation;
  private final boolean hasComplexFilters;
  private final LineageProgressTracker progressTracker;

  /**
   * Gets the root entity FQN from the request.
   *
   * @return Fully qualified name of the root entity
   */
  public String getRootFqn() {
    return request.getFqn();
  }

  /**
   * Gets the query filter from the request.
   *
   * @return Query filter string (may be null)
   */
  public String getQueryFilter() {
    return request.getQueryFilter();
  }

  /**
   * Checks if path preservation is needed.
   * Path preservation is required when:
   * - preservePaths is explicitly enabled in request, OR
   * - there are node-level filters that might exclude intermediate nodes
   *
   * @return true if path preservation is required
   */
  public boolean requiresPathPreservation() {
    return requiresPathPreservation;
  }

  /**
   * Determines if the query has complex filters requiring special handling.
   *
   * @return true if complex filters are present
   */
  public boolean hasComplexFilters() {
    return hasComplexFilters;
  }

  /**
   * Gets the appropriate batch size for this context based on estimated size.
   *
   * @return Batch size for search backend queries
   */
  public int getBatchSize() {
    return config.getBatchSizeForGraphSize(estimatedNodeCount);
  }

  /**
   * Checks if this graph should be cached based on configuration and size.
   *
   * @return true if caching should be used
   */
  public boolean shouldCache() {
    return config.shouldCacheGraph(estimatedNodeCount);
  }

  /**
   * Checks if streaming mode should be used based on estimated size.
   *
   * @return true if streaming is recommended
   */
  public boolean shouldUseStreaming() {
    return config.shouldUseStreaming(estimatedNodeCount);
  }
}
