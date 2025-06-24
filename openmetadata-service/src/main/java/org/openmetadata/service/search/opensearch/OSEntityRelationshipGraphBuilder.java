package org.openmetadata.service.search.opensearch;

import static org.openmetadata.service.search.SearchClient.FQN_FIELD;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchUtils.ENTITY_RELATIONSHIP_AGGREGATION;
import static org.openmetadata.service.search.SearchUtils.buildDirectionToFqnSet;
import static org.openmetadata.service.search.SearchUtils.getEntityRelationshipRef;
import static org.openmetadata.service.search.SearchUtils.getUpstreamEntityRelationshipListIfExist;
import static org.openmetadata.service.search.SearchUtils.paginateUpstreamEntityRelationships;
import static org.openmetadata.service.search.elasticsearch.ElasticSearchClient.SOURCE_FIELDS_TO_EXCLUDE;
import static org.openmetadata.service.search.opensearch.OsUtils.getSearchRequest;

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
import os.org.opensearch.action.search.SearchResponse;
import os.org.opensearch.client.RequestOptions;
import os.org.opensearch.client.RestHighLevelClient;
import os.org.opensearch.search.SearchHit;

@Slf4j
public class OSEntityRelationshipGraphBuilder {
  private final RestHighLevelClient esClient;

  public OSEntityRelationshipGraphBuilder(RestHighLevelClient esClient) {
    this.esClient = esClient;
  }

  public SearchEntityRelationshipResult getUpstreamEntityRelationship(
      SearchEntityRelationshipRequest request) throws IOException {
    SearchEntityRelationshipResult result =
        new SearchEntityRelationshipResult()
            .withNodes(new HashMap<>())
            .withUpstreamEdges(new HashMap<>())
            .withDownstreamEdges(new HashMap<>());

    if (request.getFqn() == null || request.getFqn().trim().isEmpty()) {
      return result;
    }

    fetchUpstreamNodesRecursively(
        request,
        result,
        Map.of(FullyQualifiedName.buildHash(request.getFqn()), request.getFqn()),
        request.getUpstreamDepth());
    return result;
  }

  public SearchEntityRelationshipResult getDownstreamEntityRelationship(
      SearchEntityRelationshipRequest request) throws IOException {
    SearchEntityRelationshipResult result =
        new SearchEntityRelationshipResult()
            .withNodes(new HashMap<>())
            .withUpstreamEdges(new HashMap<>())
            .withDownstreamEdges(new HashMap<>());

    if (request.getFqn() == null || request.getFqn().trim().isEmpty()) {
      return result;
    }

    fetchDownstreamNodesRecursively(
        request,
        result,
        Map.of(FullyQualifiedName.buildHash(request.getFqn()), request.getFqn()),
        request.getDownstreamDepth());
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
    os.org.opensearch.action.search.SearchRequest searchRequest =
        getSearchRequest(
            null,
            GLOBAL_SEARCH_ALIAS,
            entityRelationshipRequest.getQueryFilter(),
            ENTITY_RELATIONSHIP_AGGREGATION,
            directionKeyAndValues,
            0,
            10000,
            entityRelationshipRequest.getIncludeDeleted(),
            entityRelationshipRequest.getIncludeSourceFields().stream().toList(),
            SOURCE_FIELDS_TO_EXCLUDE);

    SearchResponse searchResponse = esClient.search(searchRequest, RequestOptions.DEFAULT);
    for (SearchHit hit : searchResponse.getHits().getHits()) {
      Map<String, Object> esDoc = hit.getSourceAsMap();
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
            paginateUpstreamEntityRelationships(
                upStreamEntities,
                entityRelationshipRequest.getLayerFrom(),
                entityRelationshipRequest.getLayerSize());
        for (EsEntityRelationshipData data : paginatedUpstreamEntities) {
          result.getUpstreamEdges().putIfAbsent(data.getDocId(), data.withRelatedEntity(toEntity));
          String fromFqn = data.getEntity().getFullyQualifiedName();
          if (!result.getNodes().containsKey(fromFqn)) {
            hasToFqnMapForLayer.put(FullyQualifiedName.buildHash(fromFqn), fromFqn);
          }
        }
      }
    }

    fetchUpstreamNodesRecursively(
        entityRelationshipRequest, result, hasToFqnMapForLayer, depth - 1);
  }

  private void fetchDownstreamNodesRecursively(
      SearchEntityRelationshipRequest entityRelationshipRequest,
      SearchEntityRelationshipResult result,
      Map<String, String> hasToFqnMap,
      int depth)
      throws IOException {
    if (depth < 0 || hasToFqnMap.isEmpty()) {
      return;
    }

    // For downstream, we need to search for entities that have current entity as their upstream
    // This is similar to how lineage downstream works - we find entities that depend on the current
    // entity
    Map<String, String> hasToFqnMapForLayer = new HashMap<>();
    Map<String, Set<String>> directionKeyAndValues =
        buildDirectionToFqnSet(entityRelationshipRequest.getDirectionValue(), hasToFqnMap.keySet());
    os.org.opensearch.action.search.SearchRequest searchRequest =
        getSearchRequest(
            null,
            GLOBAL_SEARCH_ALIAS,
            entityRelationshipRequest.getQueryFilter(),
            ENTITY_RELATIONSHIP_AGGREGATION,
            directionKeyAndValues,
            0,
            10000,
            entityRelationshipRequest.getIncludeDeleted(),
            entityRelationshipRequest.getIncludeSourceFields().stream().toList(),
            SOURCE_FIELDS_TO_EXCLUDE);

    SearchResponse searchResponse = esClient.search(searchRequest, RequestOptions.DEFAULT);
    for (SearchHit hit : searchResponse.getHits().getHits()) {
      Map<String, Object> esDoc = hit.getSourceAsMap();
      if (!esDoc.isEmpty()) {
        String fqn = esDoc.get(FQN_FIELD).toString();
        RelationshipRef fromEntity = getEntityRelationshipRef(esDoc);
        List<EsEntityRelationshipData> upStreamEntities =
            getUpstreamEntityRelationshipListIfExist(esDoc);
        result
            .getNodes()
            .putIfAbsent(
                fqn,
                new NodeInformation()
                    .withEntity(esDoc)
                    .withPaging(
                        new LayerPaging().withEntityDownstreamCount(upStreamEntities.size())));

        // For downstream: find entities that have the current entity in their upstream list
        List<EsEntityRelationshipData> filteredDownstreamEntities =
            upStreamEntities.stream()
                .filter(data -> hasToFqnMap.containsKey(data.getEntity().getFqnHash()))
                .toList();

        List<EsEntityRelationshipData> paginatedDownstreamEntities =
            paginateUpstreamEntityRelationships(
                filteredDownstreamEntities,
                entityRelationshipRequest.getLayerFrom(),
                entityRelationshipRequest.getLayerSize());
        for (EsEntityRelationshipData data : paginatedDownstreamEntities) {
          result.getDownstreamEdges().putIfAbsent(data.getDocId(), data.withEntity(fromEntity));
          String toFqn = data.getRelatedEntity().getFullyQualifiedName();
          if (!result.getNodes().containsKey(toFqn)) {
            hasToFqnMapForLayer.put(FullyQualifiedName.buildHash(toFqn), toFqn);
          }
        }
      }
    }

    fetchDownstreamNodesRecursively(
        entityRelationshipRequest, result, hasToFqnMapForLayer, depth - 1);
  }
}
