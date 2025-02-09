package org.openmetadata.service.search.opensearch;

import static org.openmetadata.service.search.SearchClient.FQN_FIELD;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchClient.UPSTREAM_LINEAGE_FIELD;
import static org.openmetadata.service.search.elasticsearch.ElasticSearchClient.SOURCE_FIELDS_TO_EXCLUDE;
import static org.openmetadata.service.search.opensearch.OsUtils.getSearchRequest;

import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.RelationshipRef;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.LayerPaging;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.util.JsonUtils;
import os.org.opensearch.action.search.SearchRequest;
import os.org.opensearch.action.search.SearchResponse;
import os.org.opensearch.client.RequestOptions;
import os.org.opensearch.client.RestHighLevelClient;
import os.org.opensearch.search.SearchHit;

@Slf4j
public class OSLineageGraphBuilder {
  private final RestHighLevelClient esClient;

  public OSLineageGraphBuilder(RestHighLevelClient esClient) {
    this.esClient = esClient;
  }

  public SearchLineageResult getUpstreamLineage(SearchLineageRequest request) throws IOException {
    SearchLineageResult result =
        new SearchLineageResult()
            .withNodes(new HashMap<>())
            .withUpstreamEdges(new HashMap<>())
            .withDownstreamEdges(new HashMap<>());

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
    SearchRequest searchRequest =
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

        if (esDoc.containsKey(UPSTREAM_LINEAGE_FIELD)) {
          RelationshipRef toEntity = SearchClient.getRelationshipRef(esDoc);
          List<EsLineageData> upStreamEntities =
              JsonUtils.readOrConvertValues(esDoc.get(UPSTREAM_LINEAGE_FIELD), EsLineageData.class);

          for (EsLineageData data : upStreamEntities) {
            result.getUpstreamEdges().putIfAbsent(data.getDocId(), data.withToEntity(toEntity));
            String fromFqn = data.getFromEntity().getFullyQualifiedName();
            if (!result.getNodes().containsKey(fromFqn)) {
              fqnSet.add(fromFqn);
            }
          }
        }
      }
    }

    result
        .getPaging()
        .add(
            new LayerPaging()
                .withLayerNumber(lineageRequest.getUpstreamDepth() - depth)
                .withNextFrom(
                    lineageRequest.getLayerFrom() + searchResponse.getHits().getHits().length)
                .withTotal(searchResponse.getHits().getTotalHits().value));

    fetchUpstreamNodesRecursively(lineageRequest, result, fqnSet, depth - 1);
  }

  public SearchLineageResult getDownstreamLineage(SearchLineageRequest lineageRequest)
      throws IOException {
    SearchLineageResult result =
        new SearchLineageResult()
            .withNodes(new HashMap<>())
            .withUpstreamEdges(new HashMap<>())
            .withDownstreamEdges(new HashMap<>());

    Map<String, Object> entityMap =
        OsUtils.searchEntityByKey(
            GLOBAL_SEARCH_ALIAS, FQN_FIELD, lineageRequest.getFqn(), SOURCE_FIELDS_TO_EXCLUDE);
    result.getNodes().putIfAbsent(entityMap.get(FQN_FIELD).toString(), entityMap);
    fetchDownstreamNodesRecursively(
        lineageRequest,
        result,
        Set.of(lineageRequest.getFqn()),
        lineageRequest.getDownstreamDepth());
    return result;
  }

  private void fetchDownstreamNodesRecursively(
      SearchLineageRequest lineageRequest, SearchLineageResult result, Set<String> fqns, int depth)
      throws IOException {
    if (depth <= 0 || fqns.isEmpty()) {
      return;
    }

    Set<String> fqnSet = new HashSet<>();
    os.org.opensearch.action.search.SearchRequest searchRequest =
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
        RelationshipRef toEntity = SearchClient.getRelationshipRef(entityMap);
        String fqn = entityMap.get(FQN_FIELD).toString();
        if (!result.getNodes().containsKey(fqn)) {
          fqnSet.add(fqn);
          result.getNodes().put(fqn, entityMap);
        }

        if (entityMap.containsKey(UPSTREAM_LINEAGE_FIELD)) {
          List<EsLineageData> upstreamEntities =
              JsonUtils.readOrConvertValues(
                  entityMap.get(UPSTREAM_LINEAGE_FIELD), EsLineageData.class);

          for (EsLineageData esLineageData : upstreamEntities) {
            if (fqns.contains(esLineageData.getFromEntity().getFullyQualifiedName())) {
              result
                  .getDownstreamEdges()
                  .putIfAbsent(esLineageData.getDocId(), esLineageData.withToEntity(toEntity));
            }
          }
        }
      }
    }

    result
        .getPaging()
        .add(
            new LayerPaging()
                .withLayerNumber(lineageRequest.getDownstreamDepth() - depth)
                .withNextFrom(
                    lineageRequest.getLayerFrom() + searchResponse.getHits().getHits().length)
                .withTotal(searchResponse.getHits().getTotalHits().value));

    fetchDownstreamNodesRecursively(lineageRequest, result, fqnSet, depth - 1);
  }
}
