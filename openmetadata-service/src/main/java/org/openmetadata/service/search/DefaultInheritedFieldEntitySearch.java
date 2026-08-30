/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.search;

import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchConstants.DEFAULT_SORT_FIELD;
import static org.openmetadata.service.search.SearchConstants.DEFAULT_SORT_ORDER;
import static org.openmetadata.service.search.SearchConstants.GLOSSARY_ASSET_SORT_FIELD;
import static org.openmetadata.service.search.SearchConstants.GLOSSARY_ASSET_SORT_ORDER;
import static org.openmetadata.service.search.SearchConstants.TAGS_FQN;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.json.JsonArray;
import jakarta.json.JsonNumber;
import jakarta.json.JsonObject;
import jakarta.json.JsonString;
import jakarta.json.JsonValue;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.OntologyStudioAsset;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@Slf4j
public class DefaultInheritedFieldEntitySearch implements InheritedFieldEntitySearch {

  private static final int MAX_PAGE_SIZE = 1000;
  private static final int MAX_STUDIO_ASSET_PREVIEW_SIZE = 4;
  private static final int MAX_STUDIO_TERM_BUCKETS = 60;
  private static final String EMPTY_QUERY = "";
  private static final String EMPTY_JSON = "{}";

  // Elasticsearch/OpenSearch response field names
  private static final String HITS_KEY = "hits";
  private static final String SOURCE_KEY = "_source";
  private static final String TOTAL_KEY = "total";
  private static final String VALUE_KEY = "value";
  private static final String ENTITY_TYPE_KEY = "entityType";
  private static final String TYPE_KEY = "type";
  private static final String STUDIO_ASSETS_AGGREGATION = "studio_assets";
  private static final String STUDIO_TERMS_AGGREGATION = "studio_terms";

  private static final List<String> ENTITY_REFERENCE_FIELDS;
  private static final List<String> STUDIO_ASSET_FIELDS;
  private static final ObjectMapper ENTITY_REF_MAPPER;

  static {
    ENTITY_REF_MAPPER = JsonUtils.getObjectMapper().copy();
    ENTITY_REF_MAPPER.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    // Extract field names to limit ES response payload - only fetch required fields from ES_source
    ENTITY_REFERENCE_FIELDS = extractEntityReferenceFieldNames();
    List<String> studioAssetFields = new ArrayList<>(ENTITY_REFERENCE_FIELDS);
    studioAssetFields.addAll(List.of("service", "serviceType", "columnNames"));
    STUDIO_ASSET_FIELDS = List.copyOf(studioAssetFields);
  }

  private static List<String> extractEntityReferenceFieldNames() {
    List<String> fieldNames = new ArrayList<>();
    for (Field field : EntityReference.class.getDeclaredFields()) {
      JsonProperty annotation = field.getAnnotation(JsonProperty.class);
      if (annotation != null) {
        String fieldName = annotation.value();
        String searchFieldName = TYPE_KEY.equals(fieldName) ? ENTITY_TYPE_KEY : fieldName;
        fieldNames.add(searchFieldName);
      }
    }
    return Collections.unmodifiableList(fieldNames);
  }

  private final SearchRepository searchRepository;

  public DefaultInheritedFieldEntitySearch(SearchRepository searchRepository) {
    this.searchRepository = searchRepository;
  }

