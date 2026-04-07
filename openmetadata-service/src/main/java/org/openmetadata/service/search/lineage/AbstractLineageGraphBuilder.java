package org.openmetadata.service.search.lineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.function.ToIntFunction;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.DepthInfo;
import org.openmetadata.schema.api.lineage.EntityCountLineageRequest;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.schema.api.lineage.LineagePaginationInfo;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.LineagePathPreserver;
import org.openmetadata.service.search.QueryFilterParser;
import org.openmetadata.service.search.lineage.LineageFilterClassifier.FilterClassification;

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
   */
  protected void validateLayerParameters(SearchLineageRequest lineageRequest) {
    if (lineageRequest.getLayerFrom() < 0 || lineageRequest.getLayerSize() < 0) {
      throw new IllegalArgumentException(
          "LayerFrom and LayerSize should be greater than or equal to 0");
    }
  }

  /**
   * Paginates a list using offset and limit.
   */
  protected <T> List<T> paginateList(List<T> list, int from, int size) {
    if (list == null || list.isEmpty() || from >= list.size()) {
      return new ArrayList<>();
    }
    int toIndex = Math.min(from + size, list.size());
    return list.subList(from, toIndex);
  }

  /**
   * Sorts lineage entities by depth and then by fully qualified name for deterministic pagination.
   */
  protected List<String> sortEntityFqnsByDepthThenName(
      List<String> entityFqns, Map<String, Integer> depthByFqn) {
    List<String> sorted = new ArrayList<>(entityFqns);
    sorted.sort(
        Comparator.<String, Integer>comparing(
                fqn -> Math.abs(depthByFqn.getOrDefault(fqn, Integer.MAX_VALUE)))
            .thenComparing(Comparator.naturalOrder()));
    return sorted;
  }

  /**
   * Sorts any lineage payload by depth and then by fully qualified name for deterministic paging.
   */
  protected <T> List<T> sortEntitiesByDepthThenName(
      List<T> entities, ToIntFunction<T> depthExtractor, Function<T, String> fqnExtractor) {
    List<T> sorted = new ArrayList<>(entities);
    sorted.sort(
        Comparator.<T, Integer>comparing(entity -> Math.abs(depthExtractor.applyAsInt(entity)))
            .thenComparing(
                entity -> fqnExtractor.apply(entity), Comparator.nullsLast(String::compareTo)));
    return sorted;
  }

  /**
   * Reports progress for lineage query execution.
   * Delegates to the progress tracker in the context if available.
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

    List<Map<String, QueryFilterParser.FieldMatch>> parsedFilter =
        QueryFilterParser.parseTypedFilterClauses(queryFilter);

    Set<String> matchingNodes = new HashSet<>();
    matchingNodes.add(request.getFqn()); // Always include root

    for (Map.Entry<String, NodeInformation> entry : unfilteredResult.getNodes().entrySet()) {
      if (matchesNodeFilter(entry.getValue(), parsedFilter)) {
        matchingNodes.add(entry.getKey());
      }
    }

    // Use LineagePathPreserver to trace paths and preserve edges
    return LineagePathPreserver.preservePathsWithEdges(
        unfilteredResult, request.getFqn(), matchingNodes);
  }

  /**
   * Checks if a node matches the pre-parsed filter criteria (in-memory).
   *
   * @param node The node to check
   * @param parsedFilter Pre-parsed filter (field -> values)
   * @return true if the node matches the filter, false otherwise
   */
  @SuppressWarnings("unchecked")
  protected boolean matchesNodeFilter(
      NodeInformation node, Map<String, List<String>> parsedFilter) {
    if (node == null
        || node.getEntity() == null
        || parsedFilter == null
        || parsedFilter.isEmpty()) {
      return false;
    }

    // Entity is already stored as Map<String, Object> from ES response — avoid Jackson round-trip
    Map<String, Object> entityMap;
    if (node.getEntity() instanceof Map) {
      entityMap = (Map<String, Object>) node.getEntity();
    } else {
      entityMap = JsonUtils.getMap(node.getEntity());
    }
    return QueryFilterParser.matchesFilter(entityMap, parsedFilter);
  }

  @SuppressWarnings("unchecked")
  protected boolean matchesNodeFilter(
      NodeInformation node, List<Map<String, QueryFilterParser.FieldMatch>> parsedFilter) {
    if (node == null
        || node.getEntity() == null
        || parsedFilter == null
        || parsedFilter.isEmpty()) {
      return false;
    }

    Map<String, Object> entityMap;
    if (node.getEntity() instanceof Map) {
      entityMap = (Map<String, Object>) node.getEntity();
    } else {
      entityMap = JsonUtils.getMap(node.getEntity());
    }

    return QueryFilterParser.matchesTypedFilterClauses(entityMap, parsedFilter);
  }

  /**
   * Checks if a node matches the filter criteria (in-memory).
   * Convenience method that parses the query filter string.
   *
   * @param node The node to check
   * @param queryFilter The query filter (ES Query DSL JSON or simple query string)
   * @return true if the node matches the filter, false otherwise
   * Parses ES Query DSL or query strings and matches against entity fields.
   */
  @SuppressWarnings("unchecked")
  protected boolean matchesNodeFilter(NodeInformation node, String queryFilter) {
    if (node == null || node.getEntity() == null || nullOrEmpty(queryFilter)) {
      return false;
    }
    @SuppressWarnings("unchecked")
    Map<String, Object> entityMap =
        node.getEntity() instanceof Map
            ? (Map<String, Object>) node.getEntity()
            : JsonUtils.getMap(node.getEntity());
    return QueryFilterParser.matchesFilter(entityMap, queryFilter);
  }

  protected SearchLineageResult applyInMemoryFiltersWithPathPreservationForEntityCount(
      SearchLineageResult unfilteredResult, EntityCountLineageRequest request) {

    if (unfilteredResult == null || request == null) {
      return unfilteredResult;
    }

    String queryFilter = request.getQueryFilter();
    if (nullOrEmpty(queryFilter)) {
      return unfilteredResult;
    }

    List<Map<String, QueryFilterParser.FieldMatch>> parsedFilter =
        QueryFilterParser.parseTypedFilterClauses(queryFilter);

    Set<String> matchingNodes = new HashSet<>();
    matchingNodes.add(request.getFqn());

    for (Map.Entry<String, NodeInformation> entry : unfilteredResult.getNodes().entrySet()) {
      if (matchesNodeFilter(entry.getValue(), parsedFilter)) {
        matchingNodes.add(entry.getKey());
      }
    }

    // Preserve edges for path context
    SearchLineageResult preservedResult =
        LineagePathPreserver.preservePathsWithEdges(
            unfilteredResult, request.getFqn(), matchingNodes);

    // For table view, only show matching nodes (not intermediate path nodes)
    // Keep only nodes that actually match the filter + root
    Map<String, NodeInformation> filteredNodes = new HashMap<>();
    for (String nodeFqn : matchingNodes) {
      if (preservedResult.getNodes().containsKey(nodeFqn)) {
        filteredNodes.put(nodeFqn, preservedResult.getNodes().get(nodeFqn));
      }
    }
    preservedResult.setNodes(filteredNodes);

    return applyEntityCountPagination(preservedResult, request);
  }

  protected SearchLineageResult applyEntityCountPagination(
      SearchLineageResult result, EntityCountLineageRequest request) {

    if (result == null || result.getNodes() == null) {
      return result;
    }

    if (request.getNodeDepth() != null) {
      applyDepthFilter(result, request.getFqn(), Math.abs(request.getNodeDepth()));
    }

    List<String> sortedFqns = sortNodesByDepthThenName(result.getNodes(), request.getFqn());
    int from = request.getFrom() != null ? request.getFrom() : 0;
    int size = request.getSize() != null ? request.getSize() : 50;

    List<String> pageFqns = paginateNodeFqns(sortedFqns, from, size);
    pageFqns.add(request.getFqn());

    setNodesFromFqns(result, pageFqns);
    filterEdgesToMatchNodes(result);
    return result;
  }

  private void applyDepthFilter(SearchLineageResult result, String rootFqn, int maxDepth) {
    Map<String, NodeInformation> filtered = new HashMap<>();
    for (Map.Entry<String, NodeInformation> entry : result.getNodes().entrySet()) {
      NodeInformation node = entry.getValue();
      int nodeDepth = node.getNodeDepth() != null ? Math.abs(node.getNodeDepth()) : 0;
      if (nodeDepth <= maxDepth || entry.getKey().equals(rootFqn)) {
        filtered.put(entry.getKey(), node);
      }
    }
    result.setNodes(filtered);
    filterEdgesToMatchNodes(result);
  }

  private List<String> sortNodesByDepthThenName(
      Map<String, NodeInformation> nodes, String rootFqn) {
    List<String> fqns = new ArrayList<>(nodes.keySet());
    fqns.remove(rootFqn);
    fqns.sort(
        Comparator.<String, Integer>comparing(
                fqn -> {
                  NodeInformation node = nodes.get(fqn);
                  int depth = node != null && node.getNodeDepth() != null ? node.getNodeDepth() : 0;
                  return Math.abs(depth);
                })
            .thenComparing(Comparator.naturalOrder()));
    return fqns;
  }

  private List<String> paginateNodeFqns(List<String> sortedFqns, int from, int size) {
    if (from >= sortedFqns.size()) {
      return new ArrayList<>();
    }
    int toIndex = Math.min(from + size, sortedFqns.size());
    return new ArrayList<>(sortedFqns.subList(from, toIndex));
  }

  private void setNodesFromFqns(SearchLineageResult result, List<String> fqns) {
    Map<String, NodeInformation> selected = new HashMap<>();
    for (String fqn : fqns) {
      if (result.getNodes().containsKey(fqn)) {
        selected.put(fqn, result.getNodes().get(fqn));
      }
    }
    result.setNodes(selected);
  }

  private void filterEdgesToMatchNodes(SearchLineageResult result) {
    Set<String> nodeFqns = result.getNodes().keySet();
    if (result.getUpstreamEdges() != null) {
      result.setUpstreamEdges(retainConnectedEdges(result.getUpstreamEdges(), nodeFqns));
    }
    if (result.getDownstreamEdges() != null) {
      result.setDownstreamEdges(retainConnectedEdges(result.getDownstreamEdges(), nodeFqns));
    }
  }

  private Map<String, EsLineageData> retainConnectedEdges(
      Map<String, EsLineageData> edges, Set<String> nodeFqns) {
    Map<String, EsLineageData> filtered = new HashMap<>();
    for (Map.Entry<String, EsLineageData> entry : edges.entrySet()) {
      EsLineageData edge = entry.getValue();
      String fromFqn =
          edge.getFromEntity() != null ? edge.getFromEntity().getFullyQualifiedName() : null;
      String toFqn = edge.getToEntity() != null ? edge.getToEntity().getFullyQualifiedName() : null;
      if (fromFqn != null
          && toFqn != null
          && nodeFqns.contains(fromFqn)
          && nodeFqns.contains(toFqn)) {
        filtered.put(entry.getKey(), edge);
      }
    }
    return filtered;
  }

  /**
   * Main entry point for building lineage graphs with strategy selection.
   * Uses adaptive strategy based on estimated graph size.
   */
  protected SearchLineageResult buildLineageGraphWithStrategy(SearchLineageRequest request)
      throws IOException {

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
   */
  protected LineageQueryContext buildQueryContext(SearchLineageRequest request, int estimatedSize) {

    boolean hasNodeLevelFilters = hasNodeLevelFilters(request.getQueryFilter());

    boolean requiresPathPreservation =
        (request.getPreservePaths() != null && request.getPreservePaths()) && hasNodeLevelFilters;

    boolean hasComplexFilters = hasNodeLevelFilters;

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
   */
  protected int estimateGraphSizeForRequest(SearchLineageRequest request) {
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
   */
  @Override
  public abstract int estimateGraphSize(LineageQueryContext context);

  /**
   * Abstract method for backend-specific in-memory graph execution.
   * Must be implemented by ES/OS builders.
   */
  @Override
  public abstract SearchLineageResult executeInMemory(LineageQueryContext context, int batchSize)
      throws IOException;

  protected boolean hasNodeLevelFilters(String queryFilter) {
    return classifyQueryFilter(queryFilter).hasNodeLevelFilters();
  }

  protected String getStructuralFilterOnly(String queryFilter) {
    return classifyQueryFilter(queryFilter).getStructuralFilterOnly();
  }

  protected int getTraversalDepth(Integer nodeDepth, Integer maxDepth) {
    int boundedMaxDepth = maxDepth != null && maxDepth > 0 ? maxDepth : 0;
    int selectedDepth = nodeDepth != null ? Math.abs(nodeDepth) : 0;

    if (selectedDepth == 0) {
      return boundedMaxDepth;
    }
    if (boundedMaxDepth == 0) {
      return selectedDepth;
    }

    return Math.min(selectedDepth, boundedMaxDepth);
  }

  protected Map<Integer, List<String>> dedupeEntitiesByDepth(
      Map<Integer, List<String>> entitiesByDepth) {
    Map<Integer, List<String>> deduped = new LinkedHashMap<>();
    for (Map.Entry<Integer, List<String>> entry : entitiesByDepth.entrySet()) {
      deduped.put(entry.getKey(), new ArrayList<>(new LinkedHashSet<>(entry.getValue())));
    }

    return deduped;
  }

  protected Map<Integer, Integer> toDepthCounts(Map<Integer, List<String>> entitiesByDepth) {
    Map<Integer, Integer> depthCounts = new LinkedHashMap<>();
    for (Map.Entry<Integer, List<String>> entry : entitiesByDepth.entrySet()) {
      if (!entry.getValue().isEmpty()) {
        depthCounts.put(entry.getKey(), entry.getValue().size());
      }
    }

    return depthCounts;
  }

  protected Map<Integer, Integer> countMatchingEntitiesByDepth(
      Map<Integer, List<String>> entitiesByDepth, Set<String> matchingFqns) {
    Map<Integer, Integer> depthCounts = new LinkedHashMap<>();
    for (Map.Entry<Integer, List<String>> entry : entitiesByDepth.entrySet()) {
      int count = 0;
      for (String entityFqn : entry.getValue()) {
        if (matchingFqns.contains(entityFqn)) {
          count++;
        }
      }
      if (count > 0) {
        depthCounts.put(entry.getKey(), count);
      }
    }

    return depthCounts;
  }

  protected LineagePaginationInfo buildPaginationInfo(
      Map<Integer, Integer> upstreamDepthCounts, Map<Integer, Integer> downstreamDepthCounts) {
    LineagePaginationInfo paginationInfo = new LineagePaginationInfo();
    paginationInfo.setTotalUpstreamEntities(
        upstreamDepthCounts.values().stream().mapToInt(Integer::intValue).sum());
    paginationInfo.setTotalDownstreamEntities(
        downstreamDepthCounts.values().stream().mapToInt(Integer::intValue).sum());
    paginationInfo.setMaxUpstreamDepth(
        upstreamDepthCounts.keySet().stream().mapToInt(Integer::intValue).max().orElse(0));
    paginationInfo.setMaxDownstreamDepth(
        downstreamDepthCounts.keySet().stream().mapToInt(Integer::intValue).max().orElse(0));
    paginationInfo.setUpstreamDepthInfo(toDepthInfoList(upstreamDepthCounts));
    paginationInfo.setDownstreamDepthInfo(toDepthInfoList(downstreamDepthCounts));

    return paginationInfo;
  }

  protected int getRequestedDepthForDirection(
      EntityCountLineageRequest request, LineageDirection direction) {
    Integer requestedDepth =
        direction == LineageDirection.UPSTREAM
            ? request.getUpstreamDepth()
            : request.getDownstreamDepth();

    if (requestedDepth != null) {
      return Math.max(requestedDepth, 0);
    }

    if (request.getDirection() == direction) {
      return getTraversalDepth(request.getNodeDepth(), request.getMaxDepth());
    }

    return 0;
  }

  private List<DepthInfo> toDepthInfoList(Map<Integer, Integer> depthCounts) {
    List<DepthInfo> depthInfo = new ArrayList<>();
    for (Map.Entry<Integer, Integer> entry : depthCounts.entrySet()) {
      DepthInfo info = new DepthInfo();
      info.setDepth(entry.getKey());
      info.setEntityCount(entry.getValue());
      depthInfo.add(info);
    }
    depthInfo.sort(Comparator.comparingInt(DepthInfo::getDepth));

    return depthInfo;
  }

  private FilterClassification classifyQueryFilter(String queryFilter) {
    return LineageFilterClassifier.classify(queryFilter);
  }
}
