package org.openmetadata.service.search.opensearch;

import static org.openmetadata.service.Entity.FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD;
import static org.openmetadata.service.search.SearchClient.FQN_FIELD;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchUtils.GRAPH_AGGREGATION;
import static org.openmetadata.service.search.SearchUtils.buildDirectionToFqnSet;
import static org.openmetadata.service.search.SearchUtils.getEntityRelationshipRef;
import static org.openmetadata.service.search.SearchUtils.getUpstreamEntityRelationshipListIfExist;
import static org.openmetadata.service.search.SearchUtils.paginateList;
import static org.openmetadata.service.search.elasticsearch.ElasticSearchClient.SOURCE_FIELDS_TO_EXCLUDE;
import static org.openmetadata.service.search.opensearch.OsUtils.getSearchRequest;

import com.nimbusds.jose.util.Pair;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.entityRelationship.EsEntityRelationshipData;
import org.openmetadata.schema.api.entityRelationship.RelationshipRef;
import org.openmetadata.schema.api.entityRelationship.SearchEntityRelationshipRequest;
import org.openmetadata.schema.api.entityRelationship.SearchEntityRelationshipResult;
import org.openmetadata.schema.type.LayerPaging;
import org.openmetadata.schema.type.entityRelationship.NodeInformation;
import org.openmetadata.service.util.FullyQualifiedName;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.aggregations.StringTermsAggregate;
import os.org.opensearch.client.opensearch._types.aggregations.StringTermsBucket;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;
import os.org.opensearch.client.opensearch.core.search.Hit;

@Slf4j
public class OSEntityRelationshipGraphBuilder {
  private final OpenSearchClient esClient;

  public OSEntityRelationshipGraphBuilder(OpenSearchClient esClient) {
    this.esClient = esClient;
  }

  public SearchEntityRelationshipResult getUpstreamEntityRelationship(
      SearchEntityRelationshipRequest request) throws IOException {
    SearchEntityRelationshipResult result =
        new SearchEntityRelationshipResult()
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
      SearchEntityRelationshipRequest entityRelationshipRequest,
      SearchEntityRelationshipResult result,
      Map<String, String> hasToFqnMap,
      int depth)
      throws IOException {
    if (depth < 0 || hasToFqnMap.isEmpty()) {
      return;
    }

    if (entityRelationshipRequest.getLayerFrom() < 0
        || entityRelationshipRequest.getLayerSize() < 0) {
      throw new IllegalArgumentException(
          "LayerFrom and LayerSize should be greater than or equal to 0");
    }

    Map<String, String> hasToFqnMapForLayer = new HashMap<>();
    Map<String, Set<String>> directionKeyAndValues =
        buildDirectionToFqnSet(entityRelationshipRequest.getDirectionValue(), hasToFqnMap.keySet());
    SearchRequest searchRequest =
        getSearchRequest(
            entityRelationshipRequest.getDirection(),
            GLOBAL_SEARCH_ALIAS,
            entityRelationshipRequest.getQueryFilter(),
            GRAPH_AGGREGATION,
            directionKeyAndValues,
            0,
            10000,
            entityRelationshipRequest.getIncludeDeleted(),
            entityRelationshipRequest.getIncludeSourceFields().stream().toList(),
            SOURCE_FIELDS_TO_EXCLUDE);

    SearchResponse<JsonData> searchResponse = esClient.search(searchRequest, JsonData.class);
    for (Hit<JsonData> hit : searchResponse.hits().hits()) {
      if (hit.source() != null) {
        Map<String, Object> esDoc = OsUtils.jsonDataToMap(hit.source());
        if (!esDoc.isEmpty()) {
          String fqn = esDoc.get(FQN_FIELD).toString();
          RelationshipRef toEntity = getEntityRelationshipRef(esDoc);
          List<EsEntityRelationshipData> upStreamEntities =
              getUpstreamEntityRelationshipListIfExist(esDoc);
          result
              .getNodes()
              .putIfAbsent(
                  fqn,
                  new NodeInformation()
                      .withEntity(esDoc)
                      .withPaging(
                          new LayerPaging().withEntityUpstreamCount(upStreamEntities.size())));
          List<EsEntityRelationshipData> paginatedUpstreamEntities =
              paginateList(
                  upStreamEntities,
                  entityRelationshipRequest.getLayerFrom(),
                  entityRelationshipRequest.getLayerSize());
          for (EsEntityRelationshipData data : paginatedUpstreamEntities) {
            result
                .getUpstreamEdges()
                .putIfAbsent(data.getDocId(), data.withRelatedEntity(toEntity));
            String fromFqn = data.getEntity().getFullyQualifiedName();
            if (!result.getNodes().containsKey(fromFqn)) {
              hasToFqnMapForLayer.put(FullyQualifiedName.buildHash(fromFqn), fromFqn);
            }
          }
        }
      }
    }

    fetchUpstreamNodesRecursively(
        entityRelationshipRequest, result, hasToFqnMapForLayer, depth - 1);
  }

