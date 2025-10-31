package org.openmetadata.service.search.opensearch;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD;
import static org.openmetadata.service.search.SearchClient.FQN_FIELD;
import static org.openmetadata.service.search.SearchUtils.DOWNSTREAM_ENTITY_RELATIONSHIP_KEY;
import static org.openmetadata.service.search.SearchUtils.getLineageDirectionAggregationField;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.util.Pair;
import java.io.IOException;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.entityRelationship.EntityRelationshipDirection;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.service.Entity;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.FieldValue;
import os.org.opensearch.client.opensearch._types.SortOrder;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregation;
import os.org.opensearch.client.opensearch._types.mapping.FieldType;
import os.org.opensearch.client.opensearch._types.query_dsl.BoolQuery;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;
import os.org.opensearch.client.opensearch.core.search.Hit;
import os.org.opensearch.common.settings.Settings;
import os.org.opensearch.common.xcontent.NamedXContentRegistry;
import os.org.opensearch.search.SearchModule;

@Slf4j
public class OsUtils {

  public static Map<String, Object> jsonDataToMap(JsonData jsonData) {
    try {
      // Convert JsonData to JSON string, then parse it with Jackson
      String jsonString = jsonData.toJson().toString();
      return JsonUtils.readValue(jsonString, new TypeReference<>() {});
    } catch (Exception e) {
      LOG.error("Failed to convert JsonData to Map", e);
      return new HashMap<>();
    }
  }

  public static String parseJsonQuery(String jsonQuery) throws JsonProcessingException {
    JsonNode rootNode = mapper.readTree(jsonQuery);
    String queryToProcess = jsonQuery;
    try {
      if (rootNode.has("query")) {
        queryToProcess = rootNode.get("query").toString();
      }
    } catch (Exception e) {
      LOG.debug("Query does not contain outer 'query' wrapper, using as-is");
    }
    return Base64.getEncoder().encodeToString(queryToProcess.getBytes());
  }

  public static final NamedXContentRegistry osXContentRegistry;
  private static final ObjectMapper mapper;

  static {
    SearchModule searchModule = new SearchModule(Settings.EMPTY, List.of());
    osXContentRegistry = new NamedXContentRegistry(searchModule.getNamedXContents());
    mapper = new ObjectMapper();
  }

  public static String getEntityRelationshipAggregationField(
      EntityRelationshipDirection direction) {
    return direction == EntityRelationshipDirection.UPSTREAM
        ? FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD
        : DOWNSTREAM_ENTITY_RELATIONSHIP_KEY;
  }

  public static SearchResponse<JsonData> searchEntitiesWithLimitOffset(
      os.org.opensearch.client.opensearch.OpenSearchClient client,
      String index,
      String queryFilter,
      int offset,
      int limit,
      boolean deleted)
      throws IOException {
    Query baseQuery =
        Query.of(
            q ->
                q.term(
                    t ->
                        t.field("deleted")
                            .value(FieldValue.of(!CommonUtil.nullOrEmpty(deleted) && deleted))));

    SearchRequest.Builder searchRequestBuilder =
        new SearchRequest.Builder()
            .index(index)
            .from(offset)
            .size(limit)
            .query(baseQuery)
            .sort(
                s ->
                    s.field(
                        f ->
                            f.field("name.keyword")
                                .order(SortOrder.Asc)
                                .unmappedType(FieldType.Keyword)));

    // Apply query filter if present
    if (!nullOrEmpty(queryFilter) && !queryFilter.equals("{}")) {
      try {
        Query filterQuery;
        if (queryFilter.trim().startsWith("{")) {
          String queryToProcess = parseJsonQuery(queryFilter);
          filterQuery = Query.of(q -> q.wrapper(w -> w.query(queryToProcess)));
        } else {
          filterQuery = Query.of(q -> q.queryString(qs -> qs.query(queryFilter)));
        }
        searchRequestBuilder.query(q -> q.bool(b -> b.must(baseQuery).filter(filterQuery)));
      } catch (Exception ex) {
        LOG.warn("Error parsing query_filter from query parameters, ignoring filter", ex);
      }
    }

    return client.search(
        searchRequestBuilder.build(), os.org.opensearch.client.json.JsonData.class);
  }