  @Override
  public InheritedFieldResult getEntitiesForField(
      InheritedFieldQuery query, Supplier<InheritedFieldResult> fallback) {
    try {
      if (isSearchUnavailable()) {
        return fallback.get();
      }

      String queryFilter = getQueryFilter(query);
      int offset = query.getFrom();
      int limit = query.getSize();

      // True pagination - cap limit at MAX_PAGE_SIZE for performance
      // This ensures we never fetch more than 1000 records in a single request
      int effectiveLimit = Math.min(limit, MAX_PAGE_SIZE);

      SearchRequest searchRequest =
          buildSearchRequest(
              offset,
              effectiveLimit,
              queryFilter,
              true,
              ENTITY_REFERENCE_FIELDS,
              query.getSortField(),
              query.getSortOrder());

      Response response = searchRepository.search(searchRequest, null);
      String responseBody = extractResponseBody(response);
      JsonNode searchResponse = JsonUtils.readTree(responseBody);

      int totalCount = extractTotalCountFromSearchResponse(searchResponse);

      if (totalCount == 0) {
        return new InheritedFieldResult(Collections.emptyList(), 0);
      }

      // Extract entities from response
      List<EntityReference> results = extractEntityReferencesFromSearchResponse(searchResponse);

      return new InheritedFieldResult(results, totalCount);

    } catch (Exception e) {
      LOG.info("Failed to fetch entities for inherited field, using fallback", e);
      return fallback.get();
    }
  }

  @Override
  public Integer getCountForField(InheritedFieldQuery query, Supplier<Integer> fallback) {
    try {
      if (isSearchUnavailable()) {
        return fallback.get();
      }

      String queryFilter = getQueryFilter(query);
      // For count queries, sorting doesn't matter - using defaults
      SearchRequest searchRequest =
          buildSearchRequest(
              0, 0, queryFilter, false, null, DEFAULT_SORT_FIELD, DEFAULT_SORT_ORDER);

      Response response = searchRepository.search(searchRequest, null);

      String responseBody = extractResponseBody(response);
      JsonNode searchResponse = JsonUtils.readTree(responseBody);
      return extractTotalCountFromSearchResponse(searchResponse);
    } catch (Exception e) {
      LOG.info("Failed to get count for inherited field, using fallback", e);
      return fallback.get();
    }
  }

  private String extractResponseBody(Response response) {
    Object entity = response.getEntity();
    return entity != null ? entity.toString() : EMPTY_JSON;
  }

  private List<EntityReference> extractEntityReferencesFromSearchResponse(JsonNode searchResponse) {
    List<EntityReference> entities = new ArrayList<>();

    JsonNode searchResults = searchResponse.path(HITS_KEY).path(HITS_KEY);
    if (!searchResults.isArray()) {
      return entities;
    }

    for (JsonNode searchHit : searchResults) {
      JsonNode documentSource = searchHit.path(SOURCE_KEY);
      if (documentSource.isMissingNode()) {
        continue;
      }

      try {
        EntityReference entityRef = extractEntityReferenceFromDocument(documentSource);
        entities.add(entityRef);
      } catch (Exception e) {
        LOG.warn("Failed to extract EntityReference from document: {}", e.getMessage());
      }
    }
    return entities;
  }

  private EntityReference extractEntityReferenceFromDocument(JsonNode document)
      throws JsonProcessingException {
    // ES returns 'entityType' but EntityReference expects 'type'
    // Since we explicitly request 'entityType' in ENTITY_REFERENCE_FIELDS, we always need to remap
    if (!document.has(TYPE_KEY) && document.has(ENTITY_TYPE_KEY)) {
      ObjectNode mutableDoc = (ObjectNode) document;
      mutableDoc.set(TYPE_KEY, mutableDoc.get(ENTITY_TYPE_KEY));
      mutableDoc.remove(ENTITY_TYPE_KEY);
    }

    return ENTITY_REF_MAPPER.treeToValue(document, EntityReference.class);
  }

  private Integer extractTotalCountFromSearchResponse(JsonNode searchResponse) {
    JsonNode total = searchResponse.path(HITS_KEY).path(TOTAL_KEY);
    if (total.has(VALUE_KEY)) {
      return total.get(VALUE_KEY).asInt();
    }
    return total.asInt(0);
  }

  private boolean isSearchUnavailable() {
    try {
      if (searchRepository == null
          || searchRepository.getSearchClient() == null
          || !searchRepository.getSearchClient().isClientAvailable()) {
        return true;
      }

      String indexName = searchRepository.getIndexOrAliasName(GLOBAL_SEARCH_ALIAS);
      return indexName == null || indexName.isEmpty();
    } catch (Exception e) {
      return true;
    }
  }

