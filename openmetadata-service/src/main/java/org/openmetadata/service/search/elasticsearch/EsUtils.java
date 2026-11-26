package org.openmetadata.service.search.elasticsearch;

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
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.FieldValue;
import es.co.elastic.clients.elasticsearch._types.SortOrder;
import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.mapping.FieldType;
import es.co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.elasticsearch.core.SearchResponse;
import es.co.elastic.clients.elasticsearch.core.search.Hit;
import es.co.elastic.clients.json.JsonData;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import io.micrometer.core.instrument.Timer;
import java.io.IOException;
import java.io.StringReader;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.entityRelationship.EntityRelationshipDirection;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.search.EmbeddingFieldUpdate;
import org.openmetadata.service.search.LiveEmbeddingField;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilder;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilderFactory;
import org.openmetadata.service.search.lineage.MissingLineageEntityException;
import org.openmetadata.service.search.security.ContextMemorySearchVisibility;
import org.openmetadata.service.search.vector.client.EmbeddingModel;
import org.openmetadata.service.util.LineageUtil;

@Slf4j
public class EsUtils {

  private static final ObjectMapper mapper;
  private static final JacksonJsonpMapper jsonpMapper;

  private static final ContextMemorySearchVisibility MEMORY_VISIBILITY =
      new ContextMemorySearchVisibility(new ElasticQueryBuilderFactory());

  static {
    mapper = new ObjectMapper();
    jsonpMapper = new JacksonJsonpMapper(mapper);
  }

  /**
   * ANDs the org-wide-only ContextMemory filter into a query built on a raw {@code
   * SearchRequest.Builder}. Non-memory documents are unaffected.
   */
  static Query restrictToOrgWideMemories(Query query) {
    Query memoryFilter =
        ((ElasticQueryBuilder) MEMORY_VISIBILITY.buildOrgWideOnlyFilter()).buildV2();
    return query == null
        ? memoryFilter
        : Query.of(q -> q.bool(b -> b.must(query).filter(memoryFilter)));
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
    } catch (JsonProcessingException e) {
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
    return queryToProcess;
  }

  public static String getEntityRelationshipAggregationField(
      EntityRelationshipDirection direction) {
    return direction == EntityRelationshipDirection.UPSTREAM
        ? FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD
        : DOWNSTREAM_ENTITY_RELATIONSHIP_KEY;
  }

