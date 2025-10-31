package org.openmetadata.service.search.opensearch;

import static jakarta.ws.rs.core.Response.Status.OK;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;

import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonObject;
import jakarta.json.JsonReader;
import jakarta.json.JsonValue;
import jakarta.json.stream.JsonParser;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.sdk.exception.SearchIndexNotFoundException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchManagementClient;
import org.openmetadata.service.search.SearchResultListMapper;
import org.openmetadata.service.search.SearchSortFilter;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.json.JsonpMapper;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.FieldValue;
import os.org.opensearch.client.opensearch._types.OpenSearchException;
import os.org.opensearch.client.opensearch._types.SortMode;
import os.org.opensearch.client.opensearch._types.SortOrder;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;
import os.org.opensearch.client.opensearch.core.search.Hit;

/**
 * OpenSearch implementation of search management operations.
 * This class handles all search-related operations for OpenSearch using the new Java API client.
 */
@Slf4j
public class OpenSearchSearchManager implements SearchManagementClient {
  private final OpenSearchClient client;
  private final boolean isClientAvailable;

  public OpenSearchSearchManager(OpenSearchClient client) {
    this.client = client;
    this.isClientAvailable = client != null;
  }

  @Override
  public Response searchBySourceUrl(String sourceUrl) throws IOException {
    if (!isClientAvailable) {
      throw new IOException("OpenSearch client is not available");
    }

    SearchRequest searchRequest =
        SearchRequest.of(
            s ->
                s.index(Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS))
                    .query(
                        q ->
                            q.bool(
                                b ->
                                    b.must(
                                        m ->
                                            m.term(
                                                t ->
                                                    t.field("sourceUrl")
                                                        .value(FieldValue.of(sourceUrl)))))));

