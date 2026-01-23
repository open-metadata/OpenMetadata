package org.openmetadata.service.search.lineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.LineagePathPreserver;
import org.openmetadata.service.search.QueryFilterParser;

/**
 * Abstract base class for lineage graph builders.
 * Eliminates code duplication between Elasticsearch and OpenSearch implementations.
 * Contains common BFS traversal logic, validation, and utility methods.
 * Implements strategy pattern for adaptive graph processing based on size.
 */
@Slf4j
public abstract class AbstractLineageGraphBuilder implements LineageGraphExecutor {

  protected final LineageGraphConfiguration config;
  protected final LineageStrategySelector strategySelector;
  protected final LineageGraphCache cache;

  protected AbstractLineageGraphBuilder() {
    this.config = LineageGraphConfiguration.fromSettings();
    this.strategySelector = new LineageStrategySelector(this);
    this.cache = new GuavaLineageGraphCache(config);
  }

  /**
   * Gets the lineage graph performance configuration.
   *
   * @return Configuration instance loaded from database settings
   */
  protected LineageGraphConfiguration getConfig() {
    return config;
  }

  /**
   * Calculates the current depth level in lineage traversal.
   *
   * @param lineageRequest The lineage request containing depth configuration
   * @param remainingDepth The remaining depth to traverse
   * @return The current depth level
   */
  protected int calculateCurrentDepth(SearchLineageRequest lineageRequest, int remainingDepth) {
    if (lineageRequest.getDirection() == null) {
      return 0;
    }

    int configuredMaxDepth =
        lineageRequest.getDirection().equals(LineageDirection.UPSTREAM)
            ? lineageRequest.getUpstreamDepth()
            : lineageRequest.getDownstreamDepth() + 1;

    return configuredMaxDepth - remainingDepth;
  }

  /**
   * Validates layer pagination parameters.
   *
   * @param lineageRequest The lineage request containing layer parameters
   * @throws IllegalArgumentException if parameters are invalid
   */
  protected void validateLayerParameters(SearchLineageRequest lineageRequest) {
    if (lineageRequest.getLayerFrom() < 0 || lineageRequest.getLayerSize() < 0) {
      throw new IllegalArgumentException(
          "LayerFrom and LayerSize should be greater than or equal to 0");
    }
  }

  /**
   * Paginates a list using offset and limit.
   *
   * @param list The list to paginate
   * @param from The starting index (0-based)
   * @param size The maximum number of elements to return
   * @param <T> The type of elements in the list
   * @return A sublist containing the paginated elements
   */
  protected <T> List<T> paginateList(List<T> list, int from, int size) {
    if (list == null || list.isEmpty() || from >= list.size()) {
      return new ArrayList<>();
    }
    int toIndex = Math.min(from + size, list.size());
    return list.subList(from, toIndex);
  }

  /**
   * Reports progress for lineage query execution.
   * Delegates to the progress tracker in the context if available.
   *
   * @param context The lineage query context containing progress tracker
   * @param processedNodes Number of nodes processed so far
   */
  protected void trackProgress(LineageQueryContext context, int processedNodes) {
    if (context == null || context.getProgressTracker() == null) {
      return;
    }

    LineageProgressTracker tracker = context.getProgressTracker();
    SearchLineageRequest request = context.getRequest();

    int currentDepth = calculateCurrentDepth(request, 0);
    tracker.reportProgress(request.getFqn(), processedNodes, currentDepth);
  }

  /**
   * Checks cache for existing lineage result.
   * Returns cached result if available and caching is enabled.
   *
   * @param request The lineage request
   * @return Optional containing cached result if present, empty otherwise
   */
  protected java.util.Optional<SearchLineageResult> checkCache(SearchLineageRequest request) {
    if (!config.isEnableCaching()) {
      return java.util.Optional.empty();
    }

    LineageCacheKey cacheKey = LineageCacheKey.fromRequest(request);
    return cache.get(cacheKey);
  }

  /**
   * Caches lineage result if eligible.
   * Only caches small and medium graphs (< 50K nodes).
   * Large and streaming graphs are not cached.
   *
   * @param request The lineage request
   * @param result The lineage result to cache
   */
  protected void cacheResult(SearchLineageRequest request, SearchLineageResult result) {
    if (!config.isEnableCaching()) {
      return;
    }

    if (result == null || result.getNodes() == null) {
      return;
    }

    int nodeCount = result.getNodes().size();

    // Only cache small/medium graphs
    if (config.shouldCacheGraph(nodeCount)) {
      LineageCacheKey cacheKey = LineageCacheKey.fromRequest(request);
      cache.put(cacheKey, result);
      LOG.debug("Cached lineage result: fqn={}, nodes={}", request.getFqn(), nodeCount);
    } else {
      LOG.debug(
          "Skipping cache for large graph: fqn={}, nodes={} (threshold={})",
          request.getFqn(),
          nodeCount,
          config.getMediumGraphThreshold());
    }
  }

  /**
   * Invalidates cache entry for the given entity FQN.
   * Should be called when entity is updated or lineage edges change.
   *
   * @param fqn The fully qualified name of the entity
   */
  protected void invalidateCache(String fqn) {
    if (!config.isEnableCaching()) {
      return;
    }

    // Note: This is a simplified invalidation.
    // Full implementation would need to invalidate all cache entries
    // that involve this FQN (as source or in the graph).
    // For now, we rely on TTL-based expiration.
    LOG.debug("Cache invalidation requested for fqn={} (TTL-based expiration active)", fqn);
  }

