package org.openmetadata.service.search.elasticsearch;

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
import static org.openmetadata.service.util.LineageUtil.getNodeInformation;

import com.nimbusds.jose.util.Pair;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.aggregations.StringTermsAggregate;
import es.co.elastic.clients.elasticsearch._types.aggregations.StringTermsBucket;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.elasticsearch.core.SearchResponse;
import es.co.elastic.clients.elasticsearch.core.search.Hit;
import es.co.elastic.clients.json.JsonData;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
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
import org.openmetadata.service.util.LineageUtil;

@Slf4j
public class ESLineageGraphBuilder
    extends org.openmetadata.service.search.lineage.AbstractLineageGraphBuilder {

  private static final List<String> COLUMN_METADATA_SOURCE_FIELDS =
      List.of(
          "fullyQualifiedName",
          "columns.name",
          "columns.fullyQualifiedName",
          "columns.tags.tagFQN",
          "columns.tags.source");

  private final ElasticsearchClient esClient;

  public ESLineageGraphBuilder(ElasticsearchClient esClient) {
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
        EsUtils.searchEntities(esClient, index, queryFilter, deleted);

    // Add Nodes
    searchResponse.hits().hits().stream()
        .map(
            hit ->
                hit.source() != null
                    ? collectionOrEmpty(EsUtils.jsonDataToMap(hit.source()))
                    : new HashMap<String, Object>())
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
        EsUtils.getSearchRequest(
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
        Map<String, Object> esDoc = EsUtils.jsonDataToMap(hit.source());
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
        EsUtils.getSearchRequest(
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
        String fqnFromHash = hasToFqnMap.get(bucket.key().stringValue());
        if (!nullOrEmpty(bucket.key().stringValue())
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
        Map<String, Object> entityMap = EsUtils.jsonDataToMap(hit.source());
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

    // Deep copy to avoid mutating the caller's request object
    SearchLineageRequest internalRequest =
        JsonUtils.deepCopy(lineageRequest, SearchLineageRequest.class);

    // Then fetch upstream lineage if upstreamDepth > 0
    if (internalRequest.getUpstreamDepth() > 0) {
      SearchLineageResult upstreamLineage =
          getUpstreamLineage(
              internalRequest
                  .withDirection(LineageDirection.UPSTREAM)
                  .withDirectionValue(
                      getLineageDirection(
                          LineageDirection.UPSTREAM, lineageRequest.getIsConnectedVia())));
      mergeNonRootNodes(upstreamLineage, result, lineageRequest.getFqn());
      result.getUpstreamEdges().putAll(upstreamLineage.getUpstreamEdges());
    }

    // Then fetch downstream lineage if downstreamDepth > 0
    if (internalRequest.getDownstreamDepth() > 0) {
      SearchLineageResult downstreamLineage =
          getDownstreamLineage(
              internalRequest
                  .withDirection(LineageDirection.DOWNSTREAM)
                  .withDirectionValue(
                      getLineageDirection(
                          LineageDirection.DOWNSTREAM, lineageRequest.getIsConnectedVia())));
      mergeNonRootNodes(downstreamLineage, result, lineageRequest.getFqn());
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

    // Deep copy to avoid mutating the caller's request object
    SearchLineageRequest internalRequest =
        JsonUtils.deepCopy(lineageRequest, SearchLineageRequest.class);

    // Based on direction, fetch only the requested lineage direction
    if (lineageRequest.getDirection() == null
        || lineageRequest.getDirection().equals(LineageDirection.UPSTREAM)) {
      if (lineageRequest.getUpstreamDepth() > 0) {
        SearchLineageResult upstreamLineage =
            getUpstreamLineage(
                internalRequest
                    .withDirection(LineageDirection.UPSTREAM)
                    .withDirectionValue(
                        getLineageDirection(
                            LineageDirection.UPSTREAM, lineageRequest.getIsConnectedVia())));
        mergeNonRootNodes(upstreamLineage, result, lineageRequest.getFqn());
        result.getUpstreamEdges().putAll(upstreamLineage.getUpstreamEdges());
      }
    } else {
      if (lineageRequest.getDownstreamDepth() > 0) {
        SearchLineageResult downstreamLineage =
            getDownstreamLineage(
                internalRequest
                    .withDirection(LineageDirection.DOWNSTREAM)
                    .withDirectionValue(
                        getLineageDirection(
                            LineageDirection.DOWNSTREAM, lineageRequest.getIsConnectedVia())));
        mergeNonRootNodes(downstreamLineage, result, lineageRequest.getFqn());
        result.getDownstreamEdges().putAll(downstreamLineage.getDownstreamEdges());
      }
    }

    return result;
  }

  private void mergeNonRootNodes(
      SearchLineageResult source, SearchLineageResult target, String rootFqn) {
    for (var entry : source.getNodes().entrySet()) {
      if (!entry.getKey().equals(rootFqn)) {
        target.getNodes().putIfAbsent(entry.getKey(), entry.getValue());
      }
    }
  }

  private void addRootEntityWithPagingCounts(
      SearchLineageRequest lineageRequest, SearchLineageResult result, boolean isDirectionBased)
      throws IOException {
    Map<String, Object> rootEntityMap =
        EsUtils.searchEntityByKey(
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
        EsUtils.getSearchRequest(
            LineageDirection.DOWNSTREAM,
            GLOBAL_SEARCH_ALIAS,
            lineageRequest.getQueryFilter(),
            GRAPH_AGGREGATION,
            directionKeyAndValues,
            0,
            0,
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
        String fqnFromHash = hasToFqnMap.get(bucket.key().stringValue());
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

    boolean hasNodeFilter = hasNodeLevelFilters(queryFilter);
    String countFilter = getStructuralFilterOnly(queryFilter);

    if (hasNodeFilter) {
      if (upstreamDepth > 0) {
        upstreamDepthCounts.putAll(
            getFilteredDepthCounts(
                fqn,
                LineageDirection.UPSTREAM,
                upstreamDepth,
                queryFilter,
                countFilter,
                includeDeleted));
      }
      if (downstreamDepth > 0) {
        downstreamDepthCounts.putAll(
            getFilteredDepthCounts(
                fqn,
                LineageDirection.DOWNSTREAM,
                downstreamDepth,
                queryFilter,
                countFilter,
                includeDeleted));
      }
    } else {
      if (upstreamDepth > 0) {
        upstreamDepthCounts.putAll(
            getDepthWiseEntityCounts(
                fqn,
                LineageDirection.UPSTREAM,
                upstreamDepth,
                countFilter,
                includeDeleted,
                entityType));
      }
      if (downstreamDepth > 0) {
        downstreamDepthCounts.putAll(
            getDepthWiseEntityCounts(
                fqn,
                LineageDirection.DOWNSTREAM,
                downstreamDepth,
                countFilter,
                includeDeleted,
                entityType));
      }
    }

    return buildPaginationInfo(upstreamDepthCounts, downstreamDepthCounts);
  }

  private Map<Integer, Integer> getFilteredDepthCounts(
      String fqn,
      LineageDirection direction,
      int maxDepth,
      String queryFilter,
      String structuralFilter,
      boolean includeDeleted)
      throws IOException {
    Map<Integer, List<String>> entitiesByDepth =
        getAllEntitiesByDepth(fqn, direction, maxDepth, structuralFilter, includeDeleted, Set.of());

    Set<String> allFqnHashes = new HashSet<>();
    for (List<String> fqns : entitiesByDepth.values()) {
      for (String entityFqn : fqns) {
        allFqnHashes.add(FullyQualifiedName.buildHash(entityFqn));
      }
    }

    if (allFqnHashes.isEmpty()) {
      return new HashMap<>();
    }

    Map<String, Object> matchingDocs = fetchMatchingEntities(allFqnHashes, queryFilter);

    // Count matching entities per depth
    Map<Integer, Integer> depthCounts = new LinkedHashMap<>();
    for (Map.Entry<Integer, List<String>> entry : entitiesByDepth.entrySet()) {
      int depth = entry.getKey();
      int count = 0;
      for (String entityFqn : entry.getValue()) {
        if (matchingDocs.containsKey(entityFqn)) {
          count++;
        }
      }
      if (count > 0) {
        depthCounts.put(depth, count);
      }
    }

    return depthCounts;
  }

  public SearchLineageResult searchLineageByEntityCount(EntityCountLineageRequest request)
      throws IOException {
    boolean hasNodeLevelQueryFilter = hasNodeLevelFilters(request.getQueryFilter());
    boolean hasColumnFilter = !nullOrEmpty(request.getColumnFilter());

    if (!hasNodeLevelQueryFilter && !hasColumnFilter) {
      java.util.Optional<SearchLineageResult> cached = checkEntityCountCache(request);
      if (cached.isPresent()) {
        LOG.debug(
            "Cache hit for entity count lineage query: {}, depth={}",
            request.getFqn(),
            request.getNodeDepth());
        return cached.get();
      }
    }

    SearchLineageResult result;

    result = searchLineageByEntityCountInternal(request);

    if (hasColumnFilter) {
      result = applyColumnFiltering(result, convertToSearchLineageRequest(request));
    }

    if (!hasNodeLevelQueryFilter && !hasColumnFilter) {
      cacheEntityCountResult(request, result);
    }

    return result;
  }

  private SearchLineageResult searchLineageByEntityCountInternal(EntityCountLineageRequest request)
      throws IOException {
    boolean hasNodeLevelQueryFilter = hasNodeLevelFilters(request.getQueryFilter());
    String structuralQueryFilter = getStructuralFilterOnly(request.getQueryFilter());
    int traversalDepth = getTraversalDepth(request.getNodeDepth(), request.getMaxDepth());
    Map<Integer, Integer> currentDirectionDepthCounts = new LinkedHashMap<>();

    SearchLineageResult result =
        new SearchLineageResult()
            .withNodes(new HashMap<>())
            .withUpstreamEdges(new HashMap<>())
            .withDownstreamEdges(new HashMap<>());

    addRootEntityWithPagingCounts(
        new SearchLineageRequest()
            .withFqn(request.getFqn())
            .withQueryFilter(request.getQueryFilter())
            .withIncludeDeleted(request.getIncludeDeleted())
            .withIsConnectedVia(request.getIsConnectedVia())
            .withIncludeSourceFields(request.getIncludeSourceFields()),
        result,
        false);

    if (request.getNodeDepth() != null && request.getNodeDepth() == 0) {
      if (Boolean.TRUE.equals(request.getIncludePaginationInfo())) {
        result.setPaginationInfo(
            buildEntityCountPaginationInfo(
                request,
                hasNodeLevelQueryFilter,
                structuralQueryFilter,
                currentDirectionDepthCounts));
      }
      return result;
    }

    if (request.getNodeDepth() != null && !hasNodeLevelQueryFilter) {
      currentDirectionDepthCounts = getEntitiesAtSpecificDepthWithPagination(result, request);
    } else {
      // Only node-level filters require unfiltered traversal.
      Map<Integer, List<String>> entitiesByDepth =
          dedupeEntitiesByDepth(
              getAllEntitiesByDepth(
                  request.getFqn(),
                  request.getDirection(),
                  traversalDepth,
                  hasNodeLevelQueryFilter ? structuralQueryFilter : request.getQueryFilter(),
                  request.getIncludeDeleted(),
                  request.getIncludeSourceFields()));

      List<String> allEntities = new ArrayList<>();
      for (int depth = 1; depth <= traversalDepth; depth++) {
        allEntities.addAll(entitiesByDepth.getOrDefault(depth, new ArrayList<>()));
      }

      // Build reverse lookup once for O(1) depth resolution
      Map<String, Integer> depthByFqn = buildDepthLookup(entitiesByDepth);
      allEntities = sortEntityFqnsByDepthThenName(allEntities, depthByFqn);

      if (hasNodeLevelQueryFilter) {
        // ES-native: collect all FQN hashes, fetch only matching docs via ES postFilter
        Set<String> allFqnHashes = new HashSet<>();
        for (String entityFqn : allEntities) {
          allFqnHashes.add(FullyQualifiedName.buildHash(entityFqn));
        }

        if (!allFqnHashes.isEmpty()) {
          Map<String, Object> matchingDocs =
              fetchMatchingEntities(allFqnHashes, request.getQueryFilter());
          currentDirectionDepthCounts =
              countMatchingEntitiesByDepth(entitiesByDepth, matchingDocs.keySet());

          Set<String> allCollectedFqns = new HashSet<>(matchingDocs.keySet());
          allCollectedFqns.add(request.getFqn());

          for (Map.Entry<String, Object> entry : matchingDocs.entrySet()) {
            String entityFqn = entry.getKey();
            @SuppressWarnings("unchecked")
            Map<String, Object> entityDoc = (Map<String, Object>) entry.getValue();
            if (entityDoc != null && !entityDoc.isEmpty()) {
              int nodeDepth = depthByFqn.getOrDefault(entityFqn, 1);
              if (request.getDirection() == LineageDirection.UPSTREAM) {
                nodeDepth = -nodeDepth;
              }
              result
                  .getNodes()
                  .put(entityFqn, getNodeInformation(entityDoc, null, null, nodeDepth));
              addLineageEdges(result, entityDoc, request, allCollectedFqns);
            }
          }
        }
      } else {
        currentDirectionDepthCounts = toDepthCounts(entitiesByDepth);
        // No node-level filter: paginate first, then fetch docs for one page only
        List<String> paginatedEntities =
            paginateList(allEntities, request.getFrom(), request.getSize());
        addEntitiesAcrossDepths(result, paginatedEntities, entitiesByDepth, request);
      }
    }

    replaceTagsWithEntityLevelTags(result);

    if (Boolean.TRUE.equals(request.getIncludePaginationInfo())) {
      result.setPaginationInfo(
          buildEntityCountPaginationInfo(
              request,
              hasNodeLevelQueryFilter,
              structuralQueryFilter,
              currentDirectionDepthCounts));
    }

    if (hasNodeLevelQueryFilter) {
      return applyEntityCountPagination(result, request);
    }

    return result;
  }

  private Map<String, Object> fetchMatchingEntities(Set<String> fqnHashes, String queryFilter)
      throws IOException {
    Map<String, Object> allMatchingDocs = new HashMap<>();
    List<Set<String>> batches = new ArrayList<>();
    List<String> hashList = new ArrayList<>(fqnHashes);

    for (int i = 0; i < hashList.size(); i += 10000) {
      batches.add(new HashSet<>(hashList.subList(i, Math.min(i + 10000, hashList.size()))));
    }

    for (Set<String> batch : batches) {
      Map<String, Object> batchResult =
          EsUtils.searchEntitiesByKey(
              esClient,
              null,
              GLOBAL_SEARCH_ALIAS,
              FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD,
              batch,
              0,
              10000,
              SOURCE_FIELDS_TO_EXCLUDE,
              queryFilter);
      allMatchingDocs.putAll(batchResult);
    }

    return allMatchingDocs;
  }

  @SuppressWarnings("unchecked")
  private void replaceTagsWithEntityLevelTags(SearchLineageResult result) {
    List<Map<String, Object>> entityDocs = new ArrayList<>();
    for (NodeInformation node : result.getNodes().values()) {
      if (node.getEntity() instanceof Map) {
        entityDocs.add((Map<String, Object>) node.getEntity());
      }
    }
    LineageUtil.replaceWithEntityLevelTagsBatch(entityDocs);
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

    org.openmetadata.service.search.lineage.LineageCacheKey cacheKey =
        buildEntityCountCacheKey(request);

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

    org.openmetadata.service.search.lineage.LineageCacheKey cacheKey =
        buildEntityCountCacheKey(request);

    cache.put(cacheKey, result);
    LOG.debug("Cached entity count result: {} nodes for '{}'", nodeCount, request.getFqn());
  }

  private org.openmetadata.service.search.lineage.LineageCacheKey buildEntityCountCacheKey(
      EntityCountLineageRequest request) {
    return new org.openmetadata.service.search.lineage.LineageCacheKey(
        request.getFqn() != null ? request.getFqn() : "",
        request.getDirection() == LineageDirection.UPSTREAM ? request.getMaxDepth() : 0,
        request.getDirection() == LineageDirection.DOWNSTREAM ? request.getMaxDepth() : 0,
        request.getQueryFilter() != null ? request.getQueryFilter() : "",
        request.getColumnFilter() != null ? request.getColumnFilter() : "",
        request.getPreservePaths() != null ? request.getPreservePaths() : Boolean.FALSE,
        request.getDirection() != null ? request.getDirection().value() : "",
        request.getIsConnectedVia() != null ? request.getIsConnectedVia() : Boolean.FALSE,
        request.getFrom() != null ? request.getFrom() : 0,
        request.getSize() != null ? request.getSize() : 0,
        request.getNodeDepth() != null ? request.getNodeDepth() : 0,
        request.getIncludePaginationInfo() != null
            ? request.getIncludePaginationInfo()
            : Boolean.FALSE,
        request.getUpstreamDepth() != null ? request.getUpstreamDepth() : 0,
        request.getDownstreamDepth() != null ? request.getDownstreamDepth() : 0);
  }

  private Map<Integer, Integer> getDepthWiseEntityCounts(
      String fqn,
      LineageDirection direction,
      int maxDepth,
      String queryFilter,
      boolean includeDeleted,
      String entityType)
      throws IOException {
    return getDepthWiseEntityCounts(
        fqn, direction, maxDepth, queryFilter, includeDeleted, isConnectedVia(entityType));
  }

  private Map<Integer, Integer> getDepthWiseEntityCounts(
      String fqn,
      LineageDirection direction,
      int maxDepth,
      String queryFilter,
      boolean includeDeleted,
      boolean connectedVia)
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
              getLineageDirection(direction, connectedVia), currentLevel.keySet());

      SearchRequest searchRequest =
          EsUtils.getSearchRequest(
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
          Map<String, Object> esDoc = EsUtils.jsonDataToMap(hit.source());
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
          EsUtils.getSearchRequest(
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

      Set<String> entitiesAtDepth = new LinkedHashSet<>();
      Map<String, String> nextLevel = new HashMap<>();

      for (Hit<JsonData> hit : searchResponse.hits().hits()) {
        if (hit.source() != null) {
          Map<String, Object> esDoc = EsUtils.jsonDataToMap(hit.source());
          if (!esDoc.isEmpty()) {
            if (direction.equals(LineageDirection.DOWNSTREAM)) {
              String entityFqn = esDoc.get(FQN_FIELD).toString();
              entitiesAtDepth.add(entityFqn);
              if (!visitedFqns.contains(entityFqn)) {
                nextLevel.put(FullyQualifiedName.buildHash(entityFqn), entityFqn);
              }
            } else {
              List<EsLineageData> upstreamEntities = getUpstreamLineageListIfExist(esDoc);
              for (EsLineageData data : upstreamEntities) {
                if (data.getFromEntity() != null) {
                  String fromFqn = data.getFromEntity().getFullyQualifiedName();
                  entitiesAtDepth.add(fromFqn);
                  if (!visitedFqns.contains(fromFqn)) {
                    nextLevel.put(FullyQualifiedName.buildHash(fromFqn), fromFqn);
                  }
                }
              }
            }
          }
        }
      }

      entitiesByDepth.put(depth, new ArrayList<>(entitiesAtDepth));
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

    // Build reverse lookup map once: O(N) instead of O(D*N) per findEntityDepth call
    Map<String, Integer> depthByFqn = buildDepthLookup(entitiesByDepth);

    for (String entityFqn : entityFqns) {
      Map<String, Object> entityDoc =
          EsUtils.searchEntityByKey(
              esClient,
              null,
              GLOBAL_SEARCH_ALIAS,
              FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD,
              Pair.of(FullyQualifiedName.buildHash(entityFqn), entityFqn),
              SOURCE_FIELDS_TO_EXCLUDE);

      if (!entityDoc.isEmpty()) {
        int nodeDepth = depthByFqn.getOrDefault(entityFqn, 1);
        if (request.getDirection() == LineageDirection.UPSTREAM) {
          nodeDepth = -nodeDepth;
        }

        result.getNodes().put(entityFqn, getNodeInformation(entityDoc, null, null, nodeDepth));
        addLineageEdges(result, entityDoc, request, allCollectedFqns);
      }
    }
  }

  private static Map<String, Integer> buildDepthLookup(Map<Integer, List<String>> entitiesByDepth) {
    Map<String, Integer> depthByFqn = new HashMap<>();
    for (Map.Entry<Integer, List<String>> entry : entitiesByDepth.entrySet()) {
      for (String fqn : entry.getValue()) {
        depthByFqn.put(fqn, entry.getKey());
      }
    }
    return depthByFqn;
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
        if (data.getFromEntity() != null
            && allCollectedFqns.contains(data.getFromEntity().getFullyQualifiedName())) {
          result.getUpstreamEdges().putIfAbsent(data.getDocId(), data.withToEntity(currentEntity));
        }
      }
    } else if (request.getDirection() == LineageDirection.DOWNSTREAM) {
      // Add downstream edges - include edges from any collected entity, not just root
      for (EsLineageData upstreamData : upstreamEntities) {
        // Add edge if the fromEntity is in our collected set (root or intermediate nodes)
        if (upstreamData.getFromEntity() != null
            && allCollectedFqns.contains(upstreamData.getFromEntity().getFullyQualifiedName())) {
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

  private Map<Integer, Integer> getEntitiesAtSpecificDepthWithPagination(
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
          EsUtils.getSearchRequest(
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
          Map<String, Object> esDoc = EsUtils.jsonDataToMap(hit.source());
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
    List<EntityData> allEntitiesUpToDepthList =
        sortEntitiesByDepthThenName(
            new ArrayList<>(allEntitiesUpToDepth.values()),
            entityData -> entityData.depth,
            entityData -> entityData.fqn);
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

    Map<Integer, Integer> depthCounts = new LinkedHashMap<>();
    for (EntityData entityData : allEntitiesUpToDepthList) {
      if (entityData.depth > 0) {
        depthCounts.merge(entityData.depth, 1, Integer::sum);
      }
    }

    return depthCounts;
  }

  private LineagePaginationInfo buildEntityCountPaginationInfo(
      EntityCountLineageRequest request,
      boolean hasNodeLevelQueryFilter,
      String structuralQueryFilter,
      Map<Integer, Integer> currentDirectionDepthCounts)
      throws IOException {
    Map<Integer, Integer> upstreamDepthCounts = new LinkedHashMap<>();
    Map<Integer, Integer> downstreamDepthCounts = new LinkedHashMap<>();
    upstreamDepthCounts.put(0, 1);
    downstreamDepthCounts.put(0, 1);

    int upstreamDepth = getRequestedDepthForDirection(request, LineageDirection.UPSTREAM);
    int downstreamDepth = getRequestedDepthForDirection(request, LineageDirection.DOWNSTREAM);

    if (request.getDirection() == LineageDirection.UPSTREAM && upstreamDepth > 0) {
      upstreamDepthCounts.putAll(currentDirectionDepthCounts);
    } else if (upstreamDepth > 0) {
      upstreamDepthCounts.putAll(
          getEntityCountDepthCounts(
              request,
              LineageDirection.UPSTREAM,
              upstreamDepth,
              hasNodeLevelQueryFilter,
              structuralQueryFilter));
    }

    if (request.getDirection() == LineageDirection.DOWNSTREAM && downstreamDepth > 0) {
      downstreamDepthCounts.putAll(currentDirectionDepthCounts);
    } else if (downstreamDepth > 0) {
      downstreamDepthCounts.putAll(
          getEntityCountDepthCounts(
              request,
              LineageDirection.DOWNSTREAM,
              downstreamDepth,
              hasNodeLevelQueryFilter,
              structuralQueryFilter));
    }

    return buildPaginationInfo(upstreamDepthCounts, downstreamDepthCounts);
  }

  private Map<Integer, Integer> getEntityCountDepthCounts(
      EntityCountLineageRequest request,
      LineageDirection direction,
      int depth,
      boolean hasNodeLevelQueryFilter,
      String structuralQueryFilter)
      throws IOException {
    if (hasNodeLevelQueryFilter) {
      return getFilteredDepthCounts(
          request.getFqn(),
          direction,
          depth,
          request.getQueryFilter(),
          structuralQueryFilter,
          request.getIncludeDeleted());
    }

    return getDepthWiseEntityCounts(
        request.getFqn(),
        direction,
        depth,
        structuralQueryFilter,
        request.getIncludeDeleted(),
        Boolean.TRUE.equals(request.getIsConnectedVia()));
  }

  /**
   * Applies column filtering with metadata support (tags, glossary terms).
   * Checks if the filter requires metadata and loads column metadata from parent entities if needed.
   */
  private SearchLineageResult applyColumnFiltering(
      SearchLineageResult result, SearchLineageRequest request) {
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
        cache.loadColumnMetadata(columnFqns, this::fetchEntityDocuments, this::fetchEntityDocument);

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
   * Supports both ES query JSON format and legacy string format.
   */
  private boolean requiresMetadataFilter(String columnFilter) {
    return ColumnFilterMatcher.requiresMetadataForFilter(columnFilter);
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
   * Fetches entity document from ES by FQN.
   * Used as EntityDocumentFetcher for ColumnMetadataCache.
   */
  private Map<String, Object> fetchEntityDocument(String fqn) throws IOException {
    return EsUtils.searchEntityByKey(
        esClient,
        null,
        GLOBAL_SEARCH_ALIAS,
        FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD,
        Pair.of(FullyQualifiedName.buildHash(fqn), fqn),
        COLUMN_METADATA_SOURCE_FIELDS,
        SOURCE_FIELDS_TO_EXCLUDE);
  }

  private Map<String, Map<String, Object>> fetchEntityDocuments(Set<String> fqns)
      throws IOException {
    Map<String, Map<String, Object>> entityDocs = new HashMap<>();
    List<String> fqnList = new ArrayList<>(fqns);

    for (int index = 0; index < fqnList.size(); index += 1000) {
      List<String> batch = fqnList.subList(index, Math.min(index + 1000, fqnList.size()));
      Set<String> fqnHashes = new HashSet<>();
      for (String fqn : batch) {
        fqnHashes.add(FullyQualifiedName.buildHash(fqn));
      }

      Map<String, Object> batchResult =
          EsUtils.searchEntitiesByKey(
              esClient,
              null,
              GLOBAL_SEARCH_ALIAS,
              FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD,
              fqnHashes,
              0,
              batch.size(),
              COLUMN_METADATA_SOURCE_FIELDS,
              SOURCE_FIELDS_TO_EXCLUDE,
              null);
      for (Map.Entry<String, Object> entry : batchResult.entrySet()) {
        @SuppressWarnings("unchecked")
        Map<String, Object> entityDoc = (Map<String, Object>) entry.getValue();
        entityDocs.put(entry.getKey(), entityDoc);
      }
    }

    return entityDocs;
  }

  /**
   * Implements LineageGraphExecutor interface.
   * Executes lineage query with in-memory graph building.
   */
  @Override
  public SearchLineageResult executeInMemory(
      org.openmetadata.service.search.lineage.LineageQueryContext context, int batchSize)
      throws IOException {
    SearchLineageRequest request = context.getRequest();
    return request.getDirection() != null
        ? searchLineageWithDirectionInternal(request)
        : searchLineageInternal(request);
  }

  /**
   * Implements LineageGraphExecutor interface.
   * Estimates graph size using sampling and fanout calculation.
   */
  @Override
  public int estimateGraphSize(
      org.openmetadata.service.search.lineage.LineageQueryContext context) {
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
        EsUtils.getSearchRequest(
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
        if (bucket.key().stringValue().equals(FullyQualifiedName.buildHash(fqn))) {
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