  private SearchRequest buildSearchRequest(
      int from,
      int size,
      String queryFilter,
      boolean fetchSource,
      List<String> includeFields,
      String sortField,
      String sortOrder) {
    SearchRequest searchRequest = new SearchRequest();
    searchRequest.setIndex(searchRepository.getIndexOrAliasName(GLOBAL_SEARCH_ALIAS));
    searchRequest.setQuery(EMPTY_QUERY);
    searchRequest.setFrom(from);
    searchRequest.setSize(size);
    searchRequest.setQueryFilter(queryFilter);
    searchRequest.setTrackTotalHits(true);
    searchRequest.setFetchSource(fetchSource);

    // Use provided sorting or default to _score desc
    searchRequest.setSortFieldParam(sortField != null ? sortField : DEFAULT_SORT_FIELD);
    searchRequest.setSortOrder(sortOrder != null ? sortOrder : DEFAULT_SORT_ORDER);

    if (includeFields != null && !includeFields.isEmpty()) {
      searchRequest.setIncludeSourceFields(includeFields);
    }

    return searchRequest;
  }

  @Override
  public Map<String, Integer> getAggregatedCountsByField(String fieldPath, String queryFilter) {
    return getAggregatedCountsByField(fieldPath, queryFilter, 100);
  }

  @Override
  public Map<String, Integer> getAggregatedCountsByField(
      String fieldPath, String queryFilter, int size) {
    try {
      if (isSearchUnavailable()) {
        LOG.warn("Search unavailable for aggregated counts");
        return Collections.emptyMap();
      }

      LOG.info("Aggregation field: {}, query: {}, size: {}", fieldPath, queryFilter, size);

      SearchAggregationNode termsNode =
          SearchAggregation.terms("field_aggregation", fieldPath, size);

      SearchAggregationNode aggregationNode;
      String nestedPath = getNestedPath(fieldPath);
      if (nestedPath != null) {
        aggregationNode = SearchAggregation.nested("nested_wrapper", nestedPath);
        aggregationNode.addChild(termsNode);
      } else {
        aggregationNode = termsNode;
      }
      SearchAggregation searchAggregation = SearchAggregation.fromTree(aggregationNode);

      JsonObject response =
          searchRepository.aggregate(
              queryFilter, GLOBAL_SEARCH_ALIAS, searchAggregation, new SearchListFilter());

      LOG.info("Aggregation response: {}", response);

      Map<String, Integer> result = parseAggregationResponse(response);
      LOG.info("Parsed {} counts", result.size());

      return result;

    } catch (Exception e) {
      LOG.error("Failed to execute aggregated counts query", e);
      return Collections.emptyMap();
    }
  }

  @Override
  public List<OntologyStudioAssetBucket> getAssetBucketsForTerms(
      List<String> termFullyQualifiedNames, int assetPreviewSize, SubjectContext subjectContext) {
    if (isSearchUnavailable() || termFullyQualifiedNames.isEmpty()) {
      return List.of();
    }

    List<String> boundedTerms =
        termFullyQualifiedNames.stream().distinct().limit(MAX_STUDIO_TERM_BUCKETS).toList();
    int boundedPreviewSize = Math.clamp(assetPreviewSize, 1, MAX_STUDIO_ASSET_PREVIEW_SIZE);

    try {
      JsonObject response =
          executeStudioAssetAggregation(boundedTerms, boundedPreviewSize, subjectContext);
      return parseStudioAssetBuckets(response, boundedTerms);
    } catch (IOException | RuntimeException exception) {
      LOG.warn("Failed to fetch Ontology Studio asset previews", exception);
      return List.of();
    }
  }

  @Override
  public OntologyStudioAssetResult getAssetPreviewsForField(
      InheritedFieldQuery query,
      SubjectContext subjectContext,
      Supplier<OntologyStudioAssetResult> fallback) {
    if (isSearchUnavailable()) {
      return fallback.get();
    }

    try {
      SearchRequest request = buildStudioAssetSearchRequest(query);
      Response response = searchRepository.search(request, subjectContext);
      JsonNode searchResponse = JsonUtils.readTree(extractResponseBody(response));
      return new OntologyStudioAssetResult(
          extractStudioAssets(searchResponse), extractTotalCountFromSearchResponse(searchResponse));
    } catch (IOException | RuntimeException exception) {
      LOG.warn("Failed to fetch Ontology Studio assets", exception);
      return fallback.get();
    }
  }