  /**
   * Applies node-level filters in-memory on unfiltered result while preserving paths.
   * This method filters nodes based on the queryFilter and traces paths from root to matching nodes.
   *
   * @param unfilteredResult The unfiltered lineage result containing all nodes and edges
   * @param request The lineage request containing the query filter and root FQN
   * @return Filtered result with paths preserved from root to matching nodes
   */
  protected SearchLineageResult applyInMemoryFiltersWithPathPreservation(
      SearchLineageResult unfilteredResult, SearchLineageRequest request) {

    if (unfilteredResult == null || request == null) {
      return unfilteredResult;
    }

    String queryFilter = request.getQueryFilter();
    if (nullOrEmpty(queryFilter)) {
      return unfilteredResult;
    }

    // Find matching nodes by applying filter in-memory
    Set<String> matchingNodes = new HashSet<>();
    matchingNodes.add(request.getFqn()); // Always include root

    for (Map.Entry<String, NodeInformation> entry : unfilteredResult.getNodes().entrySet()) {
      if (matchesNodeFilter(entry.getValue(), queryFilter)) {
        matchingNodes.add(entry.getKey());
      }
    }

    // Use LineagePathPreserver to trace paths and preserve edges
    return LineagePathPreserver.preservePathsWithEdges(
        unfilteredResult, request.getFqn(), matchingNodes);
  }

  /**
   * Checks if a node matches the filter criteria (in-memory).
   * Parses ES Query DSL or query strings and matches against entity fields.
   *
   * @param node The node to check
   * @param queryFilter The query filter (ES Query DSL JSON or simple query string)
   * @return true if the node matches the filter, false otherwise
   */
  protected boolean matchesNodeFilter(NodeInformation node, String queryFilter) {
    if (node == null || node.getEntity() == null || nullOrEmpty(queryFilter)) {
      return false;
    }

    Map<String, Object> entityMap = JsonUtils.getMap(node.getEntity());

    // Parse the query filter to extract field-value pairs
    Map<String, List<String>> parsedFilter = QueryFilterParser.parseFilter(queryFilter);

    // Match entity against parsed filter
    return QueryFilterParser.matchesFilter(entityMap, parsedFilter);
  }

  /**
   * Main entry point for building lineage graphs with strategy selection.
   * Uses adaptive strategy based on estimated graph size.
   *
   * @param request The lineage search request
   * @return Complete lineage result
   * @throws java.io.IOException if search backend communication fails
   */
  protected SearchLineageResult buildLineageGraphWithStrategy(SearchLineageRequest request)
      throws java.io.IOException {

    // 1. Estimate graph size
    int estimatedSize = estimateGraphSizeForRequest(request);

    // 2. Build query context
    LineageQueryContext context = buildQueryContext(request, estimatedSize);

    // 3. Select appropriate strategy
    LineageGraphStrategy strategy = strategySelector.selectStrategy(context);

    LOG.debug(
        "Building lineage for {} using {} strategy (estimated {} nodes)",
        request.getFqn(),
        strategy.getStrategyName(),
        estimatedSize);

    // 4. Execute strategy
    return strategy.buildGraph(context);
  }

  /**
   * Builds query context from request and estimated size.
   *
   * @param request The lineage request
   * @param estimatedSize Estimated node count
   * @return Query context
   */
  protected LineageQueryContext buildQueryContext(SearchLineageRequest request, int estimatedSize) {

    boolean requiresPathPreservation =
        (request.getPreservePaths() != null && request.getPreservePaths())
            || !nullOrEmpty(request.getQueryFilter());

    boolean hasComplexFilters = !nullOrEmpty(request.getQueryFilter());

    // Create progress tracker based on configuration
    LineageProgressTracker progressTracker =
        config.isEnableProgressTracking()
            ? new LoggingProgressTracker(config.getProgressReportInterval())
            : NoOpProgressTracker.INSTANCE;

    return LineageQueryContext.builder()
        .request(request)
        .estimatedNodeCount(estimatedSize)
        .config(config)
        .requiresPathPreservation(requiresPathPreservation)
        .hasComplexFilters(hasComplexFilters)
        .progressTracker(progressTracker)
        .build();
  }

  /**
   * Estimates graph size for a lineage request.
   * Wrapper that creates a context for the estimation.
   *
   * @param request The lineage request
   * @return Estimated node count
   * @throws java.io.IOException if estimation fails
   */
  protected int estimateGraphSizeForRequest(SearchLineageRequest request)
      throws java.io.IOException {
    // Create a minimal context for estimation (estimated size = 0 is placeholder)
    LineageQueryContext estimationContext =
        LineageQueryContext.builder()
            .request(request)
            .estimatedNodeCount(0)
            .config(config)
            .requiresPathPreservation(false)
            .hasComplexFilters(false)
            .build();

    return estimateGraphSize(estimationContext);
  }

  /**
   * Abstract method for backend-specific graph size estimation.
   * Must be implemented by ES/OS builders.
   *
   * @param context Query context
   * @return Estimated node count
   * @throws java.io.IOException if estimation fails
   */
  @Override
  public abstract int estimateGraphSize(LineageQueryContext context) throws java.io.IOException;

  /**
   * Abstract method for backend-specific in-memory graph execution.
   * Must be implemented by ES/OS builders.
   *
   * @param context Query context
   * @param batchSize Batch size for queries
   * @return Lineage result
   * @throws java.io.IOException if execution fails
   */
  @Override
  public abstract SearchLineageResult executeInMemory(LineageQueryContext context, int batchSize)
      throws java.io.IOException;
}
