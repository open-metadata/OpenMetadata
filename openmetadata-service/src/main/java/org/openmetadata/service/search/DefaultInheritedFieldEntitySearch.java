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

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class DefaultInheritedFieldEntitySearch implements InheritedFieldEntitySearch {

  private static final int MAX_PAGE_SIZE = 1000;
  private static final String EMPTY_QUERY = "";
  private static final String EMPTY_JSON = "{}";

  // Elasticsearch/OpenSearch response field names
  private static final String HITS_KEY = "hits";
  private static final String SOURCE_KEY = "_source";
  private static final String TOTAL_KEY = "total";
  private static final String VALUE_KEY = "value";
  private static final String ENTITY_TYPE_KEY = "entityType";
  private static final String TYPE_KEY = "type";

  private static final List<String> ENTITY_REFERENCE_FIELDS;
  private static final ObjectMapper ENTITY_REF_MAPPER;

  static {
    ENTITY_REF_MAPPER = JsonUtils.getObjectMapper().copy();
    ENTITY_REF_MAPPER.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    // Extract field names to limit ES response payload - only fetch required fields from ES_source
    ENTITY_REFERENCE_FIELDS = extractEntityReferenceFieldNames();
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
      int currentFrom = query.getFrom();

      // Get total count from first batch response instead of separate count query
      int batchSize = MAX_PAGE_SIZE;
      SearchRequest searchRequest =
          buildSearchRequest(currentFrom, batchSize, queryFilter, true, ENTITY_REFERENCE_FIELDS);

      Response response = searchRepository.search(searchRequest, null);
      String responseBody = extractResponseBody(response);
      JsonNode searchResponse = JsonUtils.readTree(responseBody);

      int totalCount = extractTotalCountFromSearchResponse(searchResponse);

      if (totalCount == 0) {
        return new InheritedFieldResult(Collections.emptyList(), 0);
      }

      List<EntityReference> batchEntities =
          extractEntityReferencesFromSearchResponse(searchResponse);
      List<EntityReference> allEntities = new ArrayList<>(batchEntities);
      currentFrom += batchSize;

      while (allEntities.size() < totalCount) {
        batchSize = Math.min(MAX_PAGE_SIZE, totalCount - allEntities.size());

        searchRequest =
            buildSearchRequest(currentFrom, batchSize, queryFilter, true, ENTITY_REFERENCE_FIELDS);

        response = searchRepository.search(searchRequest, null);
        responseBody = extractResponseBody(response);
        searchResponse = JsonUtils.readTree(responseBody);

        batchEntities = extractEntityReferencesFromSearchResponse(searchResponse);
        if (batchEntities.isEmpty()) {
          break;
        }

        allEntities.addAll(batchEntities);
        currentFrom += batchSize;
      }

      return new InheritedFieldResult(allEntities, totalCount);

    } catch (Exception e) {
      LOG.debug("Failed to fetch entities for inherited field, using fallback", e);
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
      SearchRequest searchRequest = buildSearchRequest(0, 0, queryFilter, false, null);

      Response response = searchRepository.search(searchRequest, null);

      String responseBody = extractResponseBody(response);
      JsonNode searchResponse = JsonUtils.readTree(responseBody);
      return extractTotalCountFromSearchResponse(searchResponse);

    } catch (Exception e) {
      LOG.debug("Failed to get count for inherited field, using fallback", e);
      return fallback.get();
    }
  }

  private String getQueryFilter(InheritedFieldQuery query) {
    return switch (query.getFilterType()) {
      case DOMAIN_ASSETS -> QueryFilterBuilder.buildDomainAssetsFilter(query);
      case OWNER_ASSETS -> QueryFilterBuilder.buildOwnerAssetsFilter(query);
      case TAG_ASSETS -> QueryFilterBuilder.buildTagAssetsFilter(query);
      case GENERIC -> QueryFilterBuilder.buildGenericFilter(query);
    };
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

  private EntityReference extractEntityReferenceFromDocument(JsonNode document) throws Exception {
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
      int from, int size, String queryFilter, boolean fetchSource, List<String> includeFields) {
    SearchRequest searchRequest = new SearchRequest();
    searchRequest.setIndex(searchRepository.getIndexOrAliasName(GLOBAL_SEARCH_ALIAS));
    searchRequest.setQuery(EMPTY_QUERY);
    searchRequest.setFrom(from);
    searchRequest.setSize(size);
    searchRequest.setQueryFilter(queryFilter);
    searchRequest.setTrackTotalHits(true);
    searchRequest.setFetchSource(fetchSource);

    if (includeFields != null && !includeFields.isEmpty()) {
      searchRequest.setIncludeSourceFields(includeFields);
    }

    return searchRequest;
  }
}