  public static Map<String, Object> searchEREntityByKey(
      OpenSearchClient client,
      EntityRelationshipDirection direction,
      String indexAlias,
      String keyName,
      Pair<String, String> hasToFqnPair,
      List<String> fieldsToRemove)
      throws IOException {
    Map<String, Object> result =
        searchEREntitiesByKey(
            client,
            direction,
            indexAlias,
            keyName,
            Set.of(hasToFqnPair.getLeft()),
            0,
            1,
            fieldsToRemove);
    if (result.size() == 1) {
      return (Map<String, Object>) result.get(hasToFqnPair.getRight());
    } else {
      throw new SearchException(
          String.format(
              "Issue in Search Entity By Key: %s, Value Fqn: %s , Number of Hits: %s",
              keyName, hasToFqnPair.getRight(), result.size()));
    }
  }

  public static Map<String, Object> searchEREntitiesByKey(
      OpenSearchClient client,
      EntityRelationshipDirection direction,
      String indexAlias,
      String keyName,
      Set<String> keyValues,
      int from,
      int size,
      List<String> fieldsToRemove)
      throws IOException {
    Map<String, Object> result = new HashMap<>();
    SearchRequest searchRequest =
        getSearchRequest(
            direction,
            indexAlias,
            null,
            null,
            Map.of(keyName, keyValues),
            from,
            size,
            null,
            null,
            fieldsToRemove);
    SearchResponse<JsonData> searchResponse = client.search(searchRequest, JsonData.class);

    for (Hit<JsonData> hit : searchResponse.hits().hits()) {
      if (hit.source() != null) {
        Map<String, Object> esDoc = jsonDataToMap(hit.source());
        String fqn = esDoc.get(FQN_FIELD).toString();
        result.put(fqn, esDoc);
      }
    }
    return result;
  }

  public static SearchRequest getSearchRequest(
      EntityRelationshipDirection direction,
      String indexAlias,
      String queryFilter,
      String aggName,
      Map<String, Set<String>> keysAndValues,
      int from,
      int size,
      Boolean deleted,
      List<String> fieldsToInclude,
      List<String> fieldsToRemove) {

    String index = Entity.getSearchRepository().getIndexOrAliasName(indexAlias);

    SearchRequest.Builder searchRequestBuilder = new SearchRequest.Builder().index(index);

    // Build source filter
    if (!listOrEmpty(fieldsToInclude).isEmpty() || !listOrEmpty(fieldsToRemove).isEmpty()) {
      searchRequestBuilder.source(
          s ->
              s.filter(
                  f ->
                      f.includes(listOrEmpty(fieldsToInclude))
                          .excludes(listOrEmpty(fieldsToRemove))));
    }

    // Build bool query with should clauses
    Query baseQuery = buildBoolQueriesWithShould(keysAndValues);

    if (!CommonUtil.nullOrEmpty(deleted)) {
      Query deletedQuery =
          Query.of(q -> q.term(t -> t.field("deleted").value(FieldValue.of(deleted))));
      final Query finalBaseQuery = baseQuery;
      baseQuery = Query.of(q -> q.bool(b -> b.must(finalBaseQuery).must(deletedQuery)));
    }

    searchRequestBuilder.query(baseQuery);
    searchRequestBuilder.from(from);
    searchRequestBuilder.size(size);

    // Add aggregation if needed
    if (!nullOrEmpty(aggName)) {
      String aggField = getEntityRelationshipAggregationField(direction);
      searchRequestBuilder.aggregations(
          aggName, Aggregation.of(a -> a.terms(t -> t.field(aggField))));
    }

    // Apply query filter
    buildSearchSourceFilter(queryFilter, searchRequestBuilder);

    return searchRequestBuilder.build();
  }

  public static Map<String, Object> searchEntityByKey(
      OpenSearchClient client,
      LineageDirection direction,
      String indexAlias,
      String keyName,
      Pair<String, String> hasToFqnPair,
      List<String> fieldsToRemove)
      throws IOException {
    Map<String, Object> result =
        searchEntitiesByKey(
            client,
            direction,
            indexAlias,
            keyName,
            Set.of(hasToFqnPair.getLeft()),
            0,
            1,
            fieldsToRemove);
    if (result.size() == 1) {
      return (Map<String, Object>) result.get(hasToFqnPair.getRight());
    } else {
      throw new SearchException(
          String.format(
              "Issue in Search Entity By Key: %s, Value Fqn: %s , Number of Hits: %s",
              keyName, hasToFqnPair.getRight(), result.size()));
    }
  }

