package org.openmetadata.service.search.opensearch;

import static org.openmetadata.common.utils.CommonUtil.collectionOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD;
import static org.openmetadata.service.search.SearchClient.FQN_FIELD;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchUtils.GRAPH_AGGREGATION;
import static org.openmetadata.service.search.SearchUtils.buildDirectionToFqnSet;
import static org.openmetadata.service.search.SearchUtils.getLineageDirection;
import static org.openmetadata.service.search.SearchUtils.getRelationshipRef;
import static org.openmetadata.service.search.SearchUtils.getUpstreamLineageListIfExist;
import static org.openmetadata.service.search.SearchUtils.isConnectedVia;
import static org.openmetadata.service.search.elasticsearch.ElasticSearchClient.SOURCE_FIELDS_TO_EXCLUDE;
import static org.openmetadata.service.search.opensearch.OsUtils.getSearchRequest;
import static org.openmetadata.service.util.LineageUtil.getNodeInformation;

import com.nimbusds.jose.util.Pair;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.DepthInfo;
import org.openmetadata.schema.api.lineage.EntityCountLineageRequest;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.schema.api.lineage.LineagePaginationInfo;
import org.openmetadata.schema.api.lineage.RelationshipRef;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.LayerPaging;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.ColumnFilterMatcher;
import org.openmetadata.service.search.ColumnMetadataCache;
import org.openmetadata.service.search.LineagePathPreserver;
import org.openmetadata.service.util.FullyQualifiedName;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.aggregations.StringTermsAggregate;
import os.org.opensearch.client.opensearch._types.aggregations.StringTermsBucket;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;
import os.org.opensearch.client.opensearch.core.search.Hit;

