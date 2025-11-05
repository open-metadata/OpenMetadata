package org.openmetadata.service.search.opensearch;

import static jakarta.ws.rs.core.Response.Status.OK;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;
import static org.openmetadata.service.search.EntityBuilderConstant.MAX_RESULT_HITS;
import static org.openmetadata.service.search.SearchClient.DATA_ASSET_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchUtils.shouldApplyRbacConditions;
import static org.openmetadata.service.util.FullyQualifiedName.getParentFQN;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.entity.data.EntityHierarchy;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.sdk.exception.SearchIndexNotFoundException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchManagementClient;
import org.openmetadata.service.search.SearchResultListMapper;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilder;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.security.RBACConditionEvaluator;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.json.JsonpMapper;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.FieldValue;
import os.org.opensearch.client.opensearch._types.OpenSearchException;
import os.org.opensearch.client.opensearch._types.SearchType;
import os.org.opensearch.client.opensearch._types.SortMode;
import os.org.opensearch.client.opensearch._types.SortOrder;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregate;
import os.org.opensearch.client.opensearch._types.aggregations.StringTermsBucket;
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
  private final String clusterAlias;
  private final RBACConditionEvaluator rbacConditionEvaluator;

  // RBAC cache for new Java API
  private static final LoadingCache<String, Query> RBAC_CACHE_V2 =
      CacheBuilder.newBuilder()
          .maximumSize(10000)
          .expireAfterWrite(5, TimeUnit.MINUTES)
          .build(
              new CacheLoader<String, Query>() {
                @Override
                public Query load(String key) {
                  // Will be loaded via computeIfAbsent pattern
                  return null;
                }
              });

  public OpenSearchSearchManager(
      OpenSearchClient client, RBACConditionEvaluator rbacConditionEvaluator, String clusterAlias) {
    this.client = client;
    this.isClientAvailable = client != null;
    this.rbacConditionEvaluator = rbacConditionEvaluator;
    this.clusterAlias = clusterAlias;
  }

  @Override
  public Response search(
      org.openmetadata.schema.search.SearchRequest request, SubjectContext subjectContext)
      throws IOException {
    SearchSettings searchSettings =
        SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class);
    return doSearch(request, subjectContext, searchSettings, clusterAlias);
  }

  @Override
  public Response previewSearch(
      org.openmetadata.schema.search.SearchRequest request,
      SubjectContext subjectContext,
      SearchSettings searchSettings)
      throws IOException {
    return doSearch(request, subjectContext, searchSettings, clusterAlias);
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

  @Override
  public Response searchWithDirectQuery(
      org.openmetadata.schema.search.SearchRequest request, SubjectContext subjectContext)
      throws IOException {
    LOG.info("Executing direct OpenSearch query: {}", request.getQueryFilter());
    if (!isClientAvailable) {
      throw new IOException("OpenSearch client is not available");
    }

    try {
      OpenSearchRequestBuilder requestBuilder = new OpenSearchRequestBuilder();

      // Parse the direct query filter into new API Query
      String queryFilter = request.getQueryFilter();
      if (!nullOrEmpty(queryFilter) && !queryFilter.equals("{}")) {
        try {
          String queryToProcess = OsUtils.parseJsonQuery(queryFilter);
          Query filter = Query.of(q -> q.wrapper(w -> w.query(queryToProcess)));
          requestBuilder.query(filter);
        } catch (Exception e) {
          LOG.error("Error parsing direct query: {}", e.getMessage(), e);
          throw new IOException("Failed to parse direct query: " + e.getMessage(), e);
        }
      }

      // Apply RBAC constraints with caching
      applyRbacQueryWithCaching(subjectContext, requestBuilder);

      // Add aggregations if needed
      OpenSearchSourceBuilderFactory factory = getSearchBuilderFactory();
      SearchSettings searchSettings =
          SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class);
      AssetTypeConfiguration assetConfig =
          factory.findAssetTypeConfig(request.getIndex(), searchSettings);
      factory.addConfiguredAggregationsV2(requestBuilder, assetConfig);

      // Set pagination
      requestBuilder.from(request.getFrom());
      requestBuilder.size(request.getSize());
      requestBuilder.timeout("30s");

      // Use DFS Query Then Fetch for consistent scoring across shards
      requestBuilder.searchType(SearchType.DfsQueryThenFetch);

      // Build and execute search request
      SearchRequest searchRequest = requestBuilder.build(request.getIndex());
      SearchResponse<JsonData> response = client.search(searchRequest, JsonData.class);

      String responseJson = response.toJsonString();
      LOG.debug("Direct query search completed successfully");
      return Response.status(Response.Status.OK).entity(responseJson).build();
    } catch (Exception e) {
      LOG.error("Error executing direct query search: {}", e.getMessage(), e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity(String.format("Failed to execute direct query search: %s", e.getMessage()))
          .build();
    }
  }

  /**
   * Applies RBAC query constraints with caching to the request builder.
   *
   * @param subjectContext the subject context containing user and role information
   * @param requestBuilder the request builder to apply RBAC constraints to
   */
  private void applyRbacQueryWithCaching(
      SubjectContext subjectContext, OpenSearchRequestBuilder requestBuilder) throws IOException {
    if (!shouldApplyRbacConditions(subjectContext, rbacConditionEvaluator)) {
      return;
    }

    // Create cache key from user ID and roles
    String cacheKey =
        subjectContext.user().getId()
            + ":"
            + subjectContext.user().getRoles().stream()
                .map(r -> r.getId().toString())
                .sorted()
                .collect(Collectors.joining(","));

    try {
      Query cachedRbacQuery =
          RBAC_CACHE_V2.get(
              cacheKey,
              () -> {
                OMQueryBuilder rbacQueryBuilder =
                    rbacConditionEvaluator.evaluateConditions(subjectContext);
                if (rbacQueryBuilder != null) {
                  return ((OpenSearchQueryBuilder) rbacQueryBuilder).buildV2();
                }
                return null;
              });

      Query existingQuery = requestBuilder.query();
      if (existingQuery != null) {
        Query combinedQuery =
            Query.of(
                q ->
                    q.bool(
                        b -> {
                          b.must(existingQuery);
                          b.filter(cachedRbacQuery);
                          return b;
                        }));
        requestBuilder.query(combinedQuery);
      } else {
        requestBuilder.query(cachedRbacQuery);
      }
    } catch (Exception e) {
      LOG.warn("RBAC cache miss, building query directly", e);
      // Fallback to original implementation without caching
      OMQueryBuilder rbacQueryBuilder = rbacConditionEvaluator.evaluateConditions(subjectContext);
      if (rbacQueryBuilder != null) {
        Query rbacQuery = ((OpenSearchQueryBuilder) rbacQueryBuilder).buildV2();
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
            if (sourceObject.containsKey("include")) {
              JsonArray includesArray = sourceObject.getJsonArray("include");
              includes = new String[includesArray.size()];
              for (int i = 0; i < includesArray.size(); i++) {
                includes[i] = includesArray.getString(i);
              }
            }
            if (sourceObject.containsKey("exclude")) {
              jakarta.json.JsonArray excludesArray = sourceObject.getJsonArray("exclude");
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

  public Response doSearch(
      org.openmetadata.schema.search.SearchRequest request,
      SubjectContext subjectContext,
      SearchSettings searchSettings,
      String clusterAlias)
      throws IOException {
    if (!isClientAvailable) {
      throw new IOException("OpenSearch client is not available");
    }

    String indexName = Entity.getSearchRepository().getIndexNameWithoutAlias(request.getIndex());
    OpenSearchSourceBuilderFactory searchBuilderFactory =
        new OpenSearchSourceBuilderFactory(searchSettings);

    OpenSearchRequestBuilder requestBuilder =
        searchBuilderFactory.getSearchSourceBuilderV2(
            request.getIndex(),
            request.getQuery(),
            request.getFrom(),
            request.getSize(),
            request.getExplain());

    LOG.debug(
        "OpenSearch query for index '{}' with sanitized query '{}': {}",
        request.getIndex(),
        request.getQuery(),
        requestBuilder.query());

    // Apply RBAC query with caching
    applyRbacQueryWithCaching(subjectContext, requestBuilder);

    // Check if semantic search is enabled and override the query
    if (Boolean.TRUE.equals(request.getSemanticSearch())) {
      SemanticSearchQueryBuilder semanticBuilder = new SemanticSearchQueryBuilder();
      os.org.opensearch.index.query.QueryBuilder semanticQuery =
          semanticBuilder.buildSemanticQuery(request);
      if (semanticQuery != null) {
        // Convert semantic query if needed
        LOG.debug("Semantic search is enabled for this query");
      }
    }

    // Apply query filter
    if (!nullOrEmpty(request.getQueryFilter()) && !request.getQueryFilter().equals("{}")) {
      try {
        String queryToProcess = OsUtils.parseJsonQuery(request.getQueryFilter());
        Query filterQuery = Query.of(q -> q.wrapper(w -> w.query(queryToProcess)));
        Query existingQuery = requestBuilder.query();
        if (existingQuery != null) {
          Query combinedQuery =
              Query.of(
                  q ->
                      q.bool(
                          b -> {
                            b.must(existingQuery);
                            b.filter(filterQuery);
                            return b;
                          }));
          requestBuilder.query(combinedQuery);
        } else {
          requestBuilder.query(filterQuery);
        }
      } catch (Exception ex) {
        LOG.error("Error parsing query_filter from query parameters, ignoring filter", ex);
      }
    }

    // Apply post filter
    if (!nullOrEmpty(request.getPostFilter())) {
      try {
        String postFilterToProcess = OsUtils.parseJsonQuery(request.getPostFilter());
        Query postFilterQuery = Query.of(q -> q.wrapper(w -> w.query(postFilterToProcess)));
        requestBuilder.postFilter(postFilterQuery);
      } catch (Exception ex) {
        LOG.warn("Error parsing post_filter from query parameters, ignoring filter", ex);
      }
    }

    // Handle search_after for pagination
    if (!nullOrEmpty(request.getSearchAfter())) {
      List<String> searchAfterValues =
          request.getSearchAfter().stream().map(String::valueOf).collect(Collectors.toList());
      requestBuilder.searchAfter(searchAfterValues);
    }

    // Handle deleted field for backward compatibility
    if (!nullOrEmpty(request.getDeleted())) {
      Query existingQuery = requestBuilder.query();
      Query deletedQuery;

      if (indexName.equals(GLOBAL_SEARCH_ALIAS) || indexName.equals(DATA_ASSET_SEARCH_ALIAS)) {
        deletedQuery =
            Query.of(
                q ->
                    q.bool(
                        b ->
                            b.should(
                                    s ->
                                        s.bool(
                                            bb ->
                                                bb.must(existingQuery)
                                                    .must(m -> m.exists(e -> e.field("deleted")))
                                                    .must(
                                                        m ->
                                                            m.term(
                                                                t ->
                                                                    t.field("deleted")
                                                                        .value(
                                                                            FieldValue.of(
                                                                                request
                                                                                    .getDeleted()))))))
                                .should(
                                    s ->
                                        s.bool(
                                            bb ->
                                                bb.must(existingQuery)
                                                    .mustNot(
                                                        mn ->
                                                            mn.exists(e -> e.field("deleted")))))));
      } else {
        deletedQuery =
            Query.of(
                q ->
                    q.bool(
                        b ->
                            b.must(existingQuery)
                                .must(
                                    m ->
                                        m.term(
                                            t ->
                                                t.field("deleted")
                                                    .value(FieldValue.of(request.getDeleted()))))));
      }
      requestBuilder.query(deletedQuery);
    }

    // Handle sorting
    if (!nullOrEmpty(request.getSortFieldParam())
        && !Boolean.TRUE.equals(request.getIsHierarchy())) {
      String sortField = request.getSortFieldParam();
      String sortTypeCapitalized =
          request.getSortOrder().substring(0, 1).toUpperCase()
              + request.getSortOrder().substring(1).toLowerCase();
      SortOrder sortOrder = SortOrder.valueOf(sortTypeCapitalized);

      if (!sortField.equalsIgnoreCase("_score")) {
        requestBuilder.sort(sortField, sortOrder, "integer");
      } else {
        requestBuilder.sort(sortField, sortOrder, null);
      }

      // Add tiebreaker sort for stable pagination when sorting by score
      if (sortField.equalsIgnoreCase("_score")) {
        requestBuilder.sort("name.keyword", SortOrder.Asc, "keyword");
      }
    }

    // Build hierarchy query if needed
    if (Boolean.TRUE.equals(request.getIsHierarchy())) {
      requestBuilder = buildHierarchyQuery(request, requestBuilder, clusterAlias);
    }

    // Handle fetch source
    String[] includeFields =
        !nullOrEmpty(request.getIncludeSourceFields())
            ? request.getIncludeSourceFields().toArray(String[]::new)
            : null;
    String[] excludeFields =
        !nullOrEmpty(request.getExcludeSourceFields())
            ? request.getExcludeSourceFields().toArray(String[]::new)
            : null;

    if (Boolean.TRUE.equals(request.getFetchSource())
        || includeFields != null
        || excludeFields != null) {
      requestBuilder.fetchSource(includeFields, excludeFields);
    } else if (Boolean.FALSE.equals(request.getFetchSource())) {
      requestBuilder.fetchSource(false);
    }

    // Handle track total hits
    if (Boolean.TRUE.equals(request.getTrackTotalHits())) {
      requestBuilder.trackTotalHits(true);
    } else {
      requestBuilder.trackTotalHitsUpTo(MAX_RESULT_HITS);
    }

    requestBuilder.timeout("30s");

    LOG.debug("Executing search on index: {}, query: {}", request.getIndex(), request.getQuery());

    try {
      io.micrometer.core.instrument.Timer.Sample searchTimerSample =
          org.openmetadata.service.monitoring.RequestLatencyContext.startSearchOperation();

      SearchRequest searchRequest = requestBuilder.build(request.getIndex());
      SearchResponse<JsonData> searchResponse = client.search(searchRequest, JsonData.class);

      if (searchTimerSample != null) {
        org.openmetadata.service.monitoring.RequestLatencyContext.endSearchOperation(
            searchTimerSample);
      }

      if (!Boolean.TRUE.equals(request.getIsHierarchy())) {
        return Response.status(OK).entity(searchResponse.toJsonString()).build();
      } else {
        List<?> response = buildSearchHierarchy(request, searchResponse, clusterAlias);
        return Response.status(OK).entity(response).build();
      }

    } catch (OpenSearchException e) {
      if (e.status() == 404) {
        throw new SearchIndexNotFoundException(
            String.format("Failed to find index %s", request.getIndex()));
      } else {
        throw new SearchException(String.format("Search failed due to %s", e.getMessage()));
      }
    }
  }

  private OpenSearchRequestBuilder buildHierarchyQuery(
      org.openmetadata.schema.search.SearchRequest request,
      OpenSearchRequestBuilder requestBuilder,
      String clusterAlias)
      throws IOException {

    String indexName = request.getIndex();
    String glossaryTermIndex =
        Entity.getSearchRepository().getIndexMapping(GLOSSARY_TERM).getIndexName(clusterAlias);
    String domainIndex =
        Entity.getSearchRepository().getIndexMapping(DOMAIN).getIndexName(clusterAlias);

    Query existingQuery = requestBuilder.query();
    Query baseQuery =
        Query.of(
            q ->
                q.bool(
                    b ->
                        b.should(existingQuery)
                            .should(
                                s ->
                                    s.matchPhrase(
                                        mp ->
                                            mp.field("fullyQualifiedName")
                                                .query(request.getQuery())))
                            .should(
                                s ->
                                    s.matchPhrase(mp -> mp.field("name").query(request.getQuery())))
                            .should(
                                s ->
                                    s.matchPhrase(
                                        mp -> mp.field("displayName").query(request.getQuery())))));

    if (indexName.equalsIgnoreCase(glossaryTermIndex)) {
      Query glossaryQuery =
          Query.of(
              q ->
                  q.bool(
                      b ->
                          b.should(baseQuery)
                              .should(
                                  s ->
                                      s.matchPhrase(
                                          mp ->
                                              mp.field("glossary.fullyQualifiedName")
                                                  .query(request.getQuery())))
                              .should(
                                  s ->
                                      s.matchPhrase(
                                          mp ->
                                              mp.field("glossary.displayName")
                                                  .query(request.getQuery())))
                              .must(
                                  m ->
                                      m.match(
                                          ma ->
                                              ma.field("entityStatus")
                                                  .query(FieldValue.of("Approved"))))
                              .minimumShouldMatch("1")));
      requestBuilder.query(glossaryQuery);
    } else if (indexName.equalsIgnoreCase(domainIndex)) {
      Query domainQuery =
          Query.of(
              q ->
                  q.bool(
                      b ->
                          b.should(baseQuery)
                              .should(
                                  s ->
                                      s.matchPhrase(
                                          mp ->
                                              mp.field("parent.fullyQualifiedName")
                                                  .query(request.getQuery())))
                              .should(
                                  s ->
                                      s.matchPhrase(
                                          mp ->
                                              mp.field("parent.displayName")
                                                  .query(request.getQuery())))
                              .minimumShouldMatch("1")));
      requestBuilder.query(domainQuery);
    } else {
      requestBuilder.query(
          Query.of(q -> q.bool(b -> b.should(existingQuery).minimumShouldMatch("1"))));
    }

    // Add fqnParts aggregation to fetch parent terms
    requestBuilder.aggregation(
        "fqnParts_agg",
        os.org.opensearch.client.opensearch._types.aggregations.Aggregation.of(
            a -> a.terms(t -> t.field("fqnParts").size(1000))));

    // Execute search to get aggregations for parent terms
    SearchRequest searchRequest = requestBuilder.build(request.getIndex());
    SearchResponse<JsonData> searchResponse = client.search(searchRequest, JsonData.class);

    if (searchResponse.aggregations() != null
        && searchResponse.aggregations().containsKey("fqnParts_agg")) {
      Aggregate parentTermsAgg = searchResponse.aggregations().get("fqnParts_agg");
      if (parentTermsAgg.isSterms()
          && !parentTermsAgg.sterms().buckets().array().isEmpty()
          && !request.getQuery().equals("*")) {

        List<Query> parentTermQueries = new ArrayList<>();
        for (StringTermsBucket bucket : parentTermsAgg.sterms().buckets().array()) {
          String fqnPart = bucket.key();
          Query matchQuery =
              Query.of(
                  qt -> qt.match(m -> m.field("fullyQualifiedName").query(FieldValue.of(fqnPart))));
          parentTermQueries.add(matchQuery);
        }

        // Replace the query entirely with parent term queries (not combine)
        Query parentTermQuery =
            Query.of(
                q ->
                    q.bool(
                        b -> {
                          parentTermQueries.forEach(b::should);
                          if (indexName.equalsIgnoreCase(glossaryTermIndex)) {
                            b.must(
                                m ->
                                    m.match(
                                        ma ->
                                            ma.field("entityStatus")
                                                .query(FieldValue.of("Approved"))));
                          }
                          b.minimumShouldMatch("1");
                          return b;
                        }));
        requestBuilder.query(parentTermQuery);
      }
    }

    // Add sorting by fullyQualifiedName for consistent hierarchy ordering
    requestBuilder.sort("fullyQualifiedName", SortOrder.Asc, "keyword");

    return requestBuilder;
  }

  private List<?> buildSearchHierarchy(
      org.openmetadata.schema.search.SearchRequest request,
      SearchResponse<JsonData> searchResponse,
      String clusterAlias) {
    List<?> response = new ArrayList<>();

    String indexName = request.getIndex();
    String glossaryTermIndex =
        Entity.getSearchRepository().getIndexMapping(GLOSSARY_TERM).getIndexName(clusterAlias);
    String domainIndex =
        Entity.getSearchRepository().getIndexMapping(DOMAIN).getIndexName(clusterAlias);

    if (indexName.equalsIgnoreCase(glossaryTermIndex)) {
      response = buildGlossaryTermSearchHierarchy(searchResponse);
    } else if (indexName.equalsIgnoreCase(domainIndex)) {
      response = buildDomainSearchHierarchy(searchResponse);
    }
    return response;
  }

  private List<EntityHierarchy> buildGlossaryTermSearchHierarchy(
      SearchResponse<JsonData> searchResponse) {
    Map<String, EntityHierarchy> termMap = new LinkedHashMap<>();
    Map<String, EntityHierarchy> rootTerms = new LinkedHashMap<>();

    for (Hit<JsonData> hit : searchResponse.hits().hits()) {
      if (hit.source() == null) continue;

      String jsonSource = hit.source().toJson().toString();

      EntityHierarchy term = JsonUtils.readValue(jsonSource, EntityHierarchy.class);
      EntityHierarchy glossaryInfo =
          JsonUtils.readTree(jsonSource).path("glossary").isMissingNode()
              ? null
              : JsonUtils.convertValue(
                  JsonUtils.readTree(jsonSource).path("glossary"), EntityHierarchy.class);

      if (glossaryInfo != null) {
        rootTerms.putIfAbsent(glossaryInfo.getFullyQualifiedName(), glossaryInfo);
      }

      term.setChildren(new ArrayList<>());
      termMap.putIfAbsent(term.getFullyQualifiedName(), term);
    }

    termMap.putAll(rootTerms);

    termMap
        .values()
        .forEach(
            term -> {
              String parentFQN = getParentFQN(term.getFullyQualifiedName());
              String termFQN = term.getFullyQualifiedName();

              if (parentFQN != null && termMap.containsKey(parentFQN)) {
                EntityHierarchy parentTerm = termMap.get(parentFQN);
                List<EntityHierarchy> children = parentTerm.getChildren();
                children.removeIf(
                    child -> child.getFullyQualifiedName().equals(term.getFullyQualifiedName()));
                children.add(term);
                parentTerm.setChildren(children);
              } else {
                if (rootTerms.containsKey(termFQN)) {
                  EntityHierarchy rootTerm = rootTerms.get(termFQN);
                  rootTerm.setChildren(term.getChildren());
                }
              }
            });

    return new ArrayList<>(rootTerms.values());
  }

  private List<EntityHierarchy> buildDomainSearchHierarchy(
      SearchResponse<JsonData> searchResponse) {
    Map<String, EntityHierarchy> entityHierarchyMap =
        searchResponse.hits().hits().stream()
            .filter(hit -> hit.source() != null)
            .map(
                hit -> JsonUtils.readValue(hit.source().toJson().toString(), EntityHierarchy.class))
            .collect(
                Collectors.toMap(
                    EntityHierarchy::getFullyQualifiedName,
                    entity -> {
                      entity.setChildren(new ArrayList<>());
                      return entity;
                    },
                    (existing, replacement) -> existing,
                    LinkedHashMap::new));

    List<EntityHierarchy> rootDomains = new ArrayList<>();

    entityHierarchyMap
        .values()
        .forEach(
            entity -> {
              String parentFqn = getParentFQN(entity.getFullyQualifiedName());
              EntityHierarchy parentEntity = entityHierarchyMap.get(parentFqn);
              if (parentEntity != null) {
                parentEntity.getChildren().add(entity);
              } else {
                rootDomains.add(entity);
              }
            });

    return rootDomains;
  }
}
