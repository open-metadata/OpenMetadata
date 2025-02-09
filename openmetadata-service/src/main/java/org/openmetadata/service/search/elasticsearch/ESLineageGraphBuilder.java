package org.openmetadata.service.search.elasticsearch;

import static org.openmetadata.service.search.SearchClient.FQN_FIELD;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchUtils.getRelationshipRef;
import static org.openmetadata.service.search.SearchUtils.getUpstreamLineageIfExist;
import static org.openmetadata.service.search.elasticsearch.ElasticSearchClient.SOURCE_FIELDS_TO_EXCLUDE;
import static org.openmetadata.service.search.elasticsearch.EsUtils.getSearchRequest;

import es.org.elasticsearch.action.search.SearchResponse;
import es.org.elasticsearch.client.RequestOptions;
import es.org.elasticsearch.client.RestHighLevelClient;
import es.org.elasticsearch.search.SearchHit;
import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.DirectionPaging;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.RelationshipRef;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.LayerPaging;

@Slf4j
public class ESLineageGraphBuilder {
  private final RestHighLevelClient esClient;

  public ESLineageGraphBuilder(RestHighLevelClient esClient) {
    this.esClient = esClient;
  }

  public SearchLineageResult getUpstreamLineage(SearchLineageRequest request) throws IOException {
    SearchLineageResult result =
        new SearchLineageResult()
            .withNodes(new HashMap<>())
            .withUpstreamEdges(new HashMap<>())
            .withDownstreamEdges(new HashMap<>())
            .withPaging(new DirectionPaging());

    fetchUpstreamNodesRecursively(
        request, result, Set.of(request.getFqn()), request.getUpstreamDepth());
    return result;
  }

  private void fetchUpstreamNodesRecursively(
      SearchLineageRequest lineageRequest, SearchLineageResult result, Set<String> fqns, int depth)
      throws IOException {
    if (depth < 0 || fqns.isEmpty()) {
      return;
    }

    Set<String> fqnSet = new HashSet<>();
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        getSearchRequest(
            GLOBAL_SEARCH_ALIAS,
            lineageRequest.getQueryFilter(),
            lineageRequest.getDirectionValue(),
            fqns,
            lineageRequest.getLayerFrom(),
            lineageRequest.getLayerSize(),
            lineageRequest.getIncludeDeleted(),
            null,
            SOURCE_FIELDS_TO_EXCLUDE);

    SearchResponse searchResponse = esClient.search(searchRequest, RequestOptions.DEFAULT);
    for (SearchHit hit : searchResponse.getHits().getHits()) {
      Map<String, Object> esDoc = hit.getSourceAsMap();
      if (!esDoc.isEmpty()) {
        String fqn = esDoc.get(FQN_FIELD).toString();
        result.getNodes().putIfAbsent(fqn, esDoc);

        RelationshipRef toEntity = getRelationshipRef(esDoc);
        List<EsLineageData> upStreamEntities = getUpstreamLineageIfExist(esDoc);
        for (EsLineageData data : upStreamEntities) {
          result.getUpstreamEdges().putIfAbsent(data.getDocId(), data.withToEntity(toEntity));
          String fromFqn = data.getFromEntity().getFullyQualifiedName();
          if (!result.getNodes().containsKey(fromFqn)) {
            fqnSet.add(fromFqn);
          }
        }
      }
    }

    Integer nextFrom =
        ((lineageRequest.getLayerFrom() + searchResponse.getHits().getHits().length)
                == searchResponse.getHits().getTotalHits().value)
            ? null
            : (lineageRequest.getLayerFrom() + searchResponse.getHits().getHits().length);
    result
        .getPaging()
        .getUpstream()
        .add(
            new LayerPaging()
                .withLayerNumber(lineageRequest.getUpstreamDepth() - depth)
                .withNextFrom(nextFrom)
                .withTotal(searchResponse.getHits().getTotalHits().value));

    fetchUpstreamNodesRecursively(lineageRequest, result, fqnSet, depth - 1);
  }

  public SearchLineageResult getDownstreamLineage(SearchLineageRequest lineageRequest)
      throws IOException {
    SearchLineageResult result =
        new SearchLineageResult()
            .withNodes(new HashMap<>())
            .withUpstreamEdges(new HashMap<>())
            .withDownstreamEdges(new HashMap<>())
            .withPaging(new DirectionPaging());

    // Add First and call recursively
    addFirstDownstreamEntity(lineageRequest, result);
    fetchDownstreamNodesRecursively(
        lineageRequest,
        result,
        Set.of(lineageRequest.getFqn()),
        lineageRequest.getDownstreamDepth() - 1);
    return result;
  }

  private void addFirstDownstreamEntity(
      SearchLineageRequest lineageRequest, SearchLineageResult result) throws IOException {
    Map<String, Object> entityMap =
        EsUtils.searchEntityByKey(
            GLOBAL_SEARCH_ALIAS, FQN_FIELD, lineageRequest.getFqn(), SOURCE_FIELDS_TO_EXCLUDE);
    result.getNodes().putIfAbsent(entityMap.get(FQN_FIELD).toString(), entityMap);
    result
        .getPaging()
        .getDownstream()
        .add(new LayerPaging().withLayerNumber(0).withNextFrom(null).withTotal(1L));
  }

  private void fetchDownstreamNodesRecursively(
      SearchLineageRequest lineageRequest, SearchLineageResult result, Set<String> fqns, int depth)
      throws IOException {
    if (depth <= 0 || fqns.isEmpty()) {
      return;
    }

    Set<String> fqnSet = new HashSet<>();
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        getSearchRequest(
            GLOBAL_SEARCH_ALIAS,
            lineageRequest.getQueryFilter(),
            lineageRequest.getDirectionValue(),
            fqns,
            lineageRequest.getLayerFrom(),
            lineageRequest.getLayerSize(),
            lineageRequest.getIncludeDeleted(),
            null,
            SOURCE_FIELDS_TO_EXCLUDE);

    SearchResponse searchResponse = esClient.search(searchRequest, RequestOptions.DEFAULT);
    for (SearchHit hit : searchResponse.getHits().getHits()) {
      Map<String, Object> entityMap = hit.getSourceAsMap();
      if (!entityMap.isEmpty()) {
        RelationshipRef toEntity = getRelationshipRef(entityMap);
        String fqn = entityMap.get(FQN_FIELD).toString();
        if (!result.getNodes().containsKey(fqn)) {
          fqnSet.add(fqn);
          result.getNodes().put(fqn, entityMap);
        }

        List<EsLineageData> upstreamEntities = getUpstreamLineageIfExist(entityMap);
        for (EsLineageData esLineageData : upstreamEntities) {
          if (fqns.contains(esLineageData.getFromEntity().getFullyQualifiedName())) {
            result
                .getDownstreamEdges()
                .putIfAbsent(esLineageData.getDocId(), esLineageData.withToEntity(toEntity));
          }
        }
      }
    }

    Integer nextFrom =
        ((lineageRequest.getLayerFrom() + searchResponse.getHits().getHits().length)
                == searchResponse.getHits().getTotalHits().value)
            ? null
            : (lineageRequest.getLayerFrom() + searchResponse.getHits().getHits().length);
    result
        .getPaging()
        .getDownstream()
        .add(
            new LayerPaging()
                .withLayerNumber(lineageRequest.getDownstreamDepth() - depth)
                .withNextFrom(nextFrom)
                .withTotal(searchResponse.getHits().getTotalHits().value));

    fetchDownstreamNodesRecursively(lineageRequest, result, fqnSet, depth - 1);
  }
}
