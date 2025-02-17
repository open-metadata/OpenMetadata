package org.openmetadata.service.search.opensearch;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.search.SearchClient.FQN_FIELD;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchUtils.LINEAGE_AGGREGATION;
import static org.openmetadata.service.search.SearchUtils.getRelationshipRef;
import static org.openmetadata.service.search.SearchUtils.getUpstreamLineageListIfExist;
import static org.openmetadata.service.search.SearchUtils.paginateUpstreamEntities;
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
import org.openmetadata.schema.type.lineage.NodeInformation;
import os.org.opensearch.action.search.SearchResponse;
import os.org.opensearch.client.RequestOptions;
import os.org.opensearch.client.RestHighLevelClient;
import os.org.opensearch.search.SearchHit;
import os.org.opensearch.search.aggregations.bucket.terms.ParsedStringTerms;
import os.org.opensearch.search.aggregations.bucket.terms.Terms;

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

    if (lineageRequest.getLayerFrom() < 0 || lineageRequest.getLayerSize() < 0) {
      throw new IllegalArgumentException(
          "LayerFrom and LayerSize should be greater than or equal to 0");
    }

    Set<String> fqnSet = new HashSet<>();
    os.org.opensearch.action.search.SearchRequest searchRequest =
        getSearchRequest(
            GLOBAL_SEARCH_ALIAS,
            lineageRequest.getQueryFilter(),
            LINEAGE_AGGREGATION,
            lineageRequest.getDirectionValue(),
            fqns,
            0,
            10000,
            lineageRequest.getIncludeDeleted(),
            null,
            SOURCE_FIELDS_TO_EXCLUDE);

    SearchResponse searchResponse = esClient.search(searchRequest, RequestOptions.DEFAULT);
    for (SearchHit hit : searchResponse.getHits().getHits()) {
      Map<String, Object> esDoc = hit.getSourceAsMap();
      if (!esDoc.isEmpty()) {
        String fqn = esDoc.get(FQN_FIELD).toString();
        RelationshipRef toEntity = getRelationshipRef(esDoc);
        List<EsLineageData> upStreamEntities = getUpstreamLineageListIfExist(esDoc);
        result
            .getNodes()
            .putIfAbsent(
                fqn,
                new NodeInformation()
                    .withEntity(esDoc)
                    .withPaging(
                        new LayerPaging().withEntityUpstreamCount(upStreamEntities.size())));
        List<EsLineageData> paginatedUpstreamEntities =
            paginateUpstreamEntities(
                upStreamEntities, lineageRequest.getLayerFrom(), lineageRequest.getLayerSize());
        for (EsLineageData data : paginatedUpstreamEntities) {
          result.getUpstreamEdges().putIfAbsent(data.getDocId(), data.withToEntity(toEntity));
          String fromFqn = data.getFromEntity().getFullyQualifiedName();
          if (!result.getNodes().containsKey(fromFqn)) {
            fqnSet.add(fromFqn);
          }
        }
      }
    }

    fetchUpstreamNodesRecursively(lineageRequest, result, fqnSet, depth - 1);
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
        Set.of(lineageRequest.getFqn()),
        lineageRequest.getDownstreamDepth() - 1);
    return result;
  }

  private void addFirstDownstreamEntity(
      SearchLineageRequest lineageRequest, SearchLineageResult result) throws IOException {
    Map<String, Object> entityMap =
        OsUtils.searchEntityByKey(
            GLOBAL_SEARCH_ALIAS, FQN_FIELD, lineageRequest.getFqn(), SOURCE_FIELDS_TO_EXCLUDE);
    result
        .getNodes()
        .putIfAbsent(
            entityMap.get(FQN_FIELD).toString(),
            new NodeInformation()
                .withEntity(entityMap)
                .withPaging(new LayerPaging().withEntityDownstreamCount(0)));
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
            LINEAGE_AGGREGATION,
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
        String fqn = entityMap.get(FQN_FIELD).toString();

        // Add Paging Details per entity
        ParsedStringTerms valueCountAgg = searchResponse.getAggregations().get(LINEAGE_AGGREGATION);
        for (Terms.Bucket bucket : valueCountAgg.getBuckets()) {
          if (!nullOrEmpty(bucket.getKeyAsString())
              && result.getNodes().containsKey(bucket.getKeyAsString())) {
            NodeInformation nodeInformation = result.getNodes().get(bucket.getKeyAsString());
            nodeInformation.setPaging(
                new LayerPaging().withEntityDownstreamCount((int) bucket.getDocCount()));
            result.getNodes().put(bucket.getKeyAsString(), nodeInformation);
          }
        }

        RelationshipRef toEntity = getRelationshipRef(entityMap);
        if (!result.getNodes().containsKey(fqn)) {
          fqnSet.add(fqn);
          result
              .getNodes()
              .put(
                  fqn,
                  new NodeInformation()
                      .withEntity(entityMap)
                      .withPaging(new LayerPaging().withEntityDownstreamCount(0)));
        }

        List<EsLineageData> upstreamEntities = getUpstreamLineageListIfExist(entityMap);
        for (EsLineageData esLineageData : upstreamEntities) {
          if (fqns.contains(esLineageData.getFromEntity().getFullyQualifiedName())) {
            result
                .getDownstreamEdges()
                .putIfAbsent(esLineageData.getDocId(), esLineageData.withToEntity(toEntity));
          }
        }
      }
    }

    fetchDownstreamNodesRecursively(lineageRequest, result, fqnSet, depth - 1);
  }
}
