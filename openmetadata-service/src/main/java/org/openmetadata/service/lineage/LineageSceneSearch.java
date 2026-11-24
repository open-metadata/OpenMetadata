/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.lineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.lineage.LineageSceneMapper.SERVICE_ENTITY_TYPES;
import static org.openmetadata.service.lineage.LineageSceneMapper.sourceFieldList;
import static org.openmetadata.service.lineage.LineageSceneQuery.assetFieldQuery;
import static org.openmetadata.service.lineage.LineageSceneQuery.assetTermsQuery;
import static org.openmetadata.service.lineage.LineageSceneQuery.containerQuery;
import static org.openmetadata.service.search.SearchClient.DATA_ASSET_SEARCH_ALIAS;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.LineageBand;
import org.openmetadata.schema.api.lineage.LineageLens;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

@Slf4j
final class LineageSceneSearch {
  private final SearchRepository repository;
  private final LineageSceneRequest request;

  LineageSceneSearch(SearchRepository repository, LineageSceneRequest request) {
    this.repository = repository;
    this.request = request;
  }

  static final List<String> ROOT_ASSET_ENTITY_TYPES =
      List.of(
          Entity.TABLE,
          Entity.TOPIC,
          Entity.DASHBOARD,
          Entity.DASHBOARD_DATA_MODEL,
          Entity.PIPELINE,
          Entity.STORED_PROCEDURE,
          Entity.MLMODEL,
          Entity.CONTAINER,
          Entity.SEARCH_INDEX,
          Entity.API_ENDPOINT,
          Entity.METRIC,
          Entity.DIRECTORY,
          Entity.FILE,
          Entity.SPREADSHEET,
          Entity.WORKSHEET);

  static final String SERVICE_FQN_KEYWORD_FIELD = "service.fullyQualifiedName.keyword";

  static final String DATABASE_FQN_KEYWORD_FIELD = "database.fullyQualifiedName.keyword";

  static final String DATABASE_SCHEMA_FQN_KEYWORD_FIELD =
      "databaseSchema.fullyQualifiedName.keyword";

  static final String DOMAINS_FQN_FIELD = "domains.fullyQualifiedName";

  private static final String DATA_PRODUCTS_FQN_FIELD = "dataProducts.fullyQualifiedName";

  static final String ENTITY_FQN_FIELD = "fullyQualifiedName";

  static final String UPSTREAM_LINEAGE_DOC_ID_FIELD = "upstreamLineage.docId";

  static final String UPSTREAM_LINEAGE_FROM_FQN_FIELD =
      "upstreamLineage.fromEntity.fullyQualifiedName.keyword";

  static String normalizedKey(String value) {
    return value == null ? "" : value.toLowerCase(Locale.ROOT);
  }

  boolean isDatabaseKeywordFieldMapped() throws IOException {
    return repository.isFieldMappedInIndex(Entity.TABLE, DATABASE_FQN_KEYWORD_FIELD);
  }

  static void logDatabaseReindexRequired() {
    LOG.warn(
        "Field {} is not mapped. Run Search Reindex to enable database-focused lineage scenes "
            + "and per-database lineage counts.",
        DATABASE_FQN_KEYWORD_FIELD);
  }

  static String focusedAssetFieldName(String entityType) {
    if (nullOrEmpty(entityType)) {
      return null;
    }
    if (SERVICE_ENTITY_TYPES.contains(entityType)) {
      return SERVICE_FQN_KEYWORD_FIELD;
    }
    return switch (entityType) {
      case Entity.DOMAIN -> DOMAINS_FQN_FIELD;
      case Entity.DATA_PRODUCT -> DATA_PRODUCTS_FQN_FIELD;
      case Entity.DATABASE -> DATABASE_FQN_KEYWORD_FIELD;
      case Entity.DATABASE_SCHEMA -> DATABASE_SCHEMA_FQN_KEYWORD_FIELD;
      default -> null;
    };
  }

