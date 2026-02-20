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
import java.lang.reflect.Field;
import java.util.Base64;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.entityRelationship.EntityRelationshipDirection;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.json.JsonpDeserializer;
import os.org.opensearch.client.json.JsonpMapper;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.ErrorCause;
import os.org.opensearch.client.opensearch._types.FieldValue;
import os.org.opensearch.client.opensearch._types.ShardFailure;
import os.org.opensearch.client.opensearch._types.SortOrder;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregation;
import os.org.opensearch.client.opensearch._types.mapping.FieldType;
import os.org.opensearch.client.opensearch._types.query_dsl.BoolQuery;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;
import os.org.opensearch.client.opensearch.core.search.Hit;
import os.org.opensearch.client.util.ApiTypeHelper;
import os.org.opensearch.client.util.MissingRequiredPropertyException;
import sun.misc.Unsafe;

@Slf4j
public class OsUtils {

  private static final AtomicBoolean LENIENT_DESERIALIZERS_INSTALLED = new AtomicBoolean(false);

  /**
   * Installs lenient deserializers for OpenSearch response types that have required properties
   * not always present in server responses. This fixes opensearch-java 3.5.0 strict validation
   * of ShardFailure.primary which OpenSearch server does not always include.
   *
   * <p>The opensearch-java client deserializes responses on I/O threads (via CompletableFuture),
   * so the per-call ThreadLocal approach (DANGEROUS_disableRequiredPropertiesCheck) does not work.
   * Instead, we replace the ShardFailure deserializer with one that catches the validation error
   * and returns a ShardFailure with safe defaults.
   *
   * @see <a href="https://github.com/opensearch-project/opensearch-java/issues/551">opensearch-java#551</a>
   */
  @SuppressWarnings("sunapi")
  public static void installLenientDeserializers() {
    if (!LENIENT_DESERIALIZERS_INSTALLED.compareAndSet(false, true)) {
      return;
    }
    try {
      JsonpDeserializer<ShardFailure> original = ShardFailure._DESERIALIZER;
      JsonpDeserializer<ShardFailure> lenient =
          new JsonpDeserializer<>() {
            @Override
            public EnumSet<jakarta.json.stream.JsonParser.Event> nativeEvents() {
              return original.nativeEvents();
            }

            @Override
            public EnumSet<jakarta.json.stream.JsonParser.Event> acceptedEvents() {
              return original.acceptedEvents();
            }

            @Override
            public ShardFailure deserialize(
                jakarta.json.stream.JsonParser parser, JsonpMapper mapper) {
              try {
                return original.deserialize(parser, mapper);
              } catch (MissingRequiredPropertyException e) {
                LOG.debug(
                    "Ignoring missing required property in ShardFailure: {}", e.getPropertyName());
                return buildDefaultShardFailure(e.getPropertyName());
              }
            }

            @Override
            public ShardFailure deserialize(
                jakarta.json.stream.JsonParser parser,
                JsonpMapper mapper,
                jakarta.json.stream.JsonParser.Event event) {
              try {
                return original.deserialize(parser, mapper, event);
              } catch (MissingRequiredPropertyException e) {
                LOG.debug(
                    "Ignoring missing required property in ShardFailure: {}", e.getPropertyName());
                return buildDefaultShardFailure(e.getPropertyName());
              }
            }
          };

      Field unsafeField = Unsafe.class.getDeclaredField("theUnsafe");
      unsafeField.setAccessible(true);
      Unsafe unsafe = (Unsafe) unsafeField.get(null);

      Field deserializerField = ShardFailure.class.getDeclaredField("_DESERIALIZER");
      long offset = unsafe.staticFieldOffset(deserializerField);
      unsafe.putObjectVolatile(ShardFailure.class, offset, lenient);

      LOG.info("Installed lenient ShardFailure deserializer for OpenSearch compatibility");
    } catch (Exception e) {
      LENIENT_DESERIALIZERS_INSTALLED.set(false);
      LOG.warn(
          "Failed to install lenient ShardFailure deserializer. "
              + "OpenSearch responses with missing ShardFailure.primary may fail to deserialize.",
          e);
    }
  }

  private static ShardFailure buildDefaultShardFailure(String missingProperty) {
    return ShardFailure.of(
        b ->
            b.primary(false)
                .shard(0)
                .reason(
                    ErrorCause.of(
                        r ->
                            r.type("deserialization_fallback")
                                .reason("Missing required property: " + missingProperty))));
  }

  public static SearchResponse<JsonData> searchWithLenientDeserialization(
      OpenSearchClient client, SearchRequest request) throws IOException {
    try (ApiTypeHelper.DisabledChecksHandle ignored =
        ApiTypeHelper.DANGEROUS_disableRequiredPropertiesCheck(true)) {
      return client.search(request, JsonData.class);
    }
  }

  public static String toJsonStringLenient(SearchResponse<JsonData> response) {
    try (ApiTypeHelper.DisabledChecksHandle ignored =
        ApiTypeHelper.DANGEROUS_disableRequiredPropertiesCheck(true)) {
      return response.toJsonString();
    }
  }

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
    return JsonData.of(docMap);
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

  static {
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

    Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
    try {
      return searchWithLenientDeserialization(client, searchRequestBuilder.build());
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
      searchResponse = searchWithLenientDeserialization(client, searchRequest);
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
    Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
    SearchResponse<JsonData> searchResponse;
    try {
      searchResponse = searchWithLenientDeserialization(client, searchRequest);
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
      return searchWithLenientDeserialization(client, searchRequestBuilder.build());
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

    return rootNode.toString();
  }
}
