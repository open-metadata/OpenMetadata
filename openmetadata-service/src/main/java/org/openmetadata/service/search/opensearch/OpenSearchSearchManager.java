package org.openmetadata.service.search.opensearch;

import static jakarta.ws.rs.core.Response.Status.OK;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.search.EntityBuilderConstant.MAX_RESULT_HITS;
import static org.openmetadata.service.search.SearchClient.DATA_ASSET_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchClient.ENTITY_RELATIONSHIP_DIRECTION_ENTITY;
import static org.openmetadata.service.search.SearchClient.ENTITY_RELATIONSHIP_DIRECTION_RELATED_ENTITY;
import static org.openmetadata.service.search.SearchClient.FIELDS_TO_REMOVE_ENTITY_RELATIONSHIP;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchUtils.shouldApplyRbacConditions;
import static org.openmetadata.service.util.FullyQualifiedName.getParentFQN;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import io.micrometer.core.instrument.Timer;
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
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.entity.data.EntityHierarchy;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.sdk.exception.SearchIndexNotFoundException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.jdbi3.TestCaseResultRepository;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchManagementClient;
import org.openmetadata.service.search.SearchResultListMapper;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.search.SearchUtils;
import org.openmetadata.service.search.nlq.NLQService;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilder;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.security.RBACConditionEvaluator;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.FullyQualifiedName;
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
import os.org.opensearch.client.opensearch._types.query_dsl.Operator;
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
  private final NLQService nlqService;
  private static final Set<String> FIELDS_TO_REMOVE =
      Set.of(
          "suggest",
          "service_suggest",
          "column_suggest",
          "schema_suggest",
          "database_suggest",
          "lifeCycle",
          "fqnParts",
          "chart_suggest",
          "field_suggest");

  // RBAC cache for new Java API
  private static final LoadingCache<@NotNull String, @NotNull Query> RBAC_CACHE_V2 =
      CacheBuilder.newBuilder()
          .maximumSize(10000)
          .expireAfterWrite(5, TimeUnit.MINUTES)
          .build(
              new CacheLoader<>() {
                @Override
                public Query load(String key) {
                  // Will be loaded via computeIfAbsent pattern
                  return null;
                }
              });

  public OpenSearchSearchManager(
      OpenSearchClient client,
      RBACConditionEvaluator rbacConditionEvaluator,
      String clusterAlias,
      NLQService nlqService) {
    this.client = client;
    this.isClientAvailable = client != null;
    this.rbacConditionEvaluator = rbacConditionEvaluator;
    this.clusterAlias = clusterAlias;
    this.nlqService = nlqService;
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

    Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
    SearchResponse<JsonData> response;
    try {
      response = client.search(searchRequest, JsonData.class);
    } finally {
      if (searchTimerSample != null) {
        RequestLatencyContext.endSearchOperation(searchTimerSample);
      }
    }
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

    Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
    SearchResponse<JsonData> response;
    try {
      response = client.search(searchRequest, JsonData.class);
    } finally {
      if (searchTimerSample != null) {
        RequestLatencyContext.endSearchOperation(searchTimerSample);
      }
    }
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
        String queryToProcess = OsUtils.parseJsonQuery(queryString);
        Query query = Query.of(qb -> qb.wrapper(w -> w.query(queryToProcess)));
        requestBuilder.query(query);
      } catch (Exception e) {
        LOG.warn("Error parsing queryString using OsUtils: {}", e.getMessage());
      }
    }

    if (!nullOrEmpty(filter) && !filter.equals("{}")) {
      applySearchFilter(filter, requestBuilder);
    }

    return doListWithOffset(limit, offset, index, searchSortFilter, requestBuilder);
  }

  @NotNull
  private SearchResultListMapper doListWithOffset(
      int limit,
      int offset,
      String index,
      SearchSortFilter searchSortFilter,
      OpenSearchRequestBuilder requestBuilder)
      throws IOException {
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
      Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
      SearchResponse<JsonData> response;
      try {
        response = client.search(searchRequest, JsonData.class);
      } finally {
        if (searchTimerSample != null) {
          RequestLatencyContext.endSearchOperation(searchTimerSample);
        }
      }

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
  public SearchResultListMapper listWithOffset(
      String filter,
      int limit,
      int offset,
      String index,
      SearchSortFilter searchSortFilter,
      String q,
      String queryString,
      SubjectContext subjectContext)
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
        String queryToProcess = OsUtils.parseJsonQuery(queryString);
        Query query = Query.of(qb -> qb.wrapper(w -> w.query(queryToProcess)));
        requestBuilder.query(query);
      } catch (Exception e) {
        LOG.warn("Error parsing queryString using OsUtils: {}", e.getMessage());
      }
    }

    if (!nullOrEmpty(filter) && !filter.equals("{}")) {
      applySearchFilter(filter, requestBuilder);
    }

    // Apply RBAC query
    if (shouldApplyRbacConditions(subjectContext, rbacConditionEvaluator)) {
      OMQueryBuilder rbacQueryBuilder = rbacConditionEvaluator.evaluateConditions(subjectContext);
      if (rbacQueryBuilder != null) {
        Query rbacQuery = ((OpenSearchQueryBuilder) rbacQueryBuilder).buildV2();
        Query existingQuery = requestBuilder.query();
        if (existingQuery != null) {
          Query combinedQuery =
              Query.of(
                  qb ->
                      qb.bool(
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

    return doListWithOffset(limit, offset, index, searchSortFilter, requestBuilder);
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
      List<FieldValue> searchAfterList = new ArrayList<>();
      for (Object value : searchAfter) {
        if (value instanceof FieldValue) {
          searchAfterList.add((FieldValue) value);
        } else {
          searchAfterList.add(FieldValue.of(String.valueOf(value)));
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
      Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
      SearchResponse<JsonData> response;
      try {
        response = client.search(searchRequest, JsonData.class);
      } finally {
        if (searchTimerSample != null) {
          RequestLatencyContext.endSearchOperation(searchTimerSample);
        }
      }

      List<Map<String, Object>> results = new ArrayList<>();
      Object[] lastHitSortValues = null;
      Object[] lastDocumentsInBatch = null;

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

        if (hits.size() <= size) {
          Hit<JsonData> lastHit = hits.getLast();
          List<FieldValue> sortValues = lastHit.sort();
          if (sortValues != null && !sortValues.isEmpty()) {
            lastDocumentsInBatch =
                sortValues.stream().map(fv -> String.valueOf(fv._get())).toArray(String[]::new);
          }
        }
      }

      long totalHits = 0;
      if (response.hits().total() != null) {
        totalHits = response.hits().total().value();
      }

      return new SearchResultListMapper(
          results, totalHits, lastHitSortValues, lastDocumentsInBatch);
    } catch (OpenSearchException e) {
      if (e.status() == 404) {
        throw new SearchIndexNotFoundException(String.format("Failed to find index %s", index));
      } else {
        throw new SearchException(String.format("Search failed due to %s", e.getMessage()));
      }
    }
  }

  /**
   * Search with Natural Language Query (NLQ).
   * Transforms natural language query to OpenSearch query using NLQ service,
   * then executes the search using the new Java API client.
   */
  @Override
  public Response searchWithNLQ(
      org.openmetadata.schema.search.SearchRequest request, SubjectContext subjectContext) {
    LOG.info("Searching with NLQ: {}", request.getQuery());

    if (nlqService != null) {
      try {
        String transformedQuery = nlqService.transformNaturalLanguageQuery(request, null);
        if (transformedQuery == null) {
          LOG.info("Failed to get Transformed NLQ query");
          return fallbackToBasicSearch(request, subjectContext);
        }

        LOG.debug("Transformed NLQ query: {}", transformedQuery);

        // Start search operation timing
        Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();

        // Parse the transformed query and create Query object
        OpenSearchRequestBuilder requestBuilder = new OpenSearchRequestBuilder();
        String queryToProcess = OsUtils.parseJsonQuery(transformedQuery);
        Query nlqQuery = Query.of(q -> q.wrapper(w -> w.query(queryToProcess)));
        requestBuilder.query(nlqQuery);

        requestBuilder.from(request.getFrom());
        requestBuilder.size(request.getSize());

        // Add aggregations for NLQ query
        addAggregationsToNLQQuery(requestBuilder, request.getIndex());

        SearchResponse<JsonData> response =
            client.search(requestBuilder.build(request.getIndex()), JsonData.class);

        // End search operation timing
        if (searchTimerSample != null) {
          RequestLatencyContext.endSearchOperation(searchTimerSample);
        }

        // Cache successful queries
        if (response.hits() != null
            && response.hits().total() != null
            && response.hits().total().value() > 0) {
          nlqService.cacheQuery(request.getQuery(), transformedQuery);
        }

        return Response.status(Response.Status.OK).entity(response.toJsonString()).build();
      } catch (Exception e) {
        LOG.error("Error transforming or executing NLQ query: {}", e.getMessage(), e);
        return fallbackToBasicSearch(request, subjectContext);
      }
    } else {
      return fallbackToBasicSearch(request, subjectContext);
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
      Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
      SearchResponse<JsonData> response;
      try {
        response = client.search(searchRequest, JsonData.class);
      } finally {
        if (searchTimerSample != null) {
          RequestLatencyContext.endSearchOperation(searchTimerSample);
        }
      }

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

  @Override
  public Response searchEntityRelationship(
      String fqn, int upstreamDepth, int downstreamDepth, String queryFilter, boolean deleted)
      throws IOException {
    Map<String, Object> responseMap =
        searchEntityRelationshipInternal(fqn, upstreamDepth, downstreamDepth, queryFilter, deleted);
    return Response.status(OK).entity(responseMap).build();
  }

  @Override
  public Response searchSchemaEntityRelationship(
      String fqn, int upstreamDepth, int downstreamDepth, String queryFilter, boolean deleted)
      throws IOException {
    Map<String, Object> responseMap =
        searchSchemaEntityRelationshipInternal(
            fqn, upstreamDepth, downstreamDepth, queryFilter, deleted);
    return Response.status(OK).entity(responseMap).build();
  }

  @Override
  public Response searchDataQualityLineage(
      String fqn, int upstreamDepth, String queryFilter, boolean deleted) throws IOException {
    Map<String, Object> responseMap = new HashMap<>();
    Set<EsLineageData> edges = new HashSet<>();
    Set<Map<String, Object>> nodes = new HashSet<>();
    searchDataQualityLineageInternal(fqn, upstreamDepth, queryFilter, deleted, edges, nodes);
    responseMap.put("edges", edges);
    responseMap.put("nodes", nodes);
    return Response.status(OK).entity(responseMap).build();
  }

  private void searchDataQualityLineageInternal(
      String fqn,
      int upstreamDepth,
      String queryFilter,
      boolean deleted,
      Set<EsLineageData> edges,
      Set<Map<String, Object>> nodes)
      throws IOException {
    Map<String, Map<String, Object>> allNodes = new HashMap<>();
    Map<String, List<EsLineageData>> allEdges = new HashMap<>();
    Set<String> nodesWithFailures = new HashSet<>();

    collectNodesAndEdgesForDQ(
        fqn,
        upstreamDepth,
        queryFilter,
        deleted,
        allEdges,
        allNodes,
        nodesWithFailures,
        new HashSet<>());
    for (String nodeWithFailure : nodesWithFailures) {
      traceBackDQLineage(
          nodeWithFailure, nodesWithFailures, allEdges, allNodes, nodes, edges, new HashSet<>());
    }
  }

  private void collectNodesAndEdgesForDQ(
      String fqn,
      int upstreamDepth,
      String queryFilter,
      boolean deleted,
      Map<String, List<EsLineageData>> allEdges,
      Map<String, Map<String, Object>> allNodes,
      Set<String> nodesWithFailure,
      Set<String> processedNode)
      throws IOException {
    TestCaseResultRepository testCaseResultRepository = new TestCaseResultRepository();
    if (upstreamDepth <= 0 || processedNode.contains(fqn)) {
      return;
    }
    processedNode.add(fqn);
    SearchResponse<JsonData> searchResponse = performLineageSearchForDQ(fqn, queryFilter, deleted);
    Optional<List> optionalDocs =
        JsonUtils.readJsonAtPath(
            searchResponse.toJsonString(), "$.hits.hits[*]._source", List.class);

    if (optionalDocs.isPresent()) {
      List<Map<String, Object>> docs = (List<Map<String, Object>>) optionalDocs.get();
      for (Map<String, Object> doc : docs) {
        String nodeId = doc.get("id").toString();
        allNodes.put(nodeId, doc);
        if (testCaseResultRepository.hasTestCaseFailure(doc.get("fullyQualifiedName").toString())) {
          nodesWithFailure.add(nodeId);
        }

        List<EsLineageData> lineageDataList =
            JsonUtils.readOrConvertValues(doc.get("upstreamLineage"), EsLineageData.class);
        for (EsLineageData lineage : lineageDataList) {
          lineage.withToEntity(SearchUtils.getRelationshipRef(doc));
          String fromEntityId = lineage.getFromEntity().getId().toString();
          allEdges.computeIfAbsent(fromEntityId, k -> new ArrayList<>()).add(lineage);
          collectNodesAndEdgesForDQ(
              lineage.getFromEntity().getFullyQualifiedName(),
              upstreamDepth - 1,
              queryFilter,
              deleted,
              allEdges,
              allNodes,
              nodesWithFailure,
              processedNode);
        }
      }
    }
  }

  private void traceBackDQLineage(
      String nodeFailureId,
      Set<String> nodesWithFailures,
      Map<String, List<EsLineageData>> allEdges,
      Map<String, Map<String, Object>> allNodes,
      Set<Map<String, Object>> nodes,
      Set<EsLineageData> edges,
      Set<String> processedNodes) {
    if (processedNodes.contains(nodeFailureId)) {
      return;
    }

    processedNodes.add(nodeFailureId);
    if (nodesWithFailures.contains(nodeFailureId)) {
      Map<String, Object> node = allNodes.get(nodeFailureId);
      if (node != null) {
        node.keySet().removeAll(FIELDS_TO_REMOVE);
        node.remove("upstreamLineage");
        nodes.add(node);
      }
    }
    List<EsLineageData> edgesForNode = allEdges.get(nodeFailureId);
    if (edgesForNode != null) {
      for (EsLineageData edge : edgesForNode) {
        String fromEntityId = edge.getFromEntity().getId().toString();
        if (!fromEntityId.equals(nodeFailureId)) continue;
        edges.add(edge);
        traceBackDQLineage(
            edge.getToEntity().getId().toString(),
            nodesWithFailures,
            allEdges,
            allNodes,
            nodes,
            edges,
            processedNodes);
      }
    }
  }

  private SearchResponse<JsonData> performLineageSearchForDQ(
      String fqn, String queryFilter, boolean deleted) throws IOException {
    String indexName = Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS);

    Query fqnHashQuery =
        Query.of(
            q ->
                q.term(
                    t ->
                        t.field("fqnHash.keyword")
                            .value(FieldValue.of(FullyQualifiedName.buildHash(fqn)))));

    Query deletedQuery =
        Query.of(
            q ->
                q.term(
                    t ->
                        t.field("deleted").value(FieldValue.of(!nullOrEmpty(deleted) && deleted))));

    List<Query> mustQueries = new ArrayList<>();
    mustQueries.add(fqnHashQuery);
    mustQueries.add(deletedQuery);

    List<Query> filterQueries = new ArrayList<>();

    if (!nullOrEmpty(queryFilter) && !queryFilter.equals("{}")) {
      String queryToProcess = OsUtils.parseJsonQuery(queryFilter);
      Query filterQuery = Query.of(q -> q.wrapper(w -> w.query(queryToProcess)));
      filterQueries.add(filterQuery);
    }

    Query boolQuery = Query.of(q -> q.bool(b -> b.must(mustQueries).filter(filterQueries)));

    Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
    try {
      return client.search(s -> s.index(indexName).query(boolQuery).size(1000), JsonData.class);
    } finally {
      if (searchTimerSample != null) {
        RequestLatencyContext.endSearchOperation(searchTimerSample);
      }
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

  private void addAggregationsToNLQQuery(
      OpenSearchRequestBuilder requestBuilder, String indexName) {
    OpenSearchSourceBuilderFactory sourceBuilderFactory = getSearchBuilderFactory();
    SearchSettings searchSettings =
        SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class);
    AssetTypeConfiguration assetConfig =
        sourceBuilderFactory.findAssetTypeConfig(indexName, searchSettings);
    sourceBuilderFactory.addConfiguredAggregationsV2(requestBuilder, assetConfig);
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
            request.getExplain(),
            request.getIncludeAggregations() != null ? request.getIncludeAggregations() : true);

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
      Query semanticQuery = semanticBuilder.buildSemanticQuery(request);
      if (semanticQuery != null) {
        requestBuilder.query(semanticQuery);
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
      List<FieldValue> searchAfterValues =
          request.getSearchAfter().stream()
              .map(v -> FieldValue.of(String.valueOf(v)))
              .collect(Collectors.toList());
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
      Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();

      SearchRequest searchRequest = requestBuilder.build(request.getIndex());
      SearchResponse<JsonData> searchResponse = client.search(searchRequest, JsonData.class);

      if (searchTimerSample != null) {
        RequestLatencyContext.endSearchOperation(searchTimerSample);
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

    // Build bool query matching main branch structure - all should clauses at same level
    org.openmetadata.service.search.opensearch.OpenSearchQueryBuilder.BoolQueryBuilder
        baseQueryBuilder =
            org.openmetadata.service.search.opensearch.OpenSearchQueryBuilder.boolQuery()
                .should(existingQuery)
                .should(
                    Query.of(
                        q ->
                            q.matchPhrase(
                                mp -> mp.field("fullyQualifiedName").query(request.getQuery()))))
                .should(
                    Query.of(q -> q.matchPhrase(mp -> mp.field("name").query(request.getQuery()))))
                .should(
                    Query.of(
                        q ->
                            q.matchPhrase(
                                mp -> mp.field("displayName").query(request.getQuery()))));

    if (indexName.equalsIgnoreCase(glossaryTermIndex)) {
      baseQueryBuilder
          .should(
              Query.of(
                  q ->
                      q.matchPhrase(
                          mp -> mp.field("glossary.fullyQualifiedName").query(request.getQuery()))))
          .should(
              Query.of(
                  q ->
                      q.matchPhrase(
                          mp -> mp.field("glossary.displayName").query(request.getQuery()))))
          .must(
              Query.of(
                  q -> q.match(m -> m.field("entityStatus").query(FieldValue.of("Approved")))));
    } else if (indexName.equalsIgnoreCase(domainIndex)) {
      baseQueryBuilder
          .should(
              Query.of(
                  q ->
                      q.matchPhrase(
                          mp -> mp.field("parent.fullyQualifiedName").query(request.getQuery()))))
          .should(
              Query.of(
                  q ->
                      q.matchPhrase(
                          mp -> mp.field("parent.displayName").query(request.getQuery()))));
    }

    baseQueryBuilder.minimumShouldMatch(1);
    Query originalQuery = baseQueryBuilder.build();
    requestBuilder.query(originalQuery);

    // Add fqnParts aggregation to fetch parent terms
    requestBuilder.aggregation(
        "fqnParts_agg",
        os.org.opensearch.client.opensearch._types.aggregations.Aggregation.of(
            a -> a.terms(t -> t.field("fqnParts").size(1000))));

    // Execute search to get aggregations for parent terms
    SearchRequest searchRequest = requestBuilder.build(request.getIndex());
    Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
    SearchResponse<JsonData> searchResponse;
    try {
      searchResponse = client.search(searchRequest, JsonData.class);
    } finally {
      if (searchTimerSample != null) {
        RequestLatencyContext.endSearchOperation(searchTimerSample);
      }
    }

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

        // Combine the original query with parent term queries to preserve relevance scores
        Query combinedQuery =
            Query.of(
                q ->
                    q.bool(
                        b -> {
                          // Add the original query as a should clause to preserve high scores
                          b.should(originalQuery);
                          // Add parent term queries as should clauses to fetch hierarchy
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
        requestBuilder.query(combinedQuery);
      }
    }

    // Add sorting by score first for relevance, then by fullyQualifiedName for consistent hierarchy
    // ordering
    requestBuilder.sort("_score", SortOrder.Desc, null);
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

  /**
   * Fallback to basic query_string search when NLQ transformation fails or is unavailable.
   * Uses the new Java API client for query execution.
   */
  private Response fallbackToBasicSearch(
      org.openmetadata.schema.search.SearchRequest request, SubjectContext subjectContext) {
    try {
      LOG.debug("Falling back to basic query_string search for NLQ: {}", request.getQuery());

      OpenSearchRequestBuilder requestBuilder = new OpenSearchRequestBuilder();

      // Build basic query_string query using new API
      Query queryStringQuery =
          Query.of(
              q -> q.queryString(qs -> qs.query(request.getQuery()).defaultOperator(Operator.And)));

      requestBuilder.query(queryStringQuery);
      requestBuilder.from(request.getFrom());
      requestBuilder.size(request.getSize());

      // Apply RBAC constraints using applyRbacQueryWithCaching
      try {
        applyRbacQueryWithCaching(subjectContext, requestBuilder);
      } catch (IOException e) {
        LOG.warn("Failed to apply RBAC query with caching, continuing without RBAC", e);
      }

      // Add aggregations for fallback NLQ search
      addAggregationsToNLQQuery(requestBuilder, request.getIndex());

      SearchRequest searchRequest = requestBuilder.build(request.getIndex());
      Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
      SearchResponse<JsonData> searchResponse;
      try {
        searchResponse = client.search(searchRequest, JsonData.class);
      } finally {
        if (searchTimerSample != null) {
          RequestLatencyContext.endSearchOperation(searchTimerSample);
        }
      }

      return Response.status(Response.Status.OK).entity(searchResponse.toJsonString()).build();
    } catch (Exception e) {
      LOG.error("Error in fallback search: {}", e.getMessage(), e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity(String.format("Failed to execute natural language search: %s", e.getMessage()))
          .build();
    }
  }

  public Map<String, Object> searchEntityRelationshipInternal(
      String fqn, int upstreamDepth, int downstreamDepth, String queryFilter, boolean deleted)
      throws IOException {
    Map<String, Object> responseMap = new HashMap<>();
    Set<Map<String, Object>> edges = new HashSet<>();
    Set<Map<String, Object>> nodes = new HashSet<>();

    Query query =
        Query.of(q -> q.term(t -> t.field("fullyQualifiedName").value(FieldValue.of(fqn))));

    SearchRequest searchRequest =
        SearchRequest.of(
            s ->
                s.index(Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS))
                    .query(query)
                    .size(1000));

    Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
    SearchResponse<JsonData> searchResponse;
    try {
      searchResponse = client.search(searchRequest, JsonData.class);
    } finally {
      if (searchTimerSample != null) {
        RequestLatencyContext.endSearchOperation(searchTimerSample);
      }
    }

    for (var hit : searchResponse.hits().hits()) {
      if (hit.source() != null) {
        Map<String, Object> tempMap = new HashMap<>(OsUtils.jsonDataToMap(hit.source()));
        tempMap.keySet().removeAll(FIELDS_TO_REMOVE);
        responseMap.put("entity", tempMap);
      }
    }
    getEntityRelationship(
        fqn,
        downstreamDepth,
        edges,
        nodes,
        queryFilter,
        ENTITY_RELATIONSHIP_DIRECTION_ENTITY,
        deleted);
    getEntityRelationship(
        fqn,
        upstreamDepth,
        edges,
        nodes,
        queryFilter,
        ENTITY_RELATIONSHIP_DIRECTION_RELATED_ENTITY,
        deleted);
    responseMap.put("edges", edges);
    responseMap.put("nodes", nodes);
    return responseMap;
  }

  public Map<String, Object> searchSchemaEntityRelationshipInternal(
      String fqn, int upstreamDepth, int downstreamDepth, String queryFilter, boolean deleted)
      throws IOException {
    Map<String, Object> responseMap = new HashMap<>();
    Set<Map<String, Object>> edges = new HashSet<>();
    Set<Map<String, Object>> nodes = new HashSet<>();

    Query query =
        Query.of(q -> q.term(t -> t.field("fullyQualifiedName").value(FieldValue.of(fqn))));

    SearchRequest searchRequest =
        SearchRequest.of(
            s ->
                s.index(Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS))
                    .query(query)
                    .size(1000));

    Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
    SearchResponse<JsonData> searchResponse;
    try {
      searchResponse = client.search(searchRequest, JsonData.class);
    } finally {
      if (searchTimerSample != null) {
        RequestLatencyContext.endSearchOperation(searchTimerSample);
      }
    }

    for (var hit : searchResponse.hits().hits()) {
      if (hit.source() != null) {
        Map<String, Object> tempMap = new HashMap<>(JsonUtils.getMap(hit.source()));
        tempMap.keySet().removeAll(FIELDS_TO_REMOVE);
        responseMap.put("entity", tempMap);
      }
    }

    TableRepository repository = (TableRepository) Entity.getEntityRepository(TABLE);
    ListFilter filter = new ListFilter(Include.NON_DELETED).addQueryParam("databaseSchema", fqn);
    List<Table> tables =
        repository.listAll(repository.getFields("tableConstraints, displayName, owners"), filter);
    for (Table table : tables) {
      getEntityRelationship(
          table.getFullyQualifiedName(),
          downstreamDepth,
          edges,
          nodes,
          queryFilter,
          ENTITY_RELATIONSHIP_DIRECTION_ENTITY,
          deleted);
      getEntityRelationship(
          table.getFullyQualifiedName(),
          upstreamDepth,
          edges,
          nodes,
          queryFilter,
          ENTITY_RELATIONSHIP_DIRECTION_RELATED_ENTITY,
          deleted);
    }

    // Add the remaining tables from the list into the nodes
    // These will the one's that do not have any entity relationship
    for (Table table : tables) {
      boolean tablePresent = false;
      for (Map<String, Object> node : nodes) {
        if (table.getId().toString().equals(node.get("id"))) {
          tablePresent = true;
          break;
        }
      }
      if (!tablePresent) {
        HashMap<String, Object> tableMap = new HashMap<>(JsonUtils.getMap(table));
        tableMap.keySet().removeAll(FIELDS_TO_REMOVE_ENTITY_RELATIONSHIP);
        tableMap.put("entityType", "table");
        nodes.add(tableMap);
      }
    }
    responseMap.put("edges", edges);
    responseMap.put("nodes", nodes);
    return responseMap;
  }

  private void getEntityRelationship(
      String fqn,
      int depth,
      Set<Map<String, Object>> edges,
      Set<Map<String, Object>> nodes,
      String queryFilter,
      String direction,
      boolean deleted)
      throws IOException {
    if (depth <= 0) {
      return;
    }
    Query directionQuery =
        Query.of(
            q ->
                q.term(
                    t ->
                        t.field(direction)
                            .value(FieldValue.of(FullyQualifiedName.buildHash(fqn)))));

    Query baseQuery = directionQuery;

    if (!CommonUtil.nullOrEmpty(deleted)) {
      Query deletedQuery =
          Query.of(q -> q.term(t -> t.field("deleted").value(FieldValue.of(deleted))));
      baseQuery = Query.of(q -> q.bool(b -> b.must(directionQuery).must(deletedQuery)));
    }

    if (!nullOrEmpty(queryFilter) && !queryFilter.equals("{}")) {
      try {
        String queryToProcess = OsUtils.parseJsonQuery(queryFilter);
        Query filterQuery = Query.of(q -> q.wrapper(w -> w.query(queryToProcess)));
        final Query finalBaseQueryTemp = baseQuery;
        baseQuery = Query.of(q -> q.bool(b -> b.must(finalBaseQueryTemp).filter(filterQuery)));
      } catch (Exception ex) {
        LOG.warn("Error parsing query_filter from query parameters, ignoring filter", ex);
      }
    }

    Query finalBaseQuery = baseQuery;
    SearchRequest searchRequest =
        SearchRequest.of(
            s ->
                s.index(Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS))
                    .query(finalBaseQuery)
                    .size(1000));

    Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
    SearchResponse<JsonData> searchResponse;
    try {
      searchResponse = client.search(searchRequest, JsonData.class);
    } finally {
      if (searchTimerSample != null) {
        RequestLatencyContext.endSearchOperation(searchTimerSample);
      }
    }

    for (var hit : searchResponse.hits().hits()) {
      if (hit.source() != null) {
        Map<String, Object> sourceMap = OsUtils.jsonDataToMap(hit.source());
        List<Map<String, Object>> entityRelationship =
            (List<Map<String, Object>>) sourceMap.get("entityRelationship");
        if (entityRelationship == null) {
          continue;
        }
        HashMap<String, Object> tempMap = new HashMap<>(sourceMap);
        tempMap.keySet().removeAll(FIELDS_TO_REMOVE_ENTITY_RELATIONSHIP);
        nodes.add(tempMap);
        for (Map<String, Object> er : entityRelationship) {
          Map<String, String> entity = (HashMap<String, String>) er.get("entity");
          Map<String, String> relatedEntity = (HashMap<String, String>) er.get("relatedEntity");
          if (direction.equalsIgnoreCase(ENTITY_RELATIONSHIP_DIRECTION_ENTITY)) {
            if (!edges.contains(er) && entity.get("fqn").equals(fqn)) {
              edges.add(er);
              getEntityRelationship(
                  relatedEntity.get("fqn"),
                  depth - 1,
                  edges,
                  nodes,
                  queryFilter,
                  direction,
                  deleted);
            }
          } else {
            if (!edges.contains(er) && relatedEntity.get("fqn").equals(fqn)) {
              edges.add(er);
              getEntityRelationship(
                  entity.get("fqn"), depth - 1, edges, nodes, queryFilter, direction, deleted);
            }
          }
        }
      }
    }
  }
}