  public static Map<String, Object> searchEntitiesByKey(
      OpenSearchClient client,
      LineageDirection direction,
      String indexAlias,
      String keyName,
      Set<String> keyValues,
      int from,
      int size,
      List<String> fieldsToRemove)
      throws IOException {
    Map<String, Object> result = new HashMap<>();
    SearchRequest searchRequest =
        getSearchRequest(
            direction,
            indexAlias,
            null,
            null,
            Map.of(keyName, keyValues),
            from,
            size,
            null,
            null,
            fieldsToRemove);
    SearchResponse<JsonData> searchResponse = client.search(searchRequest, JsonData.class);

    for (Hit<JsonData> hit : searchResponse.hits().hits()) {
      if (hit.source() != null) {
        Map<String, Object> esDoc = jsonDataToMap(hit.source());
        String fqn = esDoc.get(FQN_FIELD).toString();
        result.put(fqn, esDoc);
      }
    }
    return result;
  }

  public static SearchRequest getSearchRequest(
      LineageDirection direction,
      String indexAlias,
      String queryFilter,
      String aggName,
      Map<String, Set<String>> keysAndValues,
      int from,
      int size,
      Boolean deleted,
      List<String> fieldsToInclude,
      List<String> fieldsToRemove) {

    String index = Entity.getSearchRepository().getIndexOrAliasName(indexAlias);

    SearchRequest.Builder searchRequestBuilder = new SearchRequest.Builder().index(index);

    // Build source filter
    if (!listOrEmpty(fieldsToInclude).isEmpty() || !listOrEmpty(fieldsToRemove).isEmpty()) {
      searchRequestBuilder.source(
          s ->
              s.filter(
                  f ->
                      f.includes(listOrEmpty(fieldsToInclude))
                          .excludes(listOrEmpty(fieldsToRemove))));
    }

    // Build bool query with should clauses
    Query baseQuery = buildBoolQueriesWithShould(keysAndValues);

    if (!CommonUtil.nullOrEmpty(deleted)) {
      Query deletedQuery =
          Query.of(q -> q.term(t -> t.field("deleted").value(FieldValue.of(deleted))));
      final Query finalBaseQuery = baseQuery;
      baseQuery = Query.of(q -> q.bool(b -> b.must(finalBaseQuery).must(deletedQuery)));
    }

    searchRequestBuilder.query(baseQuery);
    searchRequestBuilder.from(from);
    searchRequestBuilder.size(size);

    // Add aggregation if needed
    if (!nullOrEmpty(aggName)) {
      String aggField = getLineageDirectionAggregationField(direction);
      searchRequestBuilder.aggregations(
          aggName, Aggregation.of(a -> a.terms(t -> t.field(aggField))));
    }

    // Apply query filter
    buildSearchSourceFilter(queryFilter, searchRequestBuilder);

    return searchRequestBuilder.build();
  }

  public static SearchResponse<JsonData> searchEntities(
      OpenSearchClient client, String index, String queryFilter, Boolean deleted)
      throws IOException {
    String indexName = Entity.getSearchRepository().getIndexOrAliasName(index);

    Query deletedQuery =
        Query.of(
            q ->
                q.term(
                    t ->
                        t.field("deleted").value(FieldValue.of(!nullOrEmpty(deleted) && deleted))));

    SearchRequest.Builder searchRequestBuilder =
        new SearchRequest.Builder().index(indexName).query(deletedQuery).size(10000);

    // Apply query filter
    buildSearchSourceFilter(queryFilter, searchRequestBuilder);

    return client.search(searchRequestBuilder.build(), JsonData.class);
  }

  private static Query buildBoolQueriesWithShould(Map<String, Set<String>> keysAndValues) {
    BoolQuery.Builder boolQuery = new BoolQuery.Builder();

    keysAndValues.forEach(
        (key, values) -> {
          List<FieldValue> fieldValues =
              values.stream().map(FieldValue::of).collect(Collectors.toList());
          boolQuery.should(
              Query.of(q -> q.terms(t -> t.field(key).terms(tv -> tv.value(fieldValues)))));
        });

    boolQuery.minimumShouldMatch("1");
    return Query.of(q -> q.bool(boolQuery.build()));
  }

  private static void buildSearchSourceFilter(
      String queryFilter, SearchRequest.Builder searchRequestBuilder) {
    if (!nullOrEmpty(queryFilter) && !queryFilter.equals("{}")) {
      try {
        Query filterQuery;
        if (queryFilter.trim().startsWith("{")) {
          String queryToProcess = parseJsonQuery(queryFilter);
          filterQuery = Query.of(q -> q.wrapper(w -> w.query(queryToProcess)));
        } else {
          filterQuery = Query.of(q -> q.queryString(qs -> qs.query(queryFilter)));
        }
        searchRequestBuilder.postFilter(filterQuery);
      } catch (Exception ex) {
        LOG.error("Error parsing query_filter from query parameters, ignoring filter", ex);
      }
    }
  }
}