  public SearchEntityRelationshipResult getDownstreamEntityRelationship(
      SearchEntityRelationshipRequest request) throws IOException {
    SearchEntityRelationshipResult result =
        new SearchEntityRelationshipResult()
            .withNodes(new HashMap<>())
            .withUpstreamEdges(new HashMap<>())
            .withDownstreamEdges(new HashMap<>());

    // Add the first downstream entity node
    addFirstDownstreamEntity(request, result);

    fetchDownstreamNodesRecursively(
        request,
        result,
        Map.of(FullyQualifiedName.buildHash(request.getFqn()), request.getFqn()),
        request.getDownstreamDepth() - 1);
    return result;
  }

  private void addFirstDownstreamEntity(
      SearchEntityRelationshipRequest request, SearchEntityRelationshipResult result)
      throws IOException {
    Map<String, Object> entityMap =
        OsUtils.searchEREntityByKey(
            esClient,
            request.getDirection(),
            GLOBAL_SEARCH_ALIAS,
            FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD,
            Pair.of(FullyQualifiedName.buildHash(request.getFqn()), request.getFqn()),
            SOURCE_FIELDS_TO_EXCLUDE);
    result
        .getNodes()
        .putIfAbsent(
            entityMap.get(FQN_FIELD).toString(),
            new NodeInformation()
                .withEntity(entityMap)
                .withPaging(new LayerPaging().withEntityDownstreamCount(0)));
  }

  private void fetchDownstreamNodesRecursively(
      SearchEntityRelationshipRequest entityRelationshipRequest,
      SearchEntityRelationshipResult result,
      Map<String, String> hasToFqnMap,
      int depth)
      throws IOException {
    if (depth <= 0 || hasToFqnMap.isEmpty()) {
      return;
    }

    if (entityRelationshipRequest.getLayerFrom() < 0
        || entityRelationshipRequest.getLayerSize() < 0) {
      throw new IllegalArgumentException(
          "LayerFrom and LayerSize should be greater than or equal to 0");
    }

    Map<String, String> hasToFqnMapForLayer = new HashMap<>();
    Map<String, Set<String>> directionKeyAndValues =
        buildDirectionToFqnSet(entityRelationshipRequest.getDirectionValue(), hasToFqnMap.keySet());
    SearchRequest searchRequest =
        getSearchRequest(
            entityRelationshipRequest.getDirection(),
            GLOBAL_SEARCH_ALIAS,
            entityRelationshipRequest.getQueryFilter(),
            GRAPH_AGGREGATION,
            directionKeyAndValues,
            entityRelationshipRequest.getLayerFrom(),
            entityRelationshipRequest.getLayerSize(),
            entityRelationshipRequest.getIncludeDeleted(),
            entityRelationshipRequest.getIncludeSourceFields().stream().toList(),
            SOURCE_FIELDS_TO_EXCLUDE);

    SearchResponse<JsonData> searchResponse = esClient.search(searchRequest, JsonData.class);
    for (Hit<JsonData> hit : searchResponse.hits().hits()) {
      if (hit.source() != null) {
        Map<String, Object> entityMap = OsUtils.jsonDataToMap(hit.source());
        if (!entityMap.isEmpty()) {
          String fqn = entityMap.get(FQN_FIELD).toString();

          // Add Paging Details per entity
          StringTermsAggregate valueCountAgg =
              searchResponse.aggregations() != null
                      && searchResponse.aggregations().get(GRAPH_AGGREGATION) != null
                  ? searchResponse.aggregations().get(GRAPH_AGGREGATION).sterms()
                  : null;
          if (valueCountAgg != null) {
            for (StringTermsBucket bucket : valueCountAgg.buckets().array()) {
              String fqnFromHash = hasToFqnMap.get(bucket.key());
              if (fqnFromHash != null && result.getNodes().containsKey(fqnFromHash)) {
                NodeInformation nodeInformation = result.getNodes().get(fqnFromHash);
                nodeInformation.setPaging(
                    new LayerPaging().withEntityDownstreamCount((int) bucket.docCount()));
                result.getNodes().put(fqnFromHash, nodeInformation);
              }
            }
          }

          RelationshipRef toEntity = getEntityRelationshipRef(entityMap);
          if (!result.getNodes().containsKey(fqn)) {
            hasToFqnMapForLayer.put(FullyQualifiedName.buildHash(fqn), fqn);
            result
                .getNodes()
                .put(
                    fqn,
                    new NodeInformation()
                        .withEntity(entityMap)
                        .withPaging(new LayerPaging().withEntityDownstreamCount(0)));
          }

          List<EsEntityRelationshipData> upStreamEntities =
              getUpstreamEntityRelationshipListIfExist(entityMap);
          for (EsEntityRelationshipData esEntityRelationshipData : upStreamEntities) {
            if (hasToFqnMap.containsKey(esEntityRelationshipData.getEntity().getFqnHash())) {
              result
                  .getDownstreamEdges()
                  .putIfAbsent(
                      esEntityRelationshipData.getDocId(),
                      esEntityRelationshipData.withRelatedEntity(toEntity));
            }
          }
        }
      }
    }

    fetchDownstreamNodesRecursively(
        entityRelationshipRequest, result, hasToFqnMapForLayer, depth - 1);
  }
}