  private SearchRequest buildStudioAssetSearchRequest(InheritedFieldQuery query) {
    return buildSearchRequest(
        query.getFrom(),
        Math.min(query.getSize(), MAX_PAGE_SIZE),
        getQueryFilter(query),
        true,
        STUDIO_ASSET_FIELDS,
        query.getSortField(),
        query.getSortOrder());
  }

  private List<OntologyStudioAsset> extractStudioAssets(JsonNode searchResponse) {
    List<OntologyStudioAsset> assets = new ArrayList<>();
    for (JsonNode hit : searchResponse.path(HITS_KEY).path(HITS_KEY)) {
      try {
        assets.add(toStudioAsset(hit.path(SOURCE_KEY)));
      } catch (JsonProcessingException | IllegalArgumentException exception) {
        LOG.warn("Skipping malformed Ontology Studio asset", exception);
      }
    }
    return List.copyOf(assets);
  }

  private JsonObject executeStudioAssetAggregation(
      List<String> termFqns, int assetPreviewSize, SubjectContext subjectContext)
      throws IOException {
    SearchAggregationNode terms =
        SearchAggregation.terms(
            STUDIO_TERMS_AGGREGATION,
            TAGS_FQN,
            termFqns.size(),
            termFqns.stream().map(DefaultInheritedFieldEntitySearch::normalizeTermFqn).toList());
    terms.addChild(
        SearchAggregation.topHits(
            STUDIO_ASSETS_AGGREGATION,
            assetPreviewSize,
            GLOSSARY_ASSET_SORT_FIELD,
            GLOSSARY_ASSET_SORT_ORDER,
            STUDIO_ASSET_FIELDS));
    SearchAggregation aggregation = SearchAggregation.fromTree(terms);
    String filter = QueryFilterBuilder.buildGenericAssetsCountFilter(TAGS_FQN, false);
    return searchRepository.aggregate(
        filter, GLOBAL_SEARCH_ALIAS, aggregation, new SearchListFilter(), subjectContext);
  }

  private List<OntologyStudioAssetBucket> parseStudioAssetBuckets(
      JsonObject response, List<String> requestedTermFqns) {
    JsonObject termsAggregation = findObject(response, STUDIO_TERMS_AGGREGATION);
    if (termsAggregation == null || !termsAggregation.containsKey("buckets")) {
      return List.of();
    }

    List<OntologyStudioAssetBucket> buckets = new ArrayList<>();
    for (JsonValue bucketValue : termsAggregation.getJsonArray("buckets")) {
      JsonObject bucket = bucketValue.asJsonObject();
      buckets.add(
          new OntologyStudioAssetBucket(
              requestedTermFqn(bucket.getString("key"), requestedTermFqns),
              bucket.getInt("doc_count"),
              parseStudioAssets(findObject(bucket, STUDIO_ASSETS_AGGREGATION))));
    }
    return List.copyOf(buckets);
  }

  private static String requestedTermFqn(String bucketKey, List<String> requestedTermFqns) {
    final String normalizedBucketKey = normalizeTermFqn(bucketKey);
    return requestedTermFqns.stream()
        .filter(termFqn -> normalizeTermFqn(termFqn).equals(normalizedBucketKey))
        .findFirst()
        .orElse(bucketKey);
  }

  private static String normalizeTermFqn(String termFqn) {
    return termFqn.toLowerCase(Locale.ROOT);
  }

