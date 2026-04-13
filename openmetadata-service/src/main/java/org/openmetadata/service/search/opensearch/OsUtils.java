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
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.nimbusds.jose.util.Pair;
import io.micrometer.core.instrument.Timer;
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
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.search.SearchRepository;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
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

  public static JsonData toJsonData(String doc) {
    Map<String, Object> docMap;
    try {
      docMap = mapper.readValue(doc, new TypeReference<>() {});
    } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
      throw new IllegalArgumentException("Invalid JSON input", e);
    }
    return JsonData.of(docMap, jsonpMapper);
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

  private static final ObjectMapper mapper;
  private static final JacksonJsonpMapper jsonpMapper;

  static {
    mapper = new ObjectMapper();
    jsonpMapper = new JacksonJsonpMapper(mapper);
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

    Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
    try {
      return client.search(
          searchRequestBuilder.build(), os.org.opensearch.client.json.JsonData.class);
    } finally {
      if (searchTimerSample != null) {
        RequestLatencyContext.endSearchOperation(searchTimerSample);
      }
    }
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
    Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
    SearchResponse<JsonData> searchResponse;
    try {
      searchResponse = client.search(searchRequest, JsonData.class);
    } finally {
      if (searchTimerSample != null) {
        RequestLatencyContext.endSearchOperation(searchTimerSample);
      }
    }

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
    return searchEntityByKey(
        client, direction, indexAlias, keyName, hasToFqnPair, null, fieldsToRemove);
  }

  public static Map<String, Object> searchEntityByKey(
      OpenSearchClient client,
      LineageDirection direction,
      String indexAlias,
      String keyName,
      Pair<String, String> hasToFqnPair,
      List<String> fieldsToInclude,
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
            fieldsToInclude,
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
    return searchEntitiesByKey(
        client, direction, indexAlias, keyName, keyValues, from, size, null, fieldsToRemove, null);
  }

  public static Map<String, Object> searchEntitiesByKey(
      OpenSearchClient client,
      LineageDirection direction,
      String indexAlias,
      String keyName,
      Set<String> keyValues,
      int from,
      int size,
      List<String> fieldsToInclude,
      List<String> fieldsToRemove)
      throws IOException {
    return searchEntitiesByKey(
        client,
        direction,
        indexAlias,
        keyName,
        keyValues,
        from,
        size,
        fieldsToInclude,
        fieldsToRemove,
        null);
  }

  public static Map<String, Object> searchEntitiesByKey(
      OpenSearchClient client,
      LineageDirection direction,
      String indexAlias,
      String keyName,
      Set<String> keyValues,
      int from,
      int size,
      List<String> fieldsToRemove,
      String queryFilter)
      throws IOException {
    return searchEntitiesByKey(
        client,
        direction,
        indexAlias,
        keyName,
        keyValues,
        from,
        size,
        null,
        fieldsToRemove,
        queryFilter);
  }

  public static Map<String, Object> searchEntitiesByKey(
      OpenSearchClient client,
      LineageDirection direction,
      String indexAlias,
      String keyName,
      Set<String> keyValues,
      int from,
      int size,
      List<String> fieldsToInclude,
      List<String> fieldsToRemove,
      String queryFilter)
      throws IOException {
    Map<String, Object> result = new HashMap<>();
    SearchRequest searchRequest =
        getSearchRequest(
            direction,
            indexAlias,
            queryFilter,
            null,
            Map.of(keyName, keyValues),
            from,
            size,
            null,
            fieldsToInclude,
            fieldsToRemove);
    Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
    SearchResponse<JsonData> searchResponse;
    try {
      searchResponse = client.search(searchRequest, JsonData.class);
    } finally {
      if (searchTimerSample != null) {
        RequestLatencyContext.endSearchOperation(searchTimerSample);
      }
    }

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

    Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
    try {
      return client.search(searchRequestBuilder.build(), JsonData.class);
    } finally {
      if (searchTimerSample != null) {
        RequestLatencyContext.endSearchOperation(searchTimerSample);
      }
    }
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

  public static JsonNode transformStemmerForOpenSearch(JsonNode settingsNode) {
    try {
      // Clone the settings to avoid modifying the original
      ObjectNode transformedNode = (ObjectNode) JsonUtils.readTree(settingsNode.toString());

      // Navigate to the filters section if it exists
      JsonNode analysisNode = transformedNode.path("analysis");
      if (!analysisNode.isMissingNode() && analysisNode.isObject()) {
        ObjectNode analysisObj = (ObjectNode) analysisNode;

        JsonNode filtersNode = analysisObj.path("filter");
        if (!filtersNode.isMissingNode() && filtersNode.isObject()) {
          ObjectNode filtersObj = (ObjectNode) filtersNode;

          // Transform stemmer configuration from Elasticsearch to OpenSearch format
          JsonNode omStemmerNode = filtersObj.path("om_stemmer");
          if (!omStemmerNode.isMissingNode() && omStemmerNode.has("type")) {
            String type = omStemmerNode.get("type").asText();
            if ("stemmer".equals(type) && omStemmerNode.has("name")) {
              String name = omStemmerNode.get("name").asText();
              // OpenSearch uses "language" instead of "name" for stemmer configuration
              ObjectNode newStemmerNode = JsonUtils.getObjectMapper().createObjectNode();
              newStemmerNode.put("type", "stemmer");
              newStemmerNode.put("language", name);

              // Replace the om_stemmer configuration
              filtersObj.set("om_stemmer", newStemmerNode);
            }
          } else {
            LOG.debug("No om_stemmer filter found in settings");
          }
        } else {
          LOG.debug("No filter section found in analysis settings");
        }
      } else {
        LOG.debug("No analysis section found in settings");
      }

      return transformedNode;
    } catch (Exception e) {
      LOG.warn("Failed to transform stemmer settings for OpenSearch, using original settings", e);
      return settingsNode;
    }
  }

  public static String enrichIndexMappingWithStemmer(String indexMappingContent) {
    if (nullOrEmpty(indexMappingContent)) {
      throw new IllegalArgumentException("Empty Index Mapping Content.");
    }
    JsonNode rootNode = JsonUtils.readTree(indexMappingContent);
    JsonNode settingsNode = rootNode.get("settings");

    if (settingsNode != null && !settingsNode.isNull()) {
      JsonNode transformedSettings = transformStemmerForOpenSearch(settingsNode);
      ((ObjectNode) rootNode).set("settings", transformedSettings);
    }

    return rootNode.toString();
  }

  /**
   * Transforms Elasticsearch field types to OpenSearch equivalents in mappings.
   * Currently handles: "flattened" -> "flat_object"
   *
   * @param mappingsNode The mappings JSON node
   * @return Transformed mappings node with OpenSearch-compatible types
   */
  public static JsonNode transformFieldTypesForOpenSearch(JsonNode mappingsNode) {
    try {
      ObjectNode transformedNode = (ObjectNode) JsonUtils.readTree(mappingsNode.toString());
      JsonNode propertiesNode = transformedNode.path("properties");
      if (!propertiesNode.isMissingNode() && propertiesNode.isObject()) {
        transformFieldTypesRecursive((ObjectNode) propertiesNode);
      }
      return transformedNode;
    } catch (Exception e) {
      LOG.warn(
          "Failed to transform field types for OpenSearch, using original mappings: {}",
          e.getMessage());
      return mappingsNode;
    }
  }

  private static void transformFieldTypesRecursive(ObjectNode propertiesNode) {
    propertiesNode
        .fields()
        .forEachRemaining(
            entry -> {
              JsonNode fieldDef = entry.getValue();
              if (fieldDef.isObject()) {
                ObjectNode fieldObj = (ObjectNode) fieldDef;

                // Transform "flattened" to "flat_object" for OpenSearch
                JsonNode typeNode = fieldObj.get("type");
                if (typeNode != null && "flattened".equals(typeNode.asText())) {
                  fieldObj.put("type", "flat_object");
                  LOG.debug(
                      "Transformed field '{}' from 'flattened' to 'flat_object'", entry.getKey());
                }

                // Recurse into nested properties
                JsonNode nestedProps = fieldObj.get("properties");
                if (nestedProps != null && nestedProps.isObject()) {
                  transformFieldTypesRecursive((ObjectNode) nestedProps);
                }
              }
            });
  }

  /**
   * Enriches index mapping content with OpenSearch-compatible transformations.
   * Applies both stemmer and field type transformations.
   *
   * @param indexMappingContent The original index mapping JSON content
   * @return Transformed index mapping content for OpenSearch
   */
  public static String enrichIndexMappingForOpenSearch(String indexMappingContent) {
    if (nullOrEmpty(indexMappingContent)) {
      throw new IllegalArgumentException("Empty Index Mapping Content.");
    }
    JsonNode rootNode = JsonUtils.readTree(indexMappingContent);

    // Transform settings (stemmer configuration)
    JsonNode settingsNode = rootNode.get("settings");
    if (settingsNode != null && !settingsNode.isNull()) {
      JsonNode transformedSettings = transformStemmerForOpenSearch(settingsNode);
      ((ObjectNode) rootNode).set("settings", transformedSettings);
    }

    // Transform mappings (field types like flattened -> flat_object)
    JsonNode mappingsNode = rootNode.get("mappings");
    if (mappingsNode != null && !mappingsNode.isNull()) {
      JsonNode transformedMappings = transformFieldTypesForOpenSearch(mappingsNode);
      ((ObjectNode) rootNode).set("mappings", transformedMappings);
    }

    // Add knn_vector settings for embedding-enabled indexes
    addKnnVectorSettings(rootNode);

    return rootNode.toString();
  }

  /**
   * Adds OpenSearch-specific knn_vector field and index settings for indexes that support
   * embeddings. Detects embedding support by the presence of a "fingerprint" field in mappings.
   * This keeps the static mapping files search-engine-agnostic while enabling vector search on
   * OpenSearch.
   *
   * <p>The embedding dimension is resolved from the active embedding client (source of truth),
   * not from index metadata. This ensures correct dimensions even on first enable (when existing
   * indexes have no {@code _meta}) and on model changes. If {@code _meta.embedding_dimension} is
   * present, it is validated against the client dimension to detect stale indexes that need a
   * reindex.
   */
  static void addKnnVectorSettings(JsonNode rootNode) {
    JsonNode properties = rootNode.path("mappings").path("properties");
    if (properties.isMissingNode() || !properties.has("fingerprint")) {
      return;
    }

    // The embedding client is the single source of truth for the vector dimension.
    // We do NOT fall back to _meta or a hardcoded default, because:
    // 1. On first enable, existing indexes won't have _meta yet
    // 2. On model change, _meta would carry the old (wrong) dimension
    // If the client is not available (embeddings disabled), we skip knn setup entirely.
    SearchRepository searchRepository = Entity.getSearchRepository();
    if (searchRepository == null
        || !searchRepository.isVectorEmbeddingEnabled()
        || searchRepository.getEmbeddingClient() == null) {
      return;
    }

    int dimension = searchRepository.getEmbeddingClient().getDimension();

    // If _meta.embedding_dimension exists, validate it matches the client.
    // A mismatch means the index was built with a different model/config and needs a reindex.
    JsonNode meta = rootNode.path("mappings").path("_meta");
    if (!meta.isMissingNode() && meta.has("embedding_dimension")) {
      int metaDimension = meta.get("embedding_dimension").asInt();
      if (metaDimension != dimension) {
        LOG.error(
            "Embedding dimension mismatch: _meta says {} but embedding client reports {}. "
                + "Using embedding client dimension. A reindex may be required.",
            metaDimension,
            dimension);
      }
    }

    JsonNode indexSettingsNode = rootNode.path("settings").path("index");
    if (!indexSettingsNode.isMissingNode() && indexSettingsNode.isObject()) {
      ObjectNode indexSettings = (ObjectNode) indexSettingsNode;
      indexSettings.put("knn", true);
      indexSettings.put("knn.algo_param.ef_search", 1000);
      indexSettings.put("knn.advanced.filtered_exact_search_threshold", 0);
    }

    ObjectMapper mapper = new ObjectMapper();
    ObjectNode embeddingNode = mapper.createObjectNode();
    embeddingNode.put("type", "knn_vector");
    embeddingNode.put("dimension", dimension);

    ObjectNode methodNode = mapper.createObjectNode();
    methodNode.put("name", "hnsw");
    methodNode.put("engine", "lucene");
    methodNode.put("space_type", "cosinesimil");

    ObjectNode paramsNode = mapper.createObjectNode();
    paramsNode.put("m", 48);
    paramsNode.put("ef_construction", 256);
    methodNode.set("parameters", paramsNode);

    embeddingNode.set("method", methodNode);
    ((ObjectNode) properties).set("embedding", embeddingNode);
  }
}
