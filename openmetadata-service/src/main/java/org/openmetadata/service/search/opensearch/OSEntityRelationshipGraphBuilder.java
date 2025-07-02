package org.openmetadata.service.search.opensearch;

import static org.openmetadata.common.utils.CommonUtil.collectionOrEmpty;
import static org.openmetadata.service.Entity.FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD;
import static org.openmetadata.service.search.SearchClient.FQN_FIELD;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchClient.TABLE_SEARCH_INDEX;
import static org.openmetadata.service.search.SearchUtils.ENTITY_RELATIONSHIP_AGGREGATION;
import static org.openmetadata.service.search.SearchUtils.buildDirectionToFqnSet;
import static org.openmetadata.service.search.SearchUtils.getEntityRelationshipRef;
import static org.openmetadata.service.search.SearchUtils.getUpstreamEntityRelationshipListIfExist;
import static org.openmetadata.service.search.SearchUtils.paginateUpstreamEntityRelationships;
import static org.openmetadata.service.search.elasticsearch.ElasticSearchClient.SOURCE_FIELDS_TO_EXCLUDE;
import static org.openmetadata.service.search.opensearch.OsUtils.getSearchRequest;

import com.nimbusds.jose.util.Pair;
import java.io.IOException;
import java.util.Arrays;
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
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;
import os.org.opensearch.action.search.SearchResponse;
import os.org.opensearch.client.RequestOptions;
import os.org.opensearch.client.RestHighLevelClient;
import os.org.opensearch.search.SearchHit;
import os.org.opensearch.search.aggregations.bucket.terms.ParsedStringTerms;
import os.org.opensearch.search.aggregations.bucket.terms.Terms;

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
        request.getUpstreamDepth() - 1);
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
            entityRelationshipRequest.getDirection(),
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
            result.getNodes().put(fromFqn, new NodeInformation().withEntity(data.getEntity()));
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

    if (entityRelationshipRequest.getLayerFrom() < 0
        || entityRelationshipRequest.getLayerSize() < 0) {
      throw new IllegalArgumentException(
          "LayerFrom and LayerSize should be greater than or equal to 0");
    }

    Map<String, String> hasToFqnMapForLayer = new HashMap<>();
    Map<String, Set<String>> directionKeyAndValues =
        buildDirectionToFqnSet(entityRelationshipRequest.getDirectionValue(), hasToFqnMap.keySet());
    os.org.opensearch.action.search.SearchRequest searchRequest =
        OsUtils.getSearchRequest(
            entityRelationshipRequest.getDirection(),
            GLOBAL_SEARCH_ALIAS,
            entityRelationshipRequest.getQueryFilter(),
            ENTITY_RELATIONSHIP_AGGREGATION,
            directionKeyAndValues,
            entityRelationshipRequest.getLayerFrom(),
            entityRelationshipRequest.getLayerSize(),
            entityRelationshipRequest.getIncludeDeleted(),
            entityRelationshipRequest.getIncludeSourceFields().stream().toList(),
            SOURCE_FIELDS_TO_EXCLUDE);

    SearchResponse searchResponse = esClient.search(searchRequest, RequestOptions.DEFAULT);
    for (SearchHit hit : searchResponse.getHits().getHits()) {
      Map<String, Object> entityMap = hit.getSourceAsMap();
      if (!entityMap.isEmpty()) {
        String fqn = entityMap.get(FQN_FIELD).toString();

        // Add Paging Details per entity
        ParsedStringTerms valueCountAgg =
            searchResponse.getAggregations() != null
                ? searchResponse.getAggregations().get(ENTITY_RELATIONSHIP_AGGREGATION)
                : new ParsedStringTerms();
        if (valueCountAgg != null) {
          for (Terms.Bucket bucket : valueCountAgg.getBuckets()) {
            String fqnFromHash = hasToFqnMap.get(bucket.getKeyAsString());
            if (fqnFromHash != null && result.getNodes().containsKey(fqnFromHash)) {
              NodeInformation nodeInformation = result.getNodes().get(fqnFromHash);
              nodeInformation.setPaging(
                  new LayerPaging().withEntityDownstreamCount((int) bucket.getDocCount()));
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

    fetchDownstreamNodesRecursively(
        entityRelationshipRequest, result, hasToFqnMapForLayer, depth - 1);
  }

  public SearchEntityRelationshipResult getSchemaEntityRelationship(
      String schemaFqn, String queryFilter, boolean deleted) throws IOException {
    SearchEntityRelationshipResult result =
        new SearchEntityRelationshipResult()
            .withNodes(new HashMap<>())
            .withUpstreamEdges(new HashMap<>())
            .withDownstreamEdges(new HashMap<>());

    if (schemaFqn == null || schemaFqn.trim().isEmpty()) {
      return result;
    }

    String finalQueryFilter = buildERQueryFilter(schemaFqn, queryFilter);

    SearchResponse searchResponse =
        OsUtils.searchEntities(TABLE_SEARCH_INDEX, finalQueryFilter, deleted);

    Arrays.stream(searchResponse.getHits().getHits())
        .map(hit -> collectionOrEmpty(hit.getSourceAsMap()))
        .forEach(
            sourceMap -> {
              String fqn = sourceMap.get(FQN_FIELD).toString();
              result.getNodes().putIfAbsent(fqn, new NodeInformation().withEntity(sourceMap));

              List<EsEntityRelationshipData> upstreamEntityRelationshipListIfExist =
                  getUpstreamEntityRelationshipListIfExist(sourceMap);
              for (EsEntityRelationshipData esEntityRelationshipData :
                  upstreamEntityRelationshipListIfExist) {
                result
                    .getUpstreamEdges()
                    .putIfAbsent(
                        esEntityRelationshipData.getDocId(),
                        esEntityRelationshipData.withRelatedEntity(
                            getEntityRelationshipRef(sourceMap)));
                String fromFqn = esEntityRelationshipData.getEntity().getFullyQualifiedName();
                if (!result.getNodes().containsKey(fromFqn)) {
                  result
                      .getNodes()
                      .put(
                          fromFqn,
                          new NodeInformation().withEntity(esEntityRelationshipData.getEntity()));
                }
              }
            });

    return result;
  }

  private static String buildERQueryFilter(String schemaFqn, String queryFilter) {
    String schemaFqnWildcardClause =
        String.format(
            "{\"wildcard\":{\"fullyQualifiedName.keyword\":\"%s.*\"}}",
            ReindexingUtil.escapeDoubleQuotes(schemaFqn));
    String innerBoolFilter;
    if (!org.openmetadata.common.utils.CommonUtil.nullOrEmpty(queryFilter)
        && !"{}".equals(queryFilter)) {
      innerBoolFilter = String.format("[ %s , %s ]", schemaFqnWildcardClause, queryFilter);
    } else {
      innerBoolFilter = String.format("[ %s ]", schemaFqnWildcardClause);
    }
    return String.format("{\"query\":{\"bool\":{\"must\":%s}}}", innerBoolFilter);
  }
}