  static String rootAssetFieldName(LineageLens lens) {
    return switch (lens) {
      case DOMAIN -> DOMAINS_FQN_FIELD;
      case DATA_PRODUCT -> DATA_PRODUCTS_FQN_FIELD;
      case SERVICE -> SERVICE_FQN_KEYWORD_FIELD;
    };
  }

  SearchRootAssetsResult searchRootAssets(
      String fieldName, String fieldValue, String index, int size) throws IOException {
    return search(
        index,
        size,
        sourceFieldList(request.band()),
        assetFieldQuery(fieldName, fieldValue, null, List.of(), request));
  }

  SearchRootAssetsResult searchFocusedAssets(
      String fieldName, String fieldValue, int size, String requiredExistsField)
      throws IOException {
    return search(
        DATA_ASSET_SEARCH_ALIAS,
        size,
        sourceFieldList(request.band()),
        assetFieldQuery(
            fieldName, fieldValue, requiredExistsField, ROOT_ASSET_ENTITY_TYPES, request));
  }

  SearchRootAssetsResult searchFeederDocuments(String focusFqn, int size) throws IOException {
    return search(
        DATA_ASSET_SEARCH_ALIAS,
        size,
        List.of("upstreamLineage"),
        assetFieldQuery(
            UPSTREAM_LINEAGE_FROM_FQN_FIELD, focusFqn + ".*", null, List.of(), request));
  }

  SearchRootAssetsResult searchAssetsByTerms(
      String fieldName, List<String> fieldValues, String index, int size) throws IOException {
    return search(
        index,
        size,
        sourceFieldList(request.band()),
        assetTermsQuery(fieldName, fieldValues, request));
  }

  SearchRootAssetsResult lookupContainers(
      String fieldName, String fieldValue, String index, int size) throws IOException {
    // Container documents provide labels for filtered descendant counts; asset predicates such
    // as a column tag must not be applied to the database/schema document itself.
    return search(
        index,
        size,
        sourceFieldList(LineageBand.ASSET),
        containerQuery(fieldName, fieldValue, request));
  }

  private SearchRootAssetsResult search(
      String index, int size, List<String> sourceIncludes, String queryFilter) throws IOException {
    try (Response response =
        repository.search(
            sceneAssetSearchRequest(
                repository.getIndexOrAliasName(index),
                request.includeDeleted(),
                size,
                sourceIncludes,
                queryFilter),
            request.subjectContext())) {
      return parseSearchAssets(response);
    }
  }

  static SearchRequest sceneAssetSearchRequest(
      String index,
      boolean includeDeleted,
      int size,
      List<String> sourceIncludes,
      String queryFilter) {
    return new SearchRequest()
        .withQuery("*")
        .withIndex(index)
        .withFrom(0)
        .withSize(size)
        .withQueryFilter(queryFilter)
        .withFetchSource(true)
        .withTrackTotalHits(true)
        .withDeleted(includeDeleted)
        .withIncludeSourceFields(sourceIncludes)
        .withIncludeAggregations(false);
  }

  private static SearchRootAssetsResult parseSearchAssets(Response response) {
    if (!(response.getEntity() instanceof String responseJson)) {
      return new SearchRootAssetsResult(List.of(), 0);
    }
    JsonNode responseRoot = JsonUtils.readTree(responseJson);
    JsonNode hits = responseRoot.path("hits").path("hits");
    if (!hits.isArray()) {
      return new SearchRootAssetsResult(List.of(), searchTotal(responseRoot));
    }
    List<Map<String, Object>> assets = new ArrayList<>();
    for (JsonNode hit : hits) {
      JsonNode source = hit.path("_source");
      if (!source.isObject()) {
        continue;
      }
      assets.add(JsonUtils.convertValue(source, new TypeReference<Map<String, Object>>() {}));
    }
    return new SearchRootAssetsResult(assets, searchTotal(responseRoot));
  }

  private static int searchTotal(JsonNode responseRoot) {
    JsonNode total = responseRoot.path("hits").path("total");
    if (total.isInt() || total.isLong()) {
      return total.asInt();
    }
    return total.path("value").asInt(0);
  }

  record SearchRootAssetsResult(List<Map<String, Object>> assets, int total) {}
}
