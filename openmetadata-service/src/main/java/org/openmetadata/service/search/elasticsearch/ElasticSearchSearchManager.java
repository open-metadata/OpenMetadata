package org.openmetadata.service.search.elasticsearch;

import static jakarta.ws.rs.core.Response.Status.OK;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.ElasticsearchException;
import es.co.elastic.clients.elasticsearch._types.SortMode;
import es.co.elastic.clients.elasticsearch._types.SortOrder;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.elasticsearch.core.SearchResponse;
import es.co.elastic.clients.elasticsearch.core.search.Hit;
import es.co.elastic.clients.json.JsonData;
import es.co.elastic.clients.json.JsonpMapper;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonReader;
import jakarta.json.JsonString;
import jakarta.json.JsonValue;
import jakarta.json.spi.JsonProvider;
import jakarta.json.stream.JsonGenerator;
import jakarta.json.stream.JsonParser;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.StringReader;
import java.io.StringWriter;
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
import org.openmetadata.service.search.SearchUtils;
import org.openmetadata.service.search.queries.OMQueryBuilder;

/**
 * ElasticSearch implementation of search management operations.
 * This class handles all search-related operations for ElasticSearch using the new Java API client.
 */
@Slf4j
public class ElasticSearchSearchManager implements SearchManagementClient {
  private final ElasticsearchClient client;
  private final boolean isClientAvailable;
  private final org.openmetadata.service.search.security.RBACConditionEvaluator
      rbacConditionEvaluator;

  public ElasticSearchSearchManager(
      ElasticsearchClient client,
      org.openmetadata.service.search.security.RBACConditionEvaluator rbacConditionEvaluator) {
    this.client = client;
    this.isClientAvailable = client != null;
    this.rbacConditionEvaluator = rbacConditionEvaluator;
  }