  private List<OntologyStudioAsset> parseStudioAssets(JsonObject topHits) {
    if (topHits == null) {
      return List.of();
    }

    JsonArray hits = topHits.getJsonObject(HITS_KEY).getJsonArray(HITS_KEY);
    List<OntologyStudioAsset> assets = new ArrayList<>();
    for (JsonValue hitValue : hits) {
      JsonObject source = hitValue.asJsonObject().getJsonObject(SOURCE_KEY);
      try {
        assets.add(toStudioAsset(JsonUtils.readTree(source.toString())));
      } catch (JsonProcessingException | IllegalArgumentException exception) {
        LOG.warn("Skipping malformed Ontology Studio asset preview", exception);
      }
    }
    return List.copyOf(assets);
  }

  private OntologyStudioAsset toStudioAsset(JsonNode document) throws JsonProcessingException {
    EntityReference entity = extractEntityReferenceFromDocument(document.deepCopy());
    EntityReference service = extractOptionalReference(document.path("service"));
    String serviceType = optionalText(document.path("serviceType"));
    Integer columnCount = assetColumnCount(document);
    return new OntologyStudioAsset()
        .withEntity(entity)
        .withService(service)
        .withServiceType(serviceType)
        .withColumnCount(columnCount);
  }

  private EntityReference extractOptionalReference(JsonNode node) throws JsonProcessingException {
    return node.isObject() ? ENTITY_REF_MAPPER.treeToValue(node, EntityReference.class) : null;
  }

  private static String optionalText(JsonNode node) {
    return node.isTextual() && !node.textValue().isBlank() ? node.textValue() : null;
  }

  private static Integer assetColumnCount(JsonNode document) {
    JsonNode columnNames = document.path("columnNames");
    JsonNode columns = document.path("columns");
    if (columnNames.isArray()) {
      return columnNames.size();
    }
    return columns.isArray() ? columns.size() : null;
  }

  private static JsonObject findObject(JsonObject parent, String name) {
    if (parent == null) {
      return null;
    }
    for (String key : parent.keySet()) {
      if (key.equals(name) || key.endsWith("#" + name)) {
        return parent.getJsonObject(key);
      }
    }
    return null;
  }

  private String getQueryFilter(InheritedFieldQuery query) {
    return switch (query.getFilterType()) {
      case DOMAIN_ASSETS -> QueryFilterBuilder.buildDomainAssetsFilter(query);
      case OWNER_ASSETS -> QueryFilterBuilder.buildOwnerAssetsFilter(query);
      case TAG_ASSETS -> QueryFilterBuilder.buildTagAssetsFilter(query);
      case USER_ASSETS -> QueryFilterBuilder.buildUserAssetsFilter(query);
      case GENERIC -> QueryFilterBuilder.buildGenericFilter(query);
    };
  }

  private Map<String, Integer> parseAggregationResponse(JsonObject response) {
    Map<String, Integer> countsMap = new HashMap<>();

    if (response == null) {
      return countsMap;
    }

    JsonObject container = response;

    // If wrapped in a nested aggregation, traverse into it first
    for (String key : response.keySet()) {
      if (key.equals("nested_wrapper") || key.endsWith("#nested_wrapper")) {
        container = response.getJsonObject(key);
        break;
      }
    }

    JsonObject fieldAgg = null;
    for (String key : container.keySet()) {
      if (key.equals("field_aggregation") || key.endsWith("#field_aggregation")) {
        fieldAgg = container.getJsonObject(key);
        break;
      }
    }

    if (fieldAgg == null || !fieldAgg.containsKey("buckets")) {
      return countsMap;
    }

    JsonArray buckets = fieldAgg.getJsonArray("buckets");
    for (JsonValue bucketValue : buckets) {
      JsonObject bucket = bucketValue.asJsonObject();
      String key = ((JsonString) bucket.get("key")).getString();
      int count = ((JsonNumber) bucket.get("doc_count")).intValue();
      countsMap.put(key, count);
    }

    return countsMap;
  }

  private static final List<String> NESTED_FIELDS = List.of("owners");

  private static String getNestedPath(String fieldPath) {
    for (String nestedField : NESTED_FIELDS) {
      if (fieldPath.startsWith(nestedField + ".")) {
        return nestedField;
      }
    }
    return null;
  }
}