@Slf4j
public class OSLineageGraphBuilder
    extends org.openmetadata.service.search.lineage.AbstractLineageGraphBuilder {
  private final OpenSearchClient esClient;

  public OSLineageGraphBuilder(OpenSearchClient esClient) {
    this.esClient = esClient;
  }

  public SearchLineageResult getPlatformLineage(String index, String queryFilter, boolean deleted)
      throws IOException {
    SearchLineageResult result =
        new SearchLineageResult()
            .withNodes(new HashMap<>())
            .withUpstreamEdges(new HashMap<>())
            .withDownstreamEdges(new HashMap<>());
    SearchResponse<JsonData> searchResponse =
        OsUtils.searchEntities(esClient, index, queryFilter, deleted);

    // Add Nodes
    searchResponse.hits().hits().stream()
        .filter(hit -> hit.source() != null)
        .map(hit -> collectionOrEmpty(OsUtils.jsonDataToMap(hit.source())))
        .forEach(
            sourceMap -> {
              String fqn = sourceMap.get(FQN_FIELD).toString();
              result.getNodes().putIfAbsent(fqn, getNodeInformation(sourceMap, null, null, 0));

              List<EsLineageData> upstreamLineageList = getUpstreamLineageListIfExist(sourceMap);
              for (EsLineageData esLineageData : upstreamLineageList) {
                result
                    .getUpstreamEdges()
                    .putIfAbsent(
                        esLineageData.getDocId(),
                        esLineageData.withToEntity(getRelationshipRef(sourceMap)));
              }
            });
    return result;
  }

  public SearchLineageResult getUpstreamLineage(SearchLineageRequest request) throws IOException {
    validateLayerParameters(request);

    SearchLineageResult result =
        new SearchLineageResult()
            .withNodes(new HashMap<>())
            .withUpstreamEdges(new HashMap<>())
            .withDownstreamEdges(new HashMap<>());

    fetchUpstreamNodesRecursively(
        request,
        result,
        Map.of(FullyQualifiedName.buildHash(request.getFqn()), request.getFqn()),
        request.getUpstreamDepth());
    return result;
  }

  private void fetchUpstreamNodesRecursively(
      SearchLineageRequest lineageRequest,
      SearchLineageResult result,
      Map<String, String> hasToFqnMap,
      int remainingDepth)
      throws IOException {
    if (remainingDepth < 0 || hasToFqnMap.isEmpty()) {
      return;
    }

    validateLayerParameters(lineageRequest);

    Map<String, String> hasToFqnMapForLayer = new HashMap<>();
    Map<String, Set<String>> directionKeyAndValues =
        buildDirectionToFqnSet(lineageRequest.getDirectionValue(), hasToFqnMap.keySet());
    SearchRequest searchRequest =
        getSearchRequest(
            lineageRequest.getDirection(),
            GLOBAL_SEARCH_ALIAS,
            lineageRequest.getUpstreamDepth() == remainingDepth
                ? null
                : lineageRequest.getQueryFilter(),
            GRAPH_AGGREGATION,
            directionKeyAndValues,
            0,
            10000,
            lineageRequest.getIncludeDeleted(),
            lineageRequest.getIncludeSourceFields().stream().toList(),
            SOURCE_FIELDS_TO_EXCLUDE);

    SearchResponse<JsonData> searchResponse = esClient.search(searchRequest, JsonData.class);
    for (Hit<JsonData> hit : searchResponse.hits().hits()) {
      if (hit.source() != null) {
        Map<String, Object> esDoc = OsUtils.jsonDataToMap(hit.source());
        if (!esDoc.isEmpty()) {
          String fqn = esDoc.get(FQN_FIELD).toString();
          RelationshipRef toEntity = getRelationshipRef(esDoc);
          List<EsLineageData> upStreamEntities = getUpstreamLineageListIfExist(esDoc);
          int currentDepth = calculateCurrentDepth(lineageRequest, remainingDepth);
          result
              .getNodes()
              .putIfAbsent(
                  fqn, getNodeInformation(esDoc, null, upStreamEntities.size(), -1 * currentDepth));

          List<EsLineageData> paginatedUpstreamEntities =
              paginateList(
                  upStreamEntities, lineageRequest.getLayerFrom(), lineageRequest.getLayerSize());
          for (EsLineageData data : paginatedUpstreamEntities) {
            result.getUpstreamEdges().putIfAbsent(data.getDocId(), data.withToEntity(toEntity));
            String fromFqn = data.getFromEntity().getFullyQualifiedName();
            if (!result.getNodes().containsKey(fromFqn)) {
              hasToFqnMapForLayer.put(FullyQualifiedName.buildHash(fromFqn), fromFqn);
            }
          }
        }
      }
    }

    // Pipeline only needs one call to get connect entities, so remaining other are
    // just entities
    if (Boolean.TRUE.equals(lineageRequest.getIsConnectedVia())) {
      SearchLineageRequest newReq = JsonUtils.deepCopy(lineageRequest, SearchLineageRequest.class);
      Set<String> directionValue = getLineageDirection(lineageRequest.getDirection(), false);
      fetchUpstreamNodesRecursively(
          newReq.withDirectionValue(directionValue).withIsConnectedVia(false),
          result,
          hasToFqnMapForLayer,
          remainingDepth - 1);
    } else {
      fetchUpstreamNodesRecursively(
          lineageRequest, result, hasToFqnMapForLayer, remainingDepth - 1);
    }
  }

  public SearchLineageResult getDownstreamLineage(SearchLineageRequest lineageRequest)
      throws IOException {
    SearchLineageResult result =
        new SearchLineageResult()
            .withNodes(new HashMap<>())
            .withUpstreamEdges(new HashMap<>())
            .withDownstreamEdges(new HashMap<>());
    fetchDownstreamNodesRecursively(
        lineageRequest,
        result,
        Map.of(FullyQualifiedName.buildHash(lineageRequest.getFqn()), lineageRequest.getFqn()),
        lineageRequest.getDownstreamDepth());
    return result;
  }

  private void fetchDownstreamNodesRecursively(
      SearchLineageRequest lineageRequest,
      SearchLineageResult result,
      Map<String, String> hasToFqnMap,
      int remainingDepth)
      throws IOException {
    if (remainingDepth <= 0 || hasToFqnMap.isEmpty()) {
      return;
    }

    validateLayerParameters(lineageRequest);

    Map<String, String> hasToFqnMapForLayer = new HashMap<>();
    Map<String, Set<String>> directionKeyAndValues =
        buildDirectionToFqnSet(lineageRequest.getDirectionValue(), hasToFqnMap.keySet());
    SearchRequest searchRequest =
        getSearchRequest(
            lineageRequest.getDirection(),
            GLOBAL_SEARCH_ALIAS,
            lineageRequest.getQueryFilter(),
            GRAPH_AGGREGATION,
            directionKeyAndValues,
            lineageRequest.getLayerFrom(),
            lineageRequest.getLayerSize(),
            lineageRequest.getIncludeDeleted(),
            lineageRequest.getIncludeSourceFields().stream().toList(),
            SOURCE_FIELDS_TO_EXCLUDE);

    SearchResponse<JsonData> searchResponse = esClient.search(searchRequest, JsonData.class);

    // Process aggregations first
    StringTermsAggregate valueCountAgg =
        searchResponse.aggregations() != null
                && searchResponse.aggregations().get(GRAPH_AGGREGATION) != null
            ? searchResponse.aggregations().get(GRAPH_AGGREGATION).sterms()
            : null;

    if (valueCountAgg != null) {
      for (StringTermsBucket bucket : valueCountAgg.buckets().array()) {
        String fqnFromHash = hasToFqnMap.get(bucket.key());
        if (!nullOrEmpty(bucket.key())
            && fqnFromHash != null
            && result.getNodes().containsKey(fqnFromHash)) {
          NodeInformation nodeInformation = result.getNodes().get(fqnFromHash);
          nodeInformation.setPaging(
              new LayerPaging().withEntityDownstreamCount((int) bucket.docCount()));
          result.getNodes().put(fqnFromHash, nodeInformation);
        }
      }
    }

    for (Hit<JsonData> hit : searchResponse.hits().hits()) {
      if (hit.source() != null) {
        Map<String, Object> entityMap = OsUtils.jsonDataToMap(hit.source());
        if (!entityMap.isEmpty()) {
          String fqn = entityMap.get(FQN_FIELD).toString();

          RelationshipRef toEntity = getRelationshipRef(entityMap);
          if (!result.getNodes().containsKey(fqn)) {
            hasToFqnMapForLayer.put(FullyQualifiedName.buildHash(fqn), fqn);
            int currentDepth = calculateCurrentDepth(lineageRequest, remainingDepth);
            result.getNodes().put(fqn, getNodeInformation(entityMap, 0, null, currentDepth));
          }

          List<EsLineageData> upstreamEntities = getUpstreamLineageListIfExist(entityMap);
          for (EsLineageData esLineageData : upstreamEntities) {
            if (hasToFqnMap.containsKey(esLineageData.getFromEntity().getFqnHash())) {
              result
                  .getDownstreamEdges()
                  .putIfAbsent(esLineageData.getDocId(), esLineageData.withToEntity(toEntity));
            }
          }
        }
      }
    }

    // Pipeline only needs one call to get connect entities, so remaining other are
    // just entities
    if (Boolean.TRUE.equals(lineageRequest.getIsConnectedVia())) {
      SearchLineageRequest newReq = JsonUtils.deepCopy(lineageRequest, SearchLineageRequest.class);
      Set<String> directionValue = getLineageDirection(lineageRequest.getDirection(), false);
      fetchDownstreamNodesRecursively(
          newReq.withDirectionValue(directionValue).withIsConnectedVia(false),
          result,
          hasToFqnMapForLayer,
          remainingDepth - 1);
    } else {
      fetchDownstreamNodesRecursively(
          lineageRequest, result, hasToFqnMapForLayer, remainingDepth - 1);
    }
  }

  public SearchLineageResult searchLineage(SearchLineageRequest lineageRequest) throws IOException {
    // Check cache first (if no path preservation or column filters)
    boolean needsPathPreservation =
        Boolean.TRUE.equals(lineageRequest.getPreservePaths())
            && hasNodeLevelFilters(lineageRequest.getQueryFilter());
    boolean hasColumnFilter = !nullOrEmpty(lineageRequest.getColumnFilter());

    // Only use cache if no complex post-processing needed
    if (!needsPathPreservation && !hasColumnFilter) {
      java.util.Optional<SearchLineageResult> cached = checkCache(lineageRequest);
      if (cached.isPresent()) {
        LOG.debug("Cache hit for lineage query: {}", lineageRequest.getFqn());
        return cached.get();
      }
    }

    SearchLineageResult result;

    if (needsPathPreservation) {
      // Fetch unfiltered lineage (only structural filters)
      SearchLineageRequest unfilteredRequest =
          JsonUtils.deepCopy(lineageRequest, SearchLineageRequest.class)
              .withQueryFilter(getStructuralFilterOnly(lineageRequest.getQueryFilter()));
      result = searchLineageWithStrategyInternal(unfilteredRequest);

      // Apply node-level filters in-memory with path preservation
      result = applyInMemoryFiltersWithPathPreservation(result, lineageRequest);
    } else {
      // Use strategy-based execution for optimal performance
      result = searchLineageWithStrategyInternal(lineageRequest);
    }

    // Apply column filters
    if (hasColumnFilter) {
      result = applyColumnFiltering(result, lineageRequest);
    }

    // Cache result if eligible (no complex post-processing)
    if (!needsPathPreservation && !hasColumnFilter) {
      cacheResult(lineageRequest, result);
    }

    return result;
  }

  /**
   * Internal method that uses strategy pattern for lineage execution.
   * Estimates graph size and selects appropriate strategy.
   */
  private SearchLineageResult searchLineageWithStrategyInternal(SearchLineageRequest lineageRequest)
      throws IOException {
    try {
      return buildLineageGraphWithStrategy(lineageRequest);
    } catch (Exception e) {
      // Fallback to legacy implementation if strategy fails
      LOG.warn("Strategy-based lineage execution failed, falling back to legacy", e);
      return searchLineageInternal(lineageRequest);
    }
  }

  /**
   * Internal method to fetch lineage without path preservation logic.
   * This is the original searchLineage implementation.
   */
  private SearchLineageResult searchLineageInternal(SearchLineageRequest lineageRequest)
      throws IOException {
    SearchLineageResult result =
        new SearchLineageResult()
            .withNodes(new HashMap<>())
            .withUpstreamEdges(new HashMap<>())
            .withDownstreamEdges(new HashMap<>());

    // First, fetch and add the root entity with proper paging counts
    addRootEntityWithPagingCounts(lineageRequest, result, false);

    // Then fetch upstream lineage if upstreamDepth > 0
    if (lineageRequest.getUpstreamDepth() > 0) {
      SearchLineageResult upstreamLineage =
          getUpstreamLineage(
              lineageRequest
                  .withDirection(LineageDirection.UPSTREAM)
                  .withDirectionValue(
                      getLineageDirection(
                          lineageRequest.getDirection(), lineageRequest.getIsConnectedVia())));
      // Merge upstream results, but preserve root entity paging counts
      String rootFqn = lineageRequest.getFqn();
      for (var entry : upstreamLineage.getNodes().entrySet()) {
        if (entry.getKey().equals(rootFqn)) {
          continue;
        }
        result.getNodes().putIfAbsent(entry.getKey(), entry.getValue());
      }
      result.getUpstreamEdges().putAll(upstreamLineage.getUpstreamEdges());
    }

    // Then fetch downstream lineage if downstreamDepth > 0
    if (lineageRequest.getDownstreamDepth() > 0) {
      SearchLineageResult downstreamLineage =
          getDownstreamLineage(
              lineageRequest
                  .withDirection(LineageDirection.DOWNSTREAM)
                  .withDirectionValue(
                      getLineageDirection(
                          lineageRequest.getDirection(), lineageRequest.getIsConnectedVia())));
      // Merge downstream results, but preserve root entity paging counts
      String rootFqn = lineageRequest.getFqn();
      for (var entry : downstreamLineage.getNodes().entrySet()) {
        if (entry.getKey().equals(rootFqn)) {
          continue;
        }
        result.getNodes().putIfAbsent(entry.getKey(), entry.getValue());
      }
      result.getDownstreamEdges().putAll(downstreamLineage.getDownstreamEdges());
    }

    return result;
  }

  public SearchLineageResult searchLineageWithDirection(SearchLineageRequest lineageRequest)
      throws IOException {
    // Check cache first (if no path preservation or column filters)
    boolean needsPathPreservation =
        Boolean.TRUE.equals(lineageRequest.getPreservePaths())
            && hasNodeLevelFilters(lineageRequest.getQueryFilter());
    boolean hasColumnFilter = !nullOrEmpty(lineageRequest.getColumnFilter());

    // Only use cache if no complex post-processing needed
    if (!needsPathPreservation && !hasColumnFilter) {
      java.util.Optional<SearchLineageResult> cached = checkCache(lineageRequest);
      if (cached.isPresent()) {
        LOG.debug("Cache hit for lineage query (directional): {}", lineageRequest.getFqn());
        return cached.get();
      }
    }

    SearchLineageResult result;

    if (needsPathPreservation) {
      // Fetch unfiltered lineage (only structural filters)
      SearchLineageRequest unfilteredRequest =
          JsonUtils.deepCopy(lineageRequest, SearchLineageRequest.class)
              .withQueryFilter(getStructuralFilterOnly(lineageRequest.getQueryFilter()));
      result = searchLineageWithDirectionAndStrategyInternal(unfilteredRequest);

      // Apply node-level filters in-memory with path preservation
      result = applyInMemoryFiltersWithPathPreservation(result, lineageRequest);
    } else {
      // Use strategy-based execution for optimal performance
      result = searchLineageWithDirectionAndStrategyInternal(lineageRequest);
    }

    // Apply column filters
    if (hasColumnFilter) {
      result = applyColumnFiltering(result, lineageRequest);
    }

    // Cache result if eligible (no complex post-processing)
    if (!needsPathPreservation && !hasColumnFilter) {
      cacheResult(lineageRequest, result);
    }

    return result;
  }

  /**
   * Internal method that uses strategy pattern for directional lineage execution.
   * Estimates graph size and selects appropriate strategy.
   */
  private SearchLineageResult searchLineageWithDirectionAndStrategyInternal(
      SearchLineageRequest lineageRequest) throws IOException {
    try {
      return buildLineageGraphWithStrategy(lineageRequest);
    } catch (Exception e) {
      // Fallback to legacy implementation if strategy fails
      LOG.warn("Strategy-based lineage execution failed, falling back to legacy", e);
      return searchLineageWithDirectionInternal(lineageRequest);
    }
  }

  /**
   * Internal method to fetch lineage with direction without path preservation logic.
   * This is the original searchLineageWithDirection implementation.
   */
  private SearchLineageResult searchLineageWithDirectionInternal(
      SearchLineageRequest lineageRequest) throws IOException {
    SearchLineageResult result =
        new SearchLineageResult()
            .withNodes(new HashMap<>())
            .withUpstreamEdges(new HashMap<>())
            .withDownstreamEdges(new HashMap<>());

    // First, fetch and add the root entity with proper paging counts
    addRootEntityWithPagingCounts(lineageRequest, result, true);

    // Based on direction, fetch only the requested lineage direction
    if (lineageRequest.getDirection() == null
        || lineageRequest.getDirection().equals(LineageDirection.UPSTREAM)) {
      if (lineageRequest.getUpstreamDepth() > 0) {
        SearchLineageResult upstreamLineage =
            getUpstreamLineage(
                lineageRequest
                    .withDirection(LineageDirection.UPSTREAM)
                    .withDirectionValue(
                        getLineageDirection(
                            lineageRequest.getDirection(), lineageRequest.getIsConnectedVia())));
        String rootFqn = lineageRequest.getFqn();
        for (var entry : upstreamLineage.getNodes().entrySet()) {
          if (entry.getKey().equals(rootFqn)) {
            continue;
          }
          result.getNodes().putIfAbsent(entry.getKey(), entry.getValue());
        }
        result.getUpstreamEdges().putAll(upstreamLineage.getUpstreamEdges());
      }
    } else {
      if (lineageRequest.getDownstreamDepth() > 0) {
        SearchLineageResult downstreamLineage =
            getDownstreamLineage(
                lineageRequest
                    .withDirection(LineageDirection.DOWNSTREAM)
                    .withDirectionValue(
                        getLineageDirection(
                            lineageRequest.getDirection(), lineageRequest.getIsConnectedVia())));
        String rootFqn = lineageRequest.getFqn();
        for (var entry : downstreamLineage.getNodes().entrySet()) {
          if (entry.getKey().equals(rootFqn)) {
            continue;
          }
          result.getNodes().putIfAbsent(entry.getKey(), entry.getValue());
        }
        result.getDownstreamEdges().putAll(downstreamLineage.getDownstreamEdges());
      }
    }

    return result;
  }

  private void addRootEntityWithPagingCounts(
      SearchLineageRequest lineageRequest, SearchLineageResult result, boolean isDirectionBased)
      throws IOException {
    Map<String, Object> rootEntityMap =
        OsUtils.searchEntityByKey(
            esClient,
            null,
            GLOBAL_SEARCH_ALIAS,
            FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD,
            Pair.of(FullyQualifiedName.buildHash(lineageRequest.getFqn()), lineageRequest.getFqn()),
            SOURCE_FIELDS_TO_EXCLUDE);

    if (!rootEntityMap.isEmpty()) {
      String rootFqn = rootEntityMap.get(FQN_FIELD).toString();
      List<EsLineageData> upstreamEntities = getUpstreamLineageListIfExist(rootEntityMap);

      Integer upstreamCount = null;
      if (isDirectionBased && lineageRequest.getDirection().equals(LineageDirection.UPSTREAM)) {
        upstreamCount = upstreamEntities.size();
      }

      Integer downstreamCount = null;
      if (isDirectionBased && lineageRequest.getDirection().equals(LineageDirection.DOWNSTREAM)) {
        downstreamCount = countDownstreamEntities(lineageRequest.getFqn(), lineageRequest);
      }

      NodeInformation rootNode =
          getNodeInformation(rootEntityMap, downstreamCount, upstreamCount, 0);

      result.getNodes().put(rootFqn, rootNode);
    }
  }

  private int countDownstreamEntities(String fqn, SearchLineageRequest lineageRequest)
      throws IOException {
    Map<String, String> hasToFqnMap = Map.of(FullyQualifiedName.buildHash(fqn), fqn);
    Map<String, Set<String>> directionKeyAndValues =
        buildDirectionToFqnSet(
            getLineageDirection(LineageDirection.DOWNSTREAM, lineageRequest.getIsConnectedVia()),
            hasToFqnMap.keySet());

    SearchRequest searchRequest =
        getSearchRequest(
            LineageDirection.DOWNSTREAM,
            GLOBAL_SEARCH_ALIAS,
            lineageRequest.getQueryFilter(),
            GRAPH_AGGREGATION,
            directionKeyAndValues,
            0,
            0, // size = 0 since we only need count
            lineageRequest.getIncludeDeleted(),
            lineageRequest.getIncludeSourceFields().stream().toList(),
            SOURCE_FIELDS_TO_EXCLUDE);

    SearchResponse<JsonData> response = esClient.search(searchRequest, JsonData.class);

    // Get count from aggregation like in fetchDownstreamNodesRecursively
    StringTermsAggregate valueCountAgg =
        response.aggregations() != null && response.aggregations().get(GRAPH_AGGREGATION) != null
            ? response.aggregations().get(GRAPH_AGGREGATION).sterms()
            : null;

    if (valueCountAgg != null) {
      for (StringTermsBucket bucket : valueCountAgg.buckets().array()) {
        String fqnFromHash = hasToFqnMap.get(bucket.key());
        if (fqnFromHash != null && fqnFromHash.equals(fqn)) {
          return (int) bucket.docCount();
        }
      }
    }

    return 0;
  }

  public LineagePaginationInfo getLineagePaginationInfo(
      String fqn,
      int upstreamDepth,
      int downstreamDepth,
      String queryFilter,
      boolean includeDeleted,
      String entityType)
      throws IOException {

    Map<Integer, Integer> upstreamDepthCounts = new HashMap<>();
    Map<Integer, Integer> downstreamDepthCounts = new HashMap<>();
    upstreamDepthCounts.put(0, 1);
    downstreamDepthCounts.put(0, 1);

    // Get upstream pagination info
    if (upstreamDepth > 0) {
      upstreamDepthCounts.putAll(
          getDepthWiseEntityCounts(
              fqn,
              LineageDirection.UPSTREAM,
              upstreamDepth,
              queryFilter,
              includeDeleted,
              entityType));
    }

    // Get downstream pagination info
    if (downstreamDepth > 0) {
      downstreamDepthCounts.putAll(
          getDepthWiseEntityCounts(
              fqn,
              LineageDirection.DOWNSTREAM,
              downstreamDepth,
              queryFilter,
              includeDeleted,
              entityType));
    }

    // Build pagination info response
    LineagePaginationInfo paginationInfo = new LineagePaginationInfo();

    // Calculate totals
    int totalUpstream = upstreamDepthCounts.values().stream().mapToInt(Integer::intValue).sum();
    int totalDownstream = downstreamDepthCounts.values().stream().mapToInt(Integer::intValue).sum();

    paginationInfo.setTotalUpstreamEntities(totalUpstream);
    paginationInfo.setTotalDownstreamEntities(totalDownstream);

    // Set max depths
    paginationInfo.setMaxUpstreamDepth(
        upstreamDepthCounts.keySet().stream().mapToInt(i -> i).max().orElse(0));
    paginationInfo.setMaxDownstreamDepth(
        downstreamDepthCounts.keySet().stream().mapToInt(i -> i).max().orElse(0));

    // Convert to depth info arrays
    List<DepthInfo> upstreamDepthInfo = new ArrayList<>();
    for (Map.Entry<Integer, Integer> entry : upstreamDepthCounts.entrySet()) {
      DepthInfo depthInfo = new DepthInfo();
      depthInfo.setDepth(entry.getKey());
      depthInfo.setEntityCount(entry.getValue());
      upstreamDepthInfo.add(depthInfo);
    }

    List<DepthInfo> downstreamDepthInfo = new ArrayList<>();
    for (Map.Entry<Integer, Integer> entry : downstreamDepthCounts.entrySet()) {
      DepthInfo depthInfo = new DepthInfo();
      depthInfo.setDepth(entry.getKey());
      depthInfo.setEntityCount(entry.getValue());
      downstreamDepthInfo.add(depthInfo);
    }

    paginationInfo.setUpstreamDepthInfo(upstreamDepthInfo);
    paginationInfo.setDownstreamDepthInfo(downstreamDepthInfo);

    return paginationInfo;
  }

  public SearchLineageResult searchLineageByEntityCount(EntityCountLineageRequest request)
      throws IOException {
    // Check for column filtering requirements
    boolean hasColumnFilter = !nullOrEmpty(request.getColumnFilter());

    // Check cache if no column filtering needed
    if (!hasColumnFilter) {
      java.util.Optional<SearchLineageResult> cached = checkEntityCountCache(request);
      if (cached.isPresent()) {
        LOG.debug(
            "Cache hit for entity count lineage query: {}, depth={}",
            request.getFqn(),
            request.getNodeDepth());
        return cached.get();
      }
    }

    // Execute standard entity count query
    SearchLineageResult result = searchLineageByEntityCountInternal(request);

    // Apply column filters if needed
    if (hasColumnFilter) {
      result = applyColumnFiltering(result, convertToSearchLineageRequest(request));
    }

    // Cache result if eligible (no column filtering)
    if (!hasColumnFilter) {
      cacheEntityCountResult(request, result);
    }

    return result;
  }

  private SearchLineageResult searchLineageByEntityCountInternal(EntityCountLineageRequest request)
      throws IOException {
    SearchLineageResult result =
        new SearchLineageResult()
            .withNodes(new HashMap<>())
            .withUpstreamEdges(new HashMap<>())
            .withDownstreamEdges(new HashMap<>());

    // Handle root entity (nodeDepth = 0)
    addRootEntityWithPagingCounts(
        new SearchLineageRequest()
            .withFqn(request.getFqn())
            .withQueryFilter(request.getQueryFilter())
            .withIncludeDeleted(request.getIncludeDeleted())
            .withIsConnectedVia(request.getIsConnectedVia())
            .withIncludeSourceFields(request.getIncludeSourceFields()),
        result,
        false);
    // If nodeDepth is specifically 0, return just root entity
    if (request.getNodeDepth() != null && request.getNodeDepth() == 0) {
      return result;
    }

    // Filter by specific node depth if provided
    if (request.getNodeDepth() != null) {
      // Directly fetch entities at specific depth with pagination
      getEntitiesAtSpecificDepthWithPagination(result, request);
    } else {
      // Get all entities up to maxDepth and paginate
      Map<Integer, List<String>> entitiesByDepth =
          getAllEntitiesByDepth(
              request.getFqn(),
              request.getDirection(),
              request.getMaxDepth(),
              request.getQueryFilter(),
              request.getIncludeDeleted(),
              request.getIncludeSourceFields());

      // Paginate across all depths
      List<String> allEntities = new ArrayList<>();
      for (int depth = 1; depth <= request.getMaxDepth(); depth++) {
        allEntities.addAll(entitiesByDepth.getOrDefault(depth, new ArrayList<>()));
      }
      List<String> paginatedEntities =
          paginateList(allEntities, request.getFrom(), request.getSize());
      addEntitiesAcrossDepths(result, paginatedEntities, entitiesByDepth, request);
    }

    return result;
  }

  private SearchLineageRequest convertToSearchLineageRequest(EntityCountLineageRequest request) {
    // Convert EntityCountLineageRequest to SearchLineageRequest for filter application
    return new SearchLineageRequest()
        .withFqn(request.getFqn())
        .withUpstreamDepth(
            request.getDirection() == LineageDirection.UPSTREAM ? request.getMaxDepth() : 0)
        .withDownstreamDepth(
            request.getDirection() == LineageDirection.DOWNSTREAM ? request.getMaxDepth() : 0)
        .withQueryFilter(request.getQueryFilter())
        .withColumnFilter(request.getColumnFilter())
        .withPreservePaths(request.getPreservePaths())
        .withIncludeDeleted(request.getIncludeDeleted())
        .withIsConnectedVia(request.getIsConnectedVia())
        .withIncludeSourceFields(request.getIncludeSourceFields());
  }

  private java.util.Optional<SearchLineageResult> checkEntityCountCache(
      EntityCountLineageRequest request) {
    if (!config.isEnableCaching()) {
      return java.util.Optional.empty();
    }

    // Create cache key from EntityCountLineageRequest
    org.openmetadata.service.search.lineage.LineageCacheKey cacheKey =
        new org.openmetadata.service.search.lineage.LineageCacheKey(
            request.getFqn() != null ? request.getFqn() : "",
            request.getDirection() == LineageDirection.UPSTREAM ? request.getMaxDepth() : 0,
            request.getDirection() == LineageDirection.DOWNSTREAM ? request.getMaxDepth() : 0,
            request.getQueryFilter() != null ? request.getQueryFilter() : "",
            request.getColumnFilter() != null ? request.getColumnFilter() : "",
            request.getPreservePaths() != null ? request.getPreservePaths() : Boolean.FALSE,
            request.getDirection() != null ? request.getDirection().value() : "",
            request.getIsConnectedVia() != null ? request.getIsConnectedVia() : Boolean.FALSE);

    return cache.get(cacheKey);
  }

  private void cacheEntityCountResult(
      EntityCountLineageRequest request, SearchLineageResult result) {
    if (!config.isEnableCaching()) {
      return;
    }

    int nodeCount = result.getNodes() != null ? result.getNodes().size() : 0;
    if (!config.shouldCacheGraph(nodeCount)) {
      LOG.debug(
          "Skipping cache for entity count query (too large): {} nodes for '{}'",
          nodeCount,
          request.getFqn());
      return;
    }

    // Create cache key
    org.openmetadata.service.search.lineage.LineageCacheKey cacheKey =
        new org.openmetadata.service.search.lineage.LineageCacheKey(
            request.getFqn() != null ? request.getFqn() : "",
            request.getDirection() == LineageDirection.UPSTREAM ? request.getMaxDepth() : 0,
            request.getDirection() == LineageDirection.DOWNSTREAM ? request.getMaxDepth() : 0,
            request.getQueryFilter() != null ? request.getQueryFilter() : "",
            request.getColumnFilter() != null ? request.getColumnFilter() : "",
            request.getPreservePaths() != null ? request.getPreservePaths() : Boolean.FALSE,
            request.getDirection() != null ? request.getDirection().value() : "",
            request.getIsConnectedVia() != null ? request.getIsConnectedVia() : Boolean.FALSE);

    cache.put(cacheKey, result);
    LOG.debug("Cached entity count result: {} nodes for '{}'", nodeCount, request.getFqn());
  }

  private Map<Integer, Integer> getDepthWiseEntityCounts(
      String fqn,
      LineageDirection direction,
      int maxDepth,
      String queryFilter,
      boolean includeDeleted,
      String entityType)
      throws IOException {

    int startingOffset = direction.equals(LineageDirection.UPSTREAM) ? 0 : 1;
    Set<String> visitedFqns = new HashSet<>();
    visitedFqns.add(fqn);

    Map<Integer, Integer> depthCounts = new LinkedHashMap<>();
    Map<String, String> currentLevel = Map.of(FullyQualifiedName.buildHash(fqn), fqn);

    for (int depth = startingOffset; depth < maxDepth; depth++) {
      if (currentLevel.isEmpty()) break;
      visitedFqns.addAll(currentLevel.values());

      Map<String, Set<String>> directionKeyAndValues =
          buildDirectionToFqnSet(
              getLineageDirection(direction, isConnectedVia(entityType)), currentLevel.keySet());

      SearchRequest searchRequest =
          getSearchRequest(
              direction,
              GLOBAL_SEARCH_ALIAS,
              depth == 0 ? null : queryFilter,
              GRAPH_AGGREGATION,
              directionKeyAndValues,
              0,
              10000,
              includeDeleted,
              List.of("id", "fullyQualifiedName", "entityType", "upstreamLineage"),
              SOURCE_FIELDS_TO_EXCLUDE);

      SearchResponse<JsonData> searchResponse = esClient.search(searchRequest, JsonData.class);

      Map<String, String> nextLevel = new HashMap<>();
      int countAtDepth = (int) searchResponse.hits().total().value();

      for (Hit<JsonData> hit : searchResponse.hits().hits()) {
        if (hit.source() != null) {
          Map<String, Object> esDoc = OsUtils.jsonDataToMap(hit.source());
          if (!esDoc.isEmpty()) {
            String entityFqn = esDoc.get(FQN_FIELD).toString();
            if (direction.equals(LineageDirection.DOWNSTREAM)) {
              if (!visitedFqns.contains(entityFqn)) {
                nextLevel.put(FullyQualifiedName.buildHash(entityFqn), entityFqn);
              }
            } else {
              List<EsLineageData> upStreamEntities = getUpstreamLineageListIfExist(esDoc);
              for (EsLineageData data : upStreamEntities) {
                String fromFqn = data.getFromEntity().getFullyQualifiedName();
                if (!visitedFqns.contains(fromFqn)) {
                  nextLevel.put(FullyQualifiedName.buildHash(fromFqn), fromFqn);
                }
              }
            }
          }
        }
      }

      if (countAtDepth == 0 && nextLevel.isEmpty()) {
        // No more downstream entities found, break the loop
        break;
      }
      depthCounts.put(depth, countAtDepth);
      currentLevel = nextLevel;
    }

    return depthCounts;
  }

  private Map<Integer, List<String>> getAllEntitiesByDepth(
      String fqn,
      LineageDirection direction,
      int maxDepth,
      String queryFilter,
      boolean includeDeleted,
      Set<String> includeSourceFields)
      throws IOException {
    Set<String> visitedFqns = new HashSet<>();
    visitedFqns.add(fqn);
    Map<Integer, List<String>> entitiesByDepth = new LinkedHashMap<>();
    Map<String, String> currentLevel = Map.of(FullyQualifiedName.buildHash(fqn), fqn);

    for (int depth = 1; depth <= maxDepth; depth++) {
      if (currentLevel.isEmpty()) break;
      visitedFqns.addAll(currentLevel.values());

      Map<String, Set<String>> directionKeyAndValues =
          buildDirectionToFqnSet(getLineageDirection(direction, false), currentLevel.keySet());

      SearchRequest searchRequest =
          getSearchRequest(
              direction,
              GLOBAL_SEARCH_ALIAS,
              queryFilter,
              GRAPH_AGGREGATION,
              directionKeyAndValues,
              0,
              10000,
              includeDeleted,
              includeSourceFields.stream().toList(),
              SOURCE_FIELDS_TO_EXCLUDE);

      SearchResponse<JsonData> searchResponse = esClient.search(searchRequest, JsonData.class);

      List<String> entitiesAtDepth = new ArrayList<>();
      Map<String, String> nextLevel = new HashMap<>();

      for (Hit<JsonData> hit : searchResponse.hits().hits()) {
        if (hit.source() != null) {
          Map<String, Object> esDoc = OsUtils.jsonDataToMap(hit.source());
          if (!esDoc.isEmpty()) {
            String entityFqn = esDoc.get(FQN_FIELD).toString();
            entitiesAtDepth.add(entityFqn);
            if (!visitedFqns.contains(entityFqn)) {
              nextLevel.put(FullyQualifiedName.buildHash(entityFqn), entityFqn);
            }
          }
        }
      }

      entitiesByDepth.put(depth, entitiesAtDepth);
      currentLevel = nextLevel;
    }

    return entitiesByDepth;
  }

  private void addEntitiesAcrossDepths(
      SearchLineageResult result,
      List<String> entityFqns,
      Map<Integer, List<String>> entitiesByDepth,
      EntityCountLineageRequest request)
      throws IOException {
    // Create a set of all collected FQNs for edge filtering
    Set<String> allCollectedFqns = new HashSet<>(entityFqns);
    allCollectedFqns.add(request.getFqn()); // Add the root entity FQN as well

    for (String entityFqn : entityFqns) {
      Map<String, Object> entityDoc =
          OsUtils.searchEntityByKey(
              esClient,
              null,
              GLOBAL_SEARCH_ALIAS,
              FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD,
              Pair.of(FullyQualifiedName.buildHash(entityFqn), entityFqn),
              SOURCE_FIELDS_TO_EXCLUDE);

      if (!entityDoc.isEmpty()) {
        // Find which depth this entity belongs to
        int nodeDepth = findEntityDepth(entityFqn, entitiesByDepth);
        if (request.getDirection() == LineageDirection.UPSTREAM) {
          nodeDepth = -nodeDepth; // Upstream depths are negative
        }

        result.getNodes().put(entityFqn, getNodeInformation(entityDoc, null, null, nodeDepth));

        // Add lineage edges
        addLineageEdges(result, entityDoc, request, allCollectedFqns);
      }
    }
  }

  private int findEntityDepth(String entityFqn, Map<Integer, List<String>> entitiesByDepth) {
    for (Map.Entry<Integer, List<String>> entry : entitiesByDepth.entrySet()) {
      if (entry.getValue().contains(entityFqn)) {
        return entry.getKey();
      }
    }
    return 1; // Default depth
  }

  private void addLineageEdges(
      SearchLineageResult result,
      Map<String, Object> entityDoc,
      EntityCountLineageRequest request,
      Set<String> allCollectedFqns) {
    RelationshipRef currentEntity = getRelationshipRef(entityDoc);
    List<EsLineageData> upstreamEntities = getUpstreamLineageListIfExist(entityDoc);

    if (request.getDirection() == LineageDirection.UPSTREAM) {
      // Add upstream edges - current entity depends on these upstream entities
      for (EsLineageData data : upstreamEntities) {
        // Only add edge if the upstream entity is in our collected set
        if (allCollectedFqns.contains(data.getFromEntity().getFullyQualifiedName())) {
          result.getUpstreamEdges().putIfAbsent(data.getDocId(), data.withToEntity(currentEntity));
        }
      }
    } else if (request.getDirection() == LineageDirection.DOWNSTREAM) {
      // Add downstream edges - entities that depend on our root entity
      for (EsLineageData upstreamData : upstreamEntities) {
        String rootFqnHash = FullyQualifiedName.buildHash(request.getFqn());
        if (upstreamData.getFromEntity().getFqnHash().equals(rootFqnHash)) {
          result
              .getDownstreamEdges()
              .putIfAbsent(upstreamData.getDocId(), upstreamData.withToEntity(currentEntity));
        }
      }
    }
  }

  private static class EntityData {
    final String fqn;
    final int depth;
    final Map<String, Object> document;

    EntityData(String fqn, int depth, Map<String, Object> document) {
      this.fqn = fqn;
      this.depth = depth;
      this.document = document;
    }
  }

  private void getEntitiesAtSpecificDepthWithPagination(
      SearchLineageResult result, EntityCountLineageRequest request) throws IOException {
    int startingOffset = request.getDirection().equals(LineageDirection.UPSTREAM) ? 0 : 1;
    int targetDepth = request.getNodeDepth();
    Map<String, String> currentLevel =
        Map.of(FullyQualifiedName.buildHash(request.getFqn()), request.getFqn());
    Set<String> visitedFqns = new HashSet<>();
    visitedFqns.add(request.getFqn());

    Map<String, EntityData> allEntitiesUpToDepth = new LinkedHashMap<>();
    if (result.getNodes().containsKey(request.getFqn())) {
      allEntitiesUpToDepth.put(
          request.getFqn(),
          new EntityData(
              request.getFqn(),
              0,
              JsonUtils.getMap(result.getNodes().get(request.getFqn()).getEntity())));
    }

    // Traverse up to the target depth and collect all entities
    for (int depth = startingOffset; depth <= targetDepth; depth++) {
      if (currentLevel.isEmpty()) break;
      visitedFqns.addAll(currentLevel.values());

      Map<String, Set<String>> directionKeyAndValues =
          buildDirectionToFqnSet(
              getLineageDirection(request.getDirection(), false), currentLevel.keySet());

      SearchRequest searchRequest =
          getSearchRequest(
              request.getDirection(),
              GLOBAL_SEARCH_ALIAS,
              depth == 0 ? null : request.getQueryFilter(),
              GRAPH_AGGREGATION,
              directionKeyAndValues,
              0,
              10000,
              request.getIncludeDeleted(),
              request.getIncludeSourceFields().stream().toList(),
              SOURCE_FIELDS_TO_EXCLUDE);

      SearchResponse<JsonData> searchResponse = esClient.search(searchRequest, JsonData.class);
      Map<String, String> nextLevel = new HashMap<>();

      for (Hit<JsonData> hit : searchResponse.hits().hits()) {
        if (hit.source() != null) {
          Map<String, Object> esDoc = OsUtils.jsonDataToMap(hit.source());
          if (!esDoc.isEmpty()) {
            String entityFqn = esDoc.get(FQN_FIELD).toString();
            allEntitiesUpToDepth.put(entityFqn, new EntityData(entityFqn, depth, esDoc));
            if (request.getDirection().equals(LineageDirection.DOWNSTREAM)) {
              if (depth < targetDepth && !visitedFqns.contains(entityFqn)) {
                nextLevel.put(FullyQualifiedName.buildHash(entityFqn), entityFqn);
              }
            } else {
              List<EsLineageData> upStreamEntities = getUpstreamLineageListIfExist(esDoc);
              for (EsLineageData data : upStreamEntities) {
                String fromFqn = data.getFromEntity().getFullyQualifiedName();
                if (depth < targetDepth && !visitedFqns.contains(fromFqn)) {
                  nextLevel.put(FullyQualifiedName.buildHash(fromFqn), fromFqn);
                }
              }
            }
          }
        }
      }

      currentLevel = nextLevel;
    }

    // Apply pagination to all collected entities
    List<EntityData> allEntitiesUpToDepthList = new ArrayList<>(allEntitiesUpToDepth.values());
    List<EntityData> paginatedEntities =
        paginateList(allEntitiesUpToDepthList, request.getFrom(), request.getSize());

    // Create a set of all collected FQNs for edge filtering
    Set<String> allCollectedFqns = new HashSet<>();
    for (EntityData entityData : allEntitiesUpToDepthList) {
      allCollectedFqns.add(entityData.fqn);
    }
    // Add the root entity FQN as well
    allCollectedFqns.add(request.getFqn());

    // Add paginated entities to result
    for (EntityData entityData : paginatedEntities) {
      int entityDepth = entityData.depth;
      if (request.getDirection() == LineageDirection.UPSTREAM) {
        entityDepth = -entityDepth;
      }

      result
          .getNodes()
          .put(entityData.fqn, getNodeInformation(entityData.document, null, null, entityDepth));

      addLineageEdges(result, entityData.document, request, allCollectedFqns);
    }
  }

  /**
   * Separates structural filters (deleted, etc.) from node filters (owner, tags, etc.)
   * for path-preserving filter logic.
   */
  private String getStructuralFilterOnly(String queryFilter) {
    // For now, structural filters are limited to 'deleted' field
    // Node-level filters will be applied in post-processing
    if (nullOrEmpty(queryFilter)) {
      return null;
    }

    // If query contains only structural filters, return as-is
    // Otherwise, return null to fetch unfiltered and apply filters later
    if (queryFilter.contains("deleted")
        && !queryFilter.contains("owner")
        && !queryFilter.contains("tag")
        && !queryFilter.contains("domain")
        && !queryFilter.contains("service")) {
      return queryFilter;
    }

    return null;
  }

  /**
   * Checks if the query filter contains node-level filters that require path preservation.
   */
  private boolean hasNodeLevelFilters(String queryFilter) {
    if (nullOrEmpty(queryFilter)) {
      return false;
    }

    // Common node-level filter fields
    return queryFilter.contains("owner")
        || queryFilter.contains("tag")
        || queryFilter.contains("domain")
        || queryFilter.contains("service")
        || queryFilter.contains("tier")
        || queryFilter.contains("displayName")
        || queryFilter.contains("description");
  }

  /**
   * Applies column filtering with metadata support (tags, glossary terms).
   * Checks if the filter requires metadata and loads column metadata from parent entities if needed.
   */
  private SearchLineageResult applyColumnFiltering(
      SearchLineageResult result, SearchLineageRequest request) throws IOException {
    if (result == null || nullOrEmpty(request.getColumnFilter())) {
      return result;
    }

    // Check if filter requires metadata (tag/glossary)
    if (requiresMetadataFilter(request.getColumnFilter())) {
      // Extract all column FQNs from edges
      Set<String> columnFqns = extractAllColumnFqns(result);

      if (!columnFqns.isEmpty()) {
        // Load column metadata from parent entities
        ColumnMetadataCache cache = new ColumnMetadataCache();
        cache.loadColumnMetadata(columnFqns, this::fetchEntityDocument);

        // Apply filtering with metadata
        return LineagePathPreserver.filterByColumnsWithMetadata(
            result, request.getColumnFilter(), request.getFqn(), cache);
      }
    }

    // Fall back to name-only filtering
    return LineagePathPreserver.filterByColumns(
        result, request.getColumnFilter(), request.getFqn());
  }

  /**
   * Checks if column filter requires metadata (tags, glossary terms).
   */
  private boolean requiresMetadataFilter(String columnFilter) {
    if (nullOrEmpty(columnFilter)) {
      return false;
    }

    String lowerFilter = columnFilter.toLowerCase();
    return lowerFilter.contains("tag:") || lowerFilter.contains("glossary:");
  }

  /**
   * Extracts all column FQNs from lineage edges for metadata loading.
   */
  private Set<String> extractAllColumnFqns(SearchLineageResult result) {
    Set<String> columnFqns = new HashSet<>();

    if (result.getUpstreamEdges() != null) {
      result
          .getUpstreamEdges()
          .values()
          .forEach(edge -> columnFqns.addAll(ColumnFilterMatcher.extractColumnFqns(edge)));
    }

    if (result.getDownstreamEdges() != null) {
      result
          .getDownstreamEdges()
          .values()
          .forEach(edge -> columnFqns.addAll(ColumnFilterMatcher.extractColumnFqns(edge)));
    }

    return columnFqns;
  }

  /**
   * Fetches entity document from OpenSearch by FQN.
   * Used as EntityDocumentFetcher for ColumnMetadataCache.
   */
  private Map<String, Object> fetchEntityDocument(String fqn) throws IOException {
    return OsUtils.searchEntityByKey(
        esClient,
        null,
        GLOBAL_SEARCH_ALIAS,
        FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD,
        Pair.of(FullyQualifiedName.buildHash(fqn), fqn),
        SOURCE_FIELDS_TO_EXCLUDE);
  }

  /**
   * Implements LineageGraphExecutor interface.
   * Executes lineage query with in-memory graph building.
   */
  @Override
  public SearchLineageResult executeInMemory(
      org.openmetadata.service.search.lineage.LineageQueryContext context, int batchSize)
      throws IOException {
    // Delegate to the legacy/internal implementation to avoid circular calls
    return searchLineageInternal(context.getRequest());
  }

  /**
   * Implements LineageGraphExecutor interface.
   * Estimates graph size using sampling and fanout calculation.
   */
  @Override
  public int estimateGraphSize(org.openmetadata.service.search.lineage.LineageQueryContext context)
      throws IOException {
    SearchLineageRequest request = context.getRequest();

    // Start with root node
    int estimatedNodes = 1;

    try {
      // Sample upstream direction
      if (request.getUpstreamDepth() != null && request.getUpstreamDepth() > 0) {
        int upstreamFanout = estimateFanout(request.getFqn(), LineageDirection.UPSTREAM);
        estimatedNodes += calculateGeometricProgression(upstreamFanout, request.getUpstreamDepth());
      }

      // Sample downstream direction
      if (request.getDownstreamDepth() != null && request.getDownstreamDepth() > 0) {
        int downstreamFanout = estimateFanout(request.getFqn(), LineageDirection.DOWNSTREAM);
        estimatedNodes +=
            calculateGeometricProgression(downstreamFanout, request.getDownstreamDepth());
      }

      LOG.debug(
          "Estimated {} nodes for lineage query: fqn={}, upDepth={}, downDepth={}",
          estimatedNodes,
          request.getFqn(),
          request.getUpstreamDepth(),
          request.getDownstreamDepth());

      return estimatedNodes;
    } catch (Exception e) {
      LOG.warn("Failed to estimate graph size, using conservative estimate", e);
      return config.getSmallGraphThreshold() - 1;
    }
  }

  /**
   * Estimates fanout (number of connected nodes) in given direction for a single entity.
   */
  private int estimateFanout(String fqn, LineageDirection direction) throws IOException {
    Map<String, String> hasToFqnMap = Map.of(FullyQualifiedName.buildHash(fqn), fqn);
    Map<String, Set<String>> directionKeyAndValues =
        buildDirectionToFqnSet(getLineageDirection(direction, false), hasToFqnMap.keySet());

    SearchRequest searchRequest =
        getSearchRequest(
            direction,
            GLOBAL_SEARCH_ALIAS,
            null, // No filter for estimation
            GRAPH_AGGREGATION,
            directionKeyAndValues,
            0,
            0, // Size 0 - we only need count
            false, // Don't include deleted
            List.of(),
            SOURCE_FIELDS_TO_EXCLUDE);

    SearchResponse<JsonData> response = esClient.search(searchRequest, JsonData.class);

    // Get count from aggregation
    StringTermsAggregate valueCountAgg =
        response.aggregations() != null && response.aggregations().get(GRAPH_AGGREGATION) != null
            ? response.aggregations().get(GRAPH_AGGREGATION).sterms()
            : null;

    if (valueCountAgg != null) {
      for (StringTermsBucket bucket : valueCountAgg.buckets().array()) {
        if (bucket.key().equals(FullyQualifiedName.buildHash(fqn))) {
          return (int) bucket.docCount();
        }
      }
    }

    // Fallback: use hit count
    return (int) response.hits().total().value();
  }

  /**
   * Calculates geometric progression for graph size estimation.
   * Formula: sum of fanout^i for i=1 to depth
   */
  private int calculateGeometricProgression(int fanout, int depth) {
    if (fanout == 0 || depth == 0) {
      return 0;
    }

    // For fanout=1, it's linear
    if (fanout == 1) {
      return depth;
    }

    // Cap fanout at reasonable limit to prevent overflow
    int cappedFanout = Math.min(fanout, 10);

    // Calculate: fanout + fanout^2 + ... + fanout^depth
    int total = 0;
    int power = cappedFanout;

    for (int i = 1; i <= depth; i++) {
      total += power;

      // Cap total to prevent overflow
      if (total > config.getMaxInMemoryNodes()) {
        return config.getMaxInMemoryNodes() + 1000; // Return value > max to trigger streaming
      }

      if (i < depth) {
        power *= cappedFanout;
      }
    }

    return total;
  }

  @Override
  public SearchLineageResult executeWithScroll(
      org.openmetadata.service.search.lineage.LineageQueryContext context, int batchSize)
      throws IOException {
    LOG.info(
        "Executing lineage query with scroll API: root={}, batchSize={}",
        context.getRequest().getFqn(),
        batchSize);

    SearchLineageRequest request = context.getRequest();
    org.openmetadata.service.search.lineage.LineageProgressTracker tracker =
        context.getProgressTracker();

    if (tracker != null) {
      tracker.start(request.getFqn(), context.getEstimatedNodeCount());
    }

    long startTime = System.currentTimeMillis();

    try {
      // Use the internal implementation to avoid circular calls
      // The actual scroll API integration will be added when needed for very large graphs
      // This provides a hook for future scroll-based optimization
      SearchLineageResult result = searchLineageInternal(request);

      if (tracker != null) {
        int actualNodes = result.getNodes() != null ? result.getNodes().size() : 0;
        long duration = System.currentTimeMillis() - startTime;
        tracker.complete(request.getFqn(), actualNodes, duration);
      }

      LOG.info(
          "Completed lineage query with scroll API: root={}, nodes={}, duration={}ms",
          request.getFqn(),
          result.getNodes() != null ? result.getNodes().size() : 0,
          System.currentTimeMillis() - startTime);

      return result;
    } catch (Exception e) {
      if (tracker != null) {
        tracker.error(request.getFqn(), e);
      }
      throw e;
    }
  }
}