  @Override
  public Response searchBySourceUrl(String sourceUrl) throws IOException {
    if (!isClientAvailable) {
      throw new IOException("Elasticsearch client is not available");
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
                                        m -> m.term(t -> t.field("sourceUrl").value(sourceUrl))))));

    SearchResponse<JsonData> response = client.search(searchRequest, JsonData.class);
    String responseJson = serializeSearchResponse(response);
    return Response.status(OK).entity(responseJson).build();
  }

  @Override
  public Response searchByField(String fieldName, String fieldValue, String index, Boolean deleted)
      throws IOException {
    if (!isClientAvailable) {
      throw new IOException("Elasticsearch client is not available");
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
                                            f -> f.term(t -> t.field("deleted").value(deleted))))));

    SearchResponse<JsonData> response = client.search(searchRequest, JsonData.class);
    String responseJson = serializeSearchResponse(response);
    return Response.status(OK).entity(responseJson).build();
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
      throw new IOException("Elasticsearch client is not available");
    }

    ElasticSearchRequestBuilder requestBuilder = new ElasticSearchRequestBuilder();

    // Handle query building
    if (!nullOrEmpty(q)) {
      ElasticSearchSourceBuilderFactory searchBuilderFactory = getSearchBuilderFactory();
      requestBuilder =
          searchBuilderFactory.getSearchSourceBuilderV2(index, q, offset, limit, false);
    }

    // Handle queryString parameter (raw ES query DSL)
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

    // Apply filter
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
      SearchResponse<JsonData> response = client.search(searchRequest, JsonData.class);

      List<Map<String, Object>> results = new ArrayList<>();
      if (response.hits().hits() != null) {
        response
            .hits()
            .hits()
            .forEach(
                hit -> {
                  if (hit.source() != null) {
                    Map<String, Object> map = EsUtils.jsonDataToMap(hit.source());
                    results.add(map);
                  }
                });
      }

      long totalHits = 0;
      if (response.hits().total() != null) {
        totalHits = response.hits().total().value();
      }

      return new SearchResultListMapper(results, totalHits);
    } catch (ElasticsearchException e) {
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
      throw new IOException("Elasticsearch client is not available");
    }

    ElasticSearchRequestBuilder requestBuilder = new ElasticSearchRequestBuilder();

    // Handle query building
    if (!nullOrEmpty(query)) {
      ElasticSearchSourceBuilderFactory searchBuilderFactory = getSearchBuilderFactory();
      requestBuilder = searchBuilderFactory.getSearchSourceBuilderV2(index, query, 0, size);
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
        if (value instanceof es.co.elastic.clients.elasticsearch._types.FieldValue) {
          es.co.elastic.clients.elasticsearch._types.FieldValue fieldValue =
              (es.co.elastic.clients.elasticsearch._types.FieldValue) value;
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
      SearchResponse<JsonData> response = client.search(searchRequest, JsonData.class);

      List<Map<String, Object>> results = new ArrayList<>();
      Object[] lastHitSortValues = null;

      if (response.hits().hits() != null && !response.hits().hits().isEmpty()) {
        List<Hit<JsonData>> hits = response.hits().hits();

        // Convert hits to result maps
        hits.forEach(
            hit -> {
              if (hit.source() != null) {
                Map<String, Object> map = EsUtils.jsonDataToMap(hit.source());
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
    } catch (ElasticsearchException e) {
      if (e.status() == 404) {
        throw new SearchIndexNotFoundException(String.format("Failed to find index %s", index));
      } else {
        throw new SearchException(String.format("Search failed due to %s", e.getMessage()));
      }
    }
  }

  private void applySearchFilter(String filter, ElasticSearchRequestBuilder requestBuilder)
      throws IOException {
    if (!filter.isEmpty()) {
      try {
        JsonReader jsonReader = Json.createReader(new java.io.StringReader(filter));
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
            JsonObject sourceObj = (JsonObject) sourceValue;
            if (sourceObj.containsKey("include")) {
              includes =
                  sourceObj.getJsonArray("include").stream()
                      .map(v -> ((JsonString) v).getString())
                      .toArray(String[]::new);
            }
            if (sourceObj.containsKey("exclude")) {
              excludes =
                  sourceObj.getJsonArray("exclude").stream()
                      .map(v -> ((JsonString) v).getString())
                      .toArray(String[]::new);
            }
          }
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

        if (includes != null || excludes != null) {
          requestBuilder.fetchSource(includes, excludes);
        }
      } catch (Exception e) {
        throw new IOException(String.format("Failed to parse query filter: %s", e.getMessage()), e);
      }
    }
  }

  private ElasticSearchSourceBuilderFactory getSearchBuilderFactory() {
    SearchSettings searchSettings =
        SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class);
    return new ElasticSearchSourceBuilderFactory(searchSettings);
  }

  /**
   * Serializes a SearchResponse to JSON string.
   *
   * @param searchResponse the SearchResponse to serialize
   * @return JSON string representation of the response
   */
  private String serializeSearchResponse(SearchResponse<JsonData> searchResponse) {
    JsonpMapper jsonpMapper = client._transport().jsonpMapper();
    JsonProvider provider = jsonpMapper.jsonProvider();
    StringWriter stringWriter = new StringWriter();
    JsonGenerator generator = provider.createGenerator(stringWriter);

    searchResponse.serialize(generator, jsonpMapper);
    generator.close();

    return stringWriter.toString();
  }

  @Override
  public Response searchWithDirectQuery(
      org.openmetadata.schema.search.SearchRequest request,
      org.openmetadata.service.security.policyevaluator.SubjectContext subjectContext)
      throws IOException {
    if (!isClientAvailable) {
      throw new IOException("ElasticSearch client is not available");
    }

    try {
      LOG.info("Executing direct ElasticSearch query: {}", request.getQueryFilter());
      ElasticSearchRequestBuilder requestBuilder = new ElasticSearchRequestBuilder();

      // Parse the direct query filter into new API Query
      String queryFilter = request.getQueryFilter();
      if (!nullOrEmpty(queryFilter) && !queryFilter.equals("{}")) {
        try {
          String queryToProcess = EsUtils.parseJsonQuery(queryFilter);
          Query filter = Query.of(q -> q.withJson(new StringReader(queryToProcess)));
          requestBuilder.query(filter);
        } catch (Exception e) {
          LOG.error("Error parsing direct query: {}", e.getMessage(), e);
          throw new IOException("Failed to parse direct query: " + e.getMessage(), e);
        }
      }

      // Apply RBAC constraints
      if (SearchUtils.shouldApplyRbacConditions(subjectContext, rbacConditionEvaluator)) {
        OMQueryBuilder rbacQueryBuilder = rbacConditionEvaluator.evaluateConditions(subjectContext);
        if (rbacQueryBuilder != null) {
          Query rbacQuery =
              ((org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilder)
                      rbacQueryBuilder)
                  .buildV2();
          Query existingQuery = requestBuilder.query();
          if (existingQuery != null) {
            Query combinedQuery =
                Query.of(
                    q ->
                        q.bool(
                            b -> {
                              b.must(existingQuery);
                              b.filter(rbacQuery);
                              return b;
                            }));
            requestBuilder.query(combinedQuery);
          } else {
            requestBuilder.query(rbacQuery);
          }
        }
      }

      // Add aggregations if needed
      ElasticSearchSourceBuilderFactory factory = getSearchBuilderFactory();
      SearchSettings searchSettings =
          SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class);
      org.openmetadata.schema.api.search.AssetTypeConfiguration assetConfig =
          factory.findAssetTypeConfig(request.getIndex(), searchSettings);
      factory.addConfiguredAggregationsV2(requestBuilder, assetConfig);

      // Set pagination
      requestBuilder.from(request.getFrom());
      requestBuilder.size(request.getSize());
      requestBuilder.timeout("30s");

      // Build and execute search request
      SearchRequest searchRequest = requestBuilder.build(request.getIndex());
      SearchResponse<JsonData> response = client.search(searchRequest, JsonData.class);

      String responseJson = serializeSearchResponse(response);
      LOG.debug("Direct query search completed successfully");
      return Response.status(Response.Status.OK).entity(responseJson).build();
    } catch (Exception e) {
      LOG.error("Error executing direct query search: {}", e.getMessage(), e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity(String.format("Failed to execute direct query search: %s", e.getMessage()))
          .build();
    }
  }
}