    SearchResponse<JsonData> response = client.search(searchRequest, JsonData.class);
    return Response.status(OK).entity(response.toJsonString()).build();
  }

  @Override
  public Response searchByField(String fieldName, String fieldValue, String index, Boolean deleted)
      throws IOException {
    if (!isClientAvailable) {
      throw new IOException("OpenSearch client is not available");
    }

    SearchRequest searchRequest =
        SearchRequest.of(
            s ->
                s.index(Entity.getSearchRepository().getIndexOrAliasName(index))
                    .query(
                        q ->
                            q.bool(
                                b ->
                                    b.must(
                                            m ->
                                                m.wildcard(
                                                    w -> w.field(fieldName).value(fieldValue)))
                                        .filter(
                                            f ->
                                                f.term(
                                                    t ->
                                                        t.field("deleted")
                                                            .value(FieldValue.of(deleted)))))));

    SearchResponse<JsonData> response = client.search(searchRequest, JsonData.class);
    return Response.status(OK).entity(response.toJsonString()).build();
  }

  @Override
  public SearchResultListMapper listWithOffset(
      String filter,
      int limit,
      int offset,
      String index,
      SearchSortFilter searchSortFilter,
      String q,
      String queryString)
      throws IOException {
    if (!isClientAvailable) {
      throw new IOException("OpenSearch client is not available");
    }

    OpenSearchRequestBuilder requestBuilder = new OpenSearchRequestBuilder();

    if (!nullOrEmpty(q)) {
      OpenSearchSourceBuilderFactory searchBuilderFactory = getSearchBuilderFactory();
      requestBuilder =
          searchBuilderFactory.getSearchSourceBuilderV2(index, q, offset, limit, false);
    }

    if (!nullOrEmpty(queryString)) {
      try {
        JsonReader jsonReader = Json.createReader(new StringReader(queryString));
        JsonObject jsonObject = jsonReader.readObject();
        jsonReader.close();

        if (jsonObject.containsKey("query")) {
          JsonObject queryJson = jsonObject.getJsonObject("query");
          StringReader qReader = new StringReader(queryJson.toString());
          JsonpMapper qMapper = client._transport().jsonpMapper();
          JsonParser qParser = qMapper.jsonProvider().createParser(qReader);
          Query query = Query._DESERIALIZER.deserialize(qParser, qMapper);
          requestBuilder.query(query);
        }
      } catch (Exception e) {
        LOG.warn("Error parsing queryString parameter, ignoring: {}", e.getMessage());
      }
    }

    if (!nullOrEmpty(filter) && !filter.equals("{}")) {
      applySearchFilter(filter, requestBuilder);
    }

    requestBuilder.timeout("30s");
    requestBuilder.from(offset);
    requestBuilder.size(limit);

    if (Boolean.TRUE.equals(searchSortFilter.isSorted())) {
      String sortTypeCapitalized =
          searchSortFilter.getSortType().substring(0, 1).toUpperCase()
              + searchSortFilter.getSortType().substring(1).toLowerCase();
      SortOrder sortOrder = SortOrder.valueOf(sortTypeCapitalized);

      if (Boolean.TRUE.equals(searchSortFilter.isNested())) {
        String sortModeCapitalized =
            searchSortFilter.getSortNestedMode().substring(0, 1).toUpperCase()
                + searchSortFilter.getSortNestedMode().substring(1).toLowerCase();
        SortMode sortMode = SortMode.valueOf(sortModeCapitalized);
        requestBuilder.sortWithNested(
            searchSortFilter.getSortField(),
            sortOrder,
            "long",
            searchSortFilter.getSortNestedPath(),
            sortMode);
      } else {
        requestBuilder.sort(searchSortFilter.getSortField(), sortOrder, "long");
      }
    }

    try {
      SearchRequest searchRequest = requestBuilder.build(index);
      SearchResponse<JsonData> response =
          client.search(searchRequest, os.org.opensearch.client.json.JsonData.class);

      List<Map<String, Object>> results = new ArrayList<>();
      if (response.hits().hits() != null) {
        response
            .hits()
            .hits()
            .forEach(
                hit -> {
                  if (hit.source() != null) {
                    Map<String, Object> map = OsUtils.jsonDataToMap(hit.source());
                    results.add(map);
                  }
                });
      }

      long totalHits = 0;
      if (response.hits().total() != null) {
        totalHits = response.hits().total().value();
      }

      return new SearchResultListMapper(results, totalHits);
    } catch (OpenSearchException e) {
      if (e.status() == 404) {
        throw new SearchIndexNotFoundException(String.format("Failed to find index %s", index));
      } else {
        throw new SearchException(String.format("Search failed due to %s", e.getMessage()));
      }
    }
  }

  @Override
  public SearchResultListMapper listWithDeepPagination(
      String index,
      String query,
      String filter,
      String[] fields,
      SearchSortFilter searchSortFilter,
      int size,
      Object[] searchAfter)
      throws IOException {
    if (!isClientAvailable) {
      throw new IOException("New OpenSearch client is not available");
    }

    OpenSearchRequestBuilder requestBuilder = new OpenSearchRequestBuilder();

    // Handle query building
    if (!nullOrEmpty(query)) {
      OpenSearchSourceBuilderFactory searchBuilderFactory = getSearchBuilderFactory();
      requestBuilder = searchBuilderFactory.getSearchSourceBuilderV2(index, query, 0, size, false);
    }

    // Handle field filtering
    if (fields != null && fields.length > 0) {
      requestBuilder.fetchSource(fields, null);
    }

    // Apply filter
    if (filter != null && !filter.isEmpty()) {
      applySearchFilter(filter, requestBuilder);
    }

    // Set basic parameters
    requestBuilder.timeout("30s");
    requestBuilder.from(0);
    requestBuilder.size(size);

    // Handle searchAfter for deep pagination
    if (searchAfter != null && searchAfter.length > 0) {
      List<String> searchAfterList = new ArrayList<>();
      for (Object value : searchAfter) {
        if (value instanceof os.org.opensearch.client.opensearch._types.FieldValue) {
          os.org.opensearch.client.opensearch._types.FieldValue fieldValue =
              (os.org.opensearch.client.opensearch._types.FieldValue) value;
          searchAfterList.add(String.valueOf(fieldValue._get()));
        } else {
          searchAfterList.add(String.valueOf(value));
        }
      }
      requestBuilder.searchAfter(searchAfterList);
    }

    // Handle sorting
    if (Boolean.TRUE.equals(searchSortFilter.isSorted())) {
      String sortTypeCapitalized =
          searchSortFilter.getSortType().substring(0, 1).toUpperCase()
              + searchSortFilter.getSortType().substring(1).toLowerCase();
      os.org.opensearch.client.opensearch._types.SortOrder sortOrder =
          os.org.opensearch.client.opensearch._types.SortOrder.valueOf(sortTypeCapitalized);

      if (Boolean.TRUE.equals(searchSortFilter.isNested())) {
        String sortModeCapitalized =
            searchSortFilter.getSortNestedMode().substring(0, 1).toUpperCase()
                + searchSortFilter.getSortNestedMode().substring(1).toLowerCase();
        os.org.opensearch.client.opensearch._types.SortMode sortMode =
            os.org.opensearch.client.opensearch._types.SortMode.valueOf(sortModeCapitalized);
        requestBuilder.sortWithNested(
            searchSortFilter.getSortField(),
            sortOrder,
            "long",
            searchSortFilter.getSortNestedPath(),
            sortMode);
      } else {
        requestBuilder.sort(searchSortFilter.getSortField(), sortOrder, "long");
      }
    }

    try {
      SearchRequest searchRequest = requestBuilder.build(index);
      SearchResponse<JsonData> response = client.search(searchRequest, JsonData.class);

      List<Map<String, Object>> results = new ArrayList<>();
      Object[] lastHitSortValues = null;

      if (response.hits().hits() != null && !response.hits().hits().isEmpty()) {
        List<Hit<JsonData>> hits = response.hits().hits();

        // Convert hits to result maps
        hits.forEach(
            hit -> {
              if (hit.source() != null) {
                Map<String, Object> map = OsUtils.jsonDataToMap(hit.source());
                results.add(map);
              }
            });

        // Get sort values from last hit only if we got a full page, indicating more results may
        // exist
        if (hits.size() == size) {
          Hit<JsonData> lastHit = hits.getLast();
          if (lastHit.sort() != null && !lastHit.sort().isEmpty()) {
            lastHitSortValues = lastHit.sort().toArray();
          }
        }
      }

      long totalHits = 0;
      if (response.hits().total() != null) {
        totalHits = response.hits().total().value();
      }

      return new SearchResultListMapper(results, totalHits, lastHitSortValues);
    } catch (OpenSearchException e) {
      if (e.status() == 404) {
        throw new SearchIndexNotFoundException(String.format("Failed to find index %s", index));
      } else {
        throw new SearchException(String.format("Search failed due to %s", e.getMessage()));
      }
    }
  }

  private void applySearchFilter(String filter, OpenSearchRequestBuilder requestBuilder)
      throws IOException {
    if (!filter.isEmpty()) {
      try {
        JsonReader jsonReader = Json.createReader(new StringReader(filter));
        JsonObject jsonObject = jsonReader.readObject();
        jsonReader.close();

        Query filterQuery = null;
        String[] includes = null;
        String[] excludes = null;

        if (jsonObject.containsKey("query")) {
          JsonObject queryJson = jsonObject.getJsonObject("query");
          StringReader queryReader = new StringReader(queryJson.toString());
          JsonpMapper mapper = client._transport().jsonpMapper();
          JsonParser parser = mapper.jsonProvider().createParser(queryReader);
          filterQuery = Query._DESERIALIZER.deserialize(parser, mapper);
        }

        if (jsonObject.containsKey("_source")) {
          JsonValue sourceValue = jsonObject.get("_source");
          if (sourceValue instanceof JsonObject) {
            JsonObject sourceObject = (JsonObject) sourceValue;
            if (sourceObject.containsKey("includes")) {
              JsonArray includesArray = sourceObject.getJsonArray("includes");
              includes = new String[includesArray.size()];
              for (int i = 0; i < includesArray.size(); i++) {
                includes[i] = includesArray.getString(i);
              }
            }
            if (sourceObject.containsKey("excludes")) {
              jakarta.json.JsonArray excludesArray = sourceObject.getJsonArray("excludes");
              excludes = new String[excludesArray.size()];
              for (int i = 0; i < excludesArray.size(); i++) {
                excludes[i] = excludesArray.getString(i);
              }
            }
          }
        }

        if (includes != null || excludes != null) {
          requestBuilder.fetchSource(includes, excludes);
        }

        if (filterQuery != null) {
          Query existingQuery = requestBuilder.query();
          if (existingQuery != null) {
            final Query finalFilterQuery = filterQuery;
            Query combinedQuery =
                Query.of(
                    q ->
                        q.bool(
                            b -> {
                              b.must(existingQuery);
                              b.filter(finalFilterQuery);
                              return b;
                            }));
            requestBuilder.query(combinedQuery);
          } else {
            requestBuilder.query(filterQuery);
          }
        }
      } catch (Exception e) {
        throw new IOException(String.format("Failed to parse query filter: %s", e.getMessage()), e);
      }
    }
  }

  private OpenSearchSourceBuilderFactory getSearchBuilderFactory() {
    SearchSettings searchSettings =
        SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class);
    return new OpenSearchSourceBuilderFactory(searchSettings);
  }
}
