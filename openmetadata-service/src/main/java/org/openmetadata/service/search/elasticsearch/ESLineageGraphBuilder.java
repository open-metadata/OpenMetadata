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
import static org.openmetadata.service.search.elasticsearch.EsUtils.getSearchRequest;
import static org.openmetadata.service.util.LineageUtil.getNodeInformation;

import com.nimbusds.jose.util.Pair;
import es.org.elasticsearch.action.search.SearchRequest;
import es.org.elasticsearch.action.search.SearchResponse;
import es.org.elasticsearch.client.RequestOptions;
import es.org.elasticsearch.client.RestHighLevelClient;
import es.org.elasticsearch.search.SearchHit;
import es.org.elasticsearch.search.aggregations.bucket.terms.ParsedStringTerms;
import es.org.elasticsearch.search.aggregations.bucket.terms.Terms;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
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
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class ESLineageGraphBuilder {

  private final RestHighLevelClient esClient;

  public ESLineageGraphBuilder(RestHighLevelClient esClient) {
    this.esClient = esClient;
  }

  private int calculateCurrentDepth(SearchLineageRequest lineageRequest, int remainingDepth) {
    if (lineageRequest.getDirection() == null) {
      return 0;
    }

    int configuredMaxDepth =
        lineageRequest.getDirection().equals(LineageDirection.UPSTREAM)
            ? lineageRequest.getUpstreamDepth()
            : lineageRequest.getDownstreamDepth() + 1;

    return configuredMaxDepth - remainingDepth;
  }

  public SearchLineageResult getPlatformLineage(String index, String queryFilter, boolean deleted)
      throws IOException {
    SearchLineageResult result =
        new SearchLineageResult()
            .withNodes(new HashMap<>())
            .withUpstreamEdges(new HashMap<>())
            .withDownstreamEdges(new HashMap<>());
    SearchResponse searchResponse = EsUtils.searchEntities(index, queryFilter, deleted);

    // Add Nodes
    Arrays.stream(searchResponse.getHits().getHits())
        .map(hit -> collectionOrEmpty(hit.getSourceAsMap()))
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
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
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

    SearchResponse searchResponse = esClient.search(searchRequest, RequestOptions.DEFAULT);
    for (SearchHit hit : searchResponse.getHits().getHits()) {
      Map<String, Object> esDoc = hit.getSourceAsMap();
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
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
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

    SearchResponse searchResponse = esClient.search(searchRequest, RequestOptions.DEFAULT);
    for (SearchHit hit : searchResponse.getHits().getHits()) {
      Map<String, Object> entityMap = hit.getSourceAsMap();
      if (!entityMap.isEmpty()) {
        String fqn = entityMap.get(FQN_FIELD).toString();

        // Add Paging Details per entity
        ParsedStringTerms valueCountAgg =
            searchResponse.getAggregations() != null
                ? searchResponse.getAggregations().get(GRAPH_AGGREGATION)
                : new ParsedStringTerms();
        for (Terms.Bucket bucket : valueCountAgg.getBuckets()) {
          String fqnFromHash = hasToFqnMap.get(bucket.getKeyAsString());
          if (!nullOrEmpty(bucket.getKeyAsString())
              && fqnFromHash != null
              && result.getNodes().containsKey(fqnFromHash)) {
            NodeInformation nodeInformation = result.getNodes().get(fqnFromHash);
            nodeInformation.setPaging(
                new LayerPaging().withEntityDownstreamCount((int) bucket.getDocCount()));
            result.getNodes().put(fqnFromHash, nodeInformation);
          }
        }

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
    SearchLineageResult result =
        new SearchLineageResult()
            .withNodes(new HashMap<>())
            .withUpstreamEdges(new HashMap<>())
            .withDownstreamEdges(new HashMap<>());

    // First, fetch and add the root entity with proper paging counts
    addRootEntityWithPagingCounts(lineageRequest, result);

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
    SearchLineageResult result =
        new SearchLineageResult()
            .withNodes(new HashMap<>())
            .withUpstreamEdges(new HashMap<>())
            .withDownstreamEdges(new HashMap<>());

    // First, fetch and add the root entity with proper paging counts
    addRootEntityWithPagingCounts(lineageRequest, result);

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
      SearchLineageRequest lineageRequest, SearchLineageResult result) throws IOException {
    Map<String, Object> rootEntityMap =
        EsUtils.searchEntityByKey(
            null,
            GLOBAL_SEARCH_ALIAS,
            FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD,
            Pair.of(FullyQualifiedName.buildHash(lineageRequest.getFqn()), lineageRequest.getFqn()),
            SOURCE_FIELDS_TO_EXCLUDE);

    if (!rootEntityMap.isEmpty()) {
      String rootFqn = rootEntityMap.get(FQN_FIELD).toString();
      List<EsLineageData> upstreamEntities = getUpstreamLineageListIfExist(rootEntityMap);

      int downstreamCount = countDownstreamEntities(lineageRequest.getFqn(), lineageRequest);

      NodeInformation rootNode =
          getNodeInformation(rootEntityMap, downstreamCount, upstreamEntities.size(), 0);
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

    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        getSearchRequest(
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

    SearchResponse response = esClient.search(searchRequest, RequestOptions.DEFAULT);

    // Get count from aggregation like in fetchDownstreamNodesRecursively
    ParsedStringTerms valueCountAgg =
        response.getAggregations() != null
            ? response.getAggregations().get(GRAPH_AGGREGATION)
            : new ParsedStringTerms();

    for (Terms.Bucket bucket : valueCountAgg.getBuckets()) {
      String fqnFromHash = hasToFqnMap.get(bucket.getKeyAsString());
      if (fqnFromHash != null && fqnFromHash.equals(fqn)) {
        return (int) bucket.getDocCount();
      }
    }

    return 0;
  }

  private void validateLayerParameters(SearchLineageRequest lineageRequest) {
    if (lineageRequest.getLayerFrom() < 0 || lineageRequest.getLayerSize() < 0) {
      throw new IllegalArgumentException(
          "LayerFrom and LayerSize should be greater than or equal to 0");
    }
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
        result);
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

      SearchResponse searchResponse = esClient.search(searchRequest, RequestOptions.DEFAULT);

      Map<String, String> nextLevel = new HashMap<>();
      int countAtDepth = (int) searchResponse.getHits().getTotalHits().value;

      for (SearchHit hit : searchResponse.getHits().getHits()) {
        Map<String, Object> esDoc = hit.getSourceAsMap();
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

      SearchResponse searchResponse = esClient.search(searchRequest, RequestOptions.DEFAULT);

      List<String> entitiesAtDepth = new ArrayList<>();
      Map<String, String> nextLevel = new HashMap<>();

      for (SearchHit hit : searchResponse.getHits().getHits()) {
        Map<String, Object> esDoc = hit.getSourceAsMap();
        if (!esDoc.isEmpty()) {
          String entityFqn = esDoc.get(FQN_FIELD).toString();
          entitiesAtDepth.add(entityFqn);
          if (!visitedFqns.contains(entityFqn)) {
            nextLevel.put(FullyQualifiedName.buildHash(entityFqn), entityFqn);
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
          EsUtils.searchEntityByKey(
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

      SearchResponse searchResponse = esClient.search(searchRequest, RequestOptions.DEFAULT);
      Map<String, String> nextLevel = new HashMap<>();

      for (SearchHit hit : searchResponse.getHits().getHits()) {
        Map<String, Object> esDoc = hit.getSourceAsMap();
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

  private <T> List<T> paginateList(List<T> list, int from, int size) {
    if (list == null || list.isEmpty() || from >= list.size()) {
      return new ArrayList<>();
    }
    int toIndex = Math.min(from + size, list.size());
    return list.subList(from, toIndex);
  }
}