  public static SearchResponse<JsonData> searchEntitiesWithLimitOffset(
      ElasticsearchClient client,
      String index,
      String queryFilter,
      int offset,
      int limit,
      boolean deleted)
      throws IOException {
    Query baseQuery =
        Query.of(q -> q.term(t -> t.field("deleted").value(!nullOrEmpty(deleted) && deleted)));

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
          filterQuery = Query.of(q -> q.withJson(new StringReader(queryToProcess)));
        } else {
          filterQuery = Query.of(q -> q.queryString(qs -> qs.query(queryFilter)));
        }
        searchRequestBuilder.query(q -> q.bool(b -> b.must(baseQuery).filter(filterQuery)));
      } catch (Exception ex) {
        LOG.error("Error parsing query_filter from query parameters, ignoring filter", ex);
      }
    }

    Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
    try {
      return client.search(searchRequestBuilder.build(), JsonData.class);
    } finally {
      if (searchTimerSample != null) {
        RequestLatencyContext.endSearchOperation(searchTimerSample);
      }
    }
  }

  public static Map<String, Object> searchEREntityByKey(
      ElasticsearchClient client,
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
      ElasticsearchClient client,
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
      Query deletedQuery = Query.of(q -> q.term(t -> t.field("deleted").value(deleted)));
      final Query finalBaseQuery = baseQuery;
      baseQuery = Query.of(q -> q.bool(b -> b.must(finalBaseQuery).must(deletedQuery)));
    }

    // Lineage and entity-relationship traversals query the global alias and hand the matched hit's
    // raw _source back as the node payload, with no SubjectContext to resolve memory visibility
    // against: only org-wide memories may surface as nodes.
    searchRequestBuilder.query(restrictToOrgWideMemories(baseQuery));
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
      ElasticsearchClient client,
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
      ElasticsearchClient client,
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
    if (result.isEmpty()) {
      throw new MissingLineageEntityException(hasToFqnPair.getRight());
    }
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
      ElasticsearchClient client,
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
      ElasticsearchClient client,
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
      ElasticsearchClient client,
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
      ElasticsearchClient client,
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

    LineageUtil.rejectTimedOutSearch(searchResponse.timedOut(), indexAlias);
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
      Query deletedQuery = Query.of(q -> q.term(t -> t.field("deleted").value(deleted)));
      final Query finalBaseQuery = baseQuery;
      baseQuery = Query.of(q -> q.bool(b -> b.must(finalBaseQuery).must(deletedQuery)));
    }

    // Lineage and entity-relationship traversals query the global alias and hand the matched hit's
    // raw _source back as the node payload, with no SubjectContext to resolve memory visibility
    // against: only org-wide memories may surface as nodes.
    searchRequestBuilder.query(restrictToOrgWideMemories(baseQuery));
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
      ElasticsearchClient client, String index, String queryFilter, Boolean deleted)
      throws IOException {
    String indexName = Entity.getSearchRepository().getIndexOrAliasName(index);

    Query deletedQuery =
        Query.of(q -> q.term(t -> t.field("deleted").value(!nullOrEmpty(deleted) && deleted)));

    // Platform lineage returns each hit's raw _source and runs without a SubjectContext, so it
    // cannot tell whose restricted memory a document is: only org-wide memories may come back.
    SearchRequest.Builder searchRequestBuilder =
        new SearchRequest.Builder()
            .index(indexName)
            .query(restrictToOrgWideMemories(deletedQuery))
            .size(10000);

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
          filterQuery = Query.of(q -> q.withJson(new StringReader(queryToProcess)));
        } else {
          filterQuery = Query.of(q -> q.queryString(qs -> qs.query(queryFilter)));
        }
        searchRequestBuilder.postFilter(filterQuery);
      } catch (Exception ex) {
        LOG.error("Error parsing query_filter from query parameters, ignoring filter", ex);
      }
    }
  }

  /**
   * Enriches an Elasticsearch index mapping with vector search support. When the mapping contains
   * a {@code fingerprint} field (the signal that this index stores embedded entity docs), injects a
   * {@code dense_vector} embedding field and records {@code _meta} with the model ID and dimension.
   *
   * <p>The model and its dimension come from the configured {@link EmbeddingModel}, known before
   * any embedding client exists. If embeddings are disabled, or the configuration names no valid
   * model, the mapping is returned unchanged.
   *
   * <p><b>Failure modes:</b>
   *
   * <ul>
   *   <li>{@link IllegalArgumentException}: {@code indexMappingContent} is null or empty.
   *   <li>{@link IllegalStateException}: the mapping content declares an embedding dimension
   *       (via {@code _meta.embedding_dimension} or {@code properties.embedding.dims}) that
   *       differs from the configured embedding model.
   * </ul>
   */
  public static String enrichIndexMappingForElasticsearch(String indexMappingContent) {
    return enrichIndexMapping(indexMappingContent, model -> EmbeddingFieldUpdate.DECLARE);
  }

  /**
   * As {@link #enrichIndexMappingForElasticsearch}, for a {@code PUT _mapping} on an existing index.
   * The live {@code embedding} field decides what the body carries ({@link EmbeddingFieldUpdate}):
   * the pinned field and the model in {@code _meta} when no index maps it yet, and neither when it
   * already holds the model's vectors, cannot hold them or cannot be read. Elasticsearch refuses to
   * change the options or the dimensions of an existing field and {@code PUT _mapping} is atomic,
   * so re-sending it would drop every other field in the body. The live field is read only when
   * the index is a vector index and embeddings are on.
   */
  public static String enrichIndexMappingForElasticsearchUpdate(
      String indexMappingContent, Supplier<LiveEmbeddingField> liveEmbedding) {
    return enrichIndexMapping(
        indexMappingContent, model -> EmbeddingFieldUpdate.decide(liveEmbedding.get(), model));
  }

  private static String enrichIndexMapping(
      String indexMappingContent, Function<EmbeddingModel, EmbeddingFieldUpdate> update) {
    if (nullOrEmpty(indexMappingContent)) {
      throw new IllegalArgumentException("Empty Index Mapping Content.");
    }
    JsonNode rootNode = JsonUtils.readTree(indexMappingContent);
    addDenseVectorSettings(rootNode, update);
    return rootNode.toString();
  }

  /** The vector field of entity indexes, declared only when embeddings are on. */
  static final String EMBEDDING_FIELD = LiveEmbeddingField.FIELD;

  static final String DENSE_VECTOR = "dense_vector";

  static final String DENSE_VECTOR_DIMENSIONS = "dims";

  /** HNSW graph options pinned to the OpenSearch values, so both engines build the same index. */
  static final int HNSW_M = 48;

  static final int HNSW_EF_CONSTRUCTION = 256;

  /**
   * The {@code embedding} field of an index created now: a float HNSW graph with {@code m} 48 and
   * {@code ef_construction} 256, the OpenSearch values, instead of the engine default, which
   * quantizes and changes with version and licence
   * (ADR:2026-11-23-elasticsearch-vector-fields-pin-their-index-options).
   */
  public static ObjectNode denseVectorMapping(int dimension) {
    ObjectNode indexOptions =
        mapper
            .createObjectNode()
            .put("type", "hnsw")
            .put("m", HNSW_M)
            .put("ef_construction", HNSW_EF_CONSTRUCTION);
    ObjectNode embedding =
        mapper
            .createObjectNode()
            .put("type", DENSE_VECTOR)
            .put(DENSE_VECTOR_DIMENSIONS, dimension)
            .put("index", true)
            .put("similarity", "cosine");
    embedding.set("index_options", indexOptions);
    return embedding;
  }

  static void addDenseVectorSettings(JsonNode rootNode) {
    addDenseVectorSettings(rootNode, model -> EmbeddingFieldUpdate.DECLARE);
  }

  private static void addDenseVectorSettings(
      JsonNode rootNode, Function<EmbeddingModel, EmbeddingFieldUpdate> update) {
    JsonNode properties = rootNode.path("mappings").path("properties");
    boolean vectorIndex = !properties.isMissingNode() && properties.has("fingerprint");
    EmbeddingModel model = EmbeddingFieldUpdate.activeEmbeddingModel().orElse(null);
    if (vectorIndex && model != null) {
      assertDeclaredDimensionsMatch(rootNode, properties.path(EMBEDDING_FIELD), model.dimension());
      applyEmbeddingUpdate((ObjectNode) rootNode.path("mappings"), update.apply(model), model);
    }
  }

  /**
   * The {@code PUT _mapping} body that declares the pinned {@code embedding} field for {@code
   * model}, with the model in {@code _meta}, on an existing vector index that maps none ({@link
   * EmbeddingFieldUpdate#DECLARE}).
   */
  public static String embeddingFieldDeclaration(EmbeddingModel model) {
    ObjectNode mappings = mapper.createObjectNode();
    mappings.putObject("properties");
    applyEmbeddingUpdate(mappings, EmbeddingFieldUpdate.DECLARE, model);
    return mappings.toString();
  }

  /**
   * Declares {@code embedding} when no index behind the target maps it yet; otherwise leaves it
   * out, so an existing field keeps the options it was created with. {@code _meta} records the
   * model only when the field is declared for it.
   */
  private static void applyEmbeddingUpdate(
      ObjectNode mappings, EmbeddingFieldUpdate update, EmbeddingModel model) {
    ObjectNode properties = (ObjectNode) mappings.path("properties");
    JsonNode declaredEmbedding = properties.remove(EMBEDDING_FIELD);
    if (update == EmbeddingFieldUpdate.DECLARE) {
      properties.set(EMBEDDING_FIELD, embeddingField(declaredEmbedding, model.dimension()));
    }
    update.applyModelMeta(mappings, model);
  }

  /**
   * The mapping content itself may declare a dimension, through {@code _meta.embedding_dimension}
   * or {@code properties.embedding.dims}. One that differs from the embedding model is a broken
   * mapping, not a live index to reconcile, so it fails.
   */
  private static void assertDeclaredDimensionsMatch(
      JsonNode rootNode, JsonNode declaredEmbedding, int dimension) {
    JsonNode declaredMeta = rootNode.path("mappings").path(LiveEmbeddingField.META);
    if (declaredMeta.has(LiveEmbeddingField.META_EMBEDDING_DIMENSION)) {
      assertDimensionMatches(
          declaredMeta.get(LiveEmbeddingField.META_EMBEDDING_DIMENSION).asInt(), dimension);
    }
    if (declaredEmbedding.has(DENSE_VECTOR_DIMENSIONS)) {
      assertDimensionMatches(declaredEmbedding.get(DENSE_VECTOR_DIMENSIONS).asInt(), dimension);
    }
  }

  /**
   * The {@code embedding} field to declare on an index that does not map it yet: the pinned
   * options, unless the mapping content declares the field with options of its own.
   */
  private static ObjectNode embeddingField(JsonNode declaredEmbedding, int dimension) {
    ObjectNode field = denseVectorMapping(dimension);
    if (declaredEmbedding != null && declaredEmbedding.has("index_options")) {
      field.set("index_options", declaredEmbedding.get("index_options").deepCopy());
    }
    return field;
  }

  private static void assertDimensionMatches(int declared, int client) {
    if (declared != client) {
      throw new IllegalStateException(
          String.format(
              "The index mapping declares embedding dimension %d, but the configured embedding "
                  + "model produces vectors of %d dimensions.",
              declared, client));
    }
  }
}
