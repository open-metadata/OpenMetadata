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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.ws.rs.core.Response;
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

      Integer totalCount = fetchTotalCount(queryFilter);

      if (totalCount == 0) {
        return new InheritedFieldResult(Collections.emptyList(), 0);
      }

      if (query.getSize() == 0) {
        return new InheritedFieldResult(Collections.emptyList(), totalCount);
      }

      int entitiesToFetch =
          query.getSize() > 0 ? Math.min(query.getSize(), totalCount) : totalCount;

      List<EntityReference> allEntities = new ArrayList<>();
      int currentFrom = query.getFrom();

      while (allEntities.size() < entitiesToFetch) {
        int batchSize = Math.min(MAX_PAGE_SIZE, entitiesToFetch - allEntities.size());

        SearchRequest searchRequest = buildSearchRequest(currentFrom, batchSize, queryFilter, true);

        Response response = searchRepository.search(searchRequest, null);
        String responseBody = extractResponseBody(response);
        JsonNode searchResponse = JsonUtils.readTree(responseBody);

        List<EntityReference> batchEntities =
            extractEntityReferencesFromSearchResponse(searchResponse);
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

  private Integer fetchTotalCount(String queryFilter) throws Exception {
    SearchRequest countRequest = buildSearchRequest(0, 0, queryFilter, false);

    Response response = searchRepository.search(countRequest, null);
    String responseBody = extractResponseBody(response);
    JsonNode searchResponse = JsonUtils.readTree(responseBody);

    return extractTotalCountFromSearchResponse(searchResponse);
  }

  @Override
  public Integer getCountForField(InheritedFieldQuery query, Supplier<Integer> fallback) {
    try {
      if (isSearchUnavailable()) {
        return fallback.get();
      }

      String queryFilter = getQueryFilter(query);
      SearchRequest searchRequest = buildSearchRequest(0, 0, queryFilter, false);

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
    ObjectNode modifiedDocument = document.deepCopy();
    if (modifiedDocument.has(ENTITY_TYPE_KEY) && !modifiedDocument.has(TYPE_KEY)) {
      modifiedDocument.set(TYPE_KEY, modifiedDocument.get(ENTITY_TYPE_KEY));
      modifiedDocument.remove(ENTITY_TYPE_KEY);
    }

    ObjectMapper mapper = JsonUtils.getObjectMapper().copy();
    mapper.configure(
        com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    return mapper.readValue(modifiedDocument.toString(), EntityReference.class);
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
      int from, int size, String queryFilter, boolean fetchSource) {
    SearchRequest searchRequest = new SearchRequest();
    searchRequest.setIndex(searchRepository.getIndexOrAliasName(GLOBAL_SEARCH_ALIAS));
    searchRequest.setQuery(EMPTY_QUERY);
    searchRequest.setFrom(from);
    searchRequest.setSize(size);
    searchRequest.setQueryFilter(queryFilter);
    searchRequest.setTrackTotalHits(true);
    searchRequest.setFetchSource(fetchSource);
    return searchRequest;
  }
}
