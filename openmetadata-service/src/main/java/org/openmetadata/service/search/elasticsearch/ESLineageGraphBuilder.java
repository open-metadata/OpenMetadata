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
import static org.openmetadata.service.search.SearchUtils.paginateList;
import static org.openmetadata.service.search.elasticsearch.ElasticSearchClient.SOURCE_FIELDS_TO_EXCLUDE;
import static org.openmetadata.service.search.elasticsearch.EsUtils.getSearchRequest;

import com.nimbusds.jose.util.Pair;
import es.org.elasticsearch.action.search.SearchResponse;
import es.org.elasticsearch.client.RequestOptions;
import es.org.elasticsearch.client.RestHighLevelClient;
import es.org.elasticsearch.search.SearchHit;
import es.org.elasticsearch.search.aggregations.bucket.terms.ParsedStringTerms;
import es.org.elasticsearch.search.aggregations.bucket.terms.Terms;
import java.io.IOException;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.LineageDirection;
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
        lineageRequest.getDirection().toString().equals("UPSTREAM")
            ? lineageRequest.getUpstreamDepth()
            : lineageRequest.getDownstreamDepth();

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
              result
                  .getNodes()
                  .putIfAbsent(fqn, new NodeInformation().withEntity(sourceMap).withNodeDepth(0));

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
            lineageRequest.getQueryFilter(),
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
                fqn,
                new NodeInformation()
                    .withEntity(esDoc)
                    .withPaging(new LayerPaging().withEntityUpstreamCount(upStreamEntities.size()))
                    .withNodeDepth(-1 * currentDepth));
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

    // Add First and call recursively
    addFirstDownstreamEntity(lineageRequest, result);
    fetchDownstreamNodesRecursively(
        lineageRequest,
        result,
        Map.of(FullyQualifiedName.buildHash(lineageRequest.getFqn()), lineageRequest.getFqn()),
        lineageRequest.getDownstreamDepth() - 1);
    return result;
  }

  private void addFirstDownstreamEntity(
      SearchLineageRequest lineageRequest, SearchLineageResult result) throws IOException {
    Map<String, Object> entityMap =
        EsUtils.searchEntityByKey(
            lineageRequest.getDirection(),
            GLOBAL_SEARCH_ALIAS,
            FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD,
            Pair.of(FullyQualifiedName.buildHash(lineageRequest.getFqn()), lineageRequest.getFqn()),
            SOURCE_FIELDS_TO_EXCLUDE);
    result
        .getNodes()
        .putIfAbsent(
            entityMap.get(FQN_FIELD).toString(),
            new NodeInformation()
                .withEntity(entityMap)
                .withPaging(new LayerPaging().withEntityDownstreamCount(0))
                .withNodeDepth(0)); // Root entity
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
          result
              .getNodes()
              .put(
                  fqn,
                  new NodeInformation()
                      .withEntity(entityMap)
                      .withPaging(new LayerPaging().withEntityDownstreamCount(0))
                      .withNodeDepth(currentDepth));
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
          new NodeInformation()
              .withEntity(rootEntityMap)
              .withNodeDepth(0)
              .withPaging(
                  new LayerPaging()
                      .withEntityUpstreamCount(upstreamEntities.size())
                      .withEntityDownstreamCount(downstreamCount));

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
}
