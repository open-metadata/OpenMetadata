package org.openmetadata.service.search.elasticsearch;

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

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.ElasticsearchException;
import es.co.elastic.clients.elasticsearch._types.FieldValue;
import es.co.elastic.clients.elasticsearch._types.SortMode;
import es.co.elastic.clients.elasticsearch._types.SortOrder;
import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregate;
import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.aggregations.StringTermsBucket;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Operator;
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
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilder;
import org.openmetadata.service.search.nlq.NLQService;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.security.RBACConditionEvaluator;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * ElasticSearch implementation of search management operations.
 * This class handles all search-related operations for ElasticSearch using the new Java API client.
 */
@Slf4j
public class ElasticSearchSearchManager implements SearchManagementClient {
  private final ElasticsearchClient client;
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

  public ElasticSearchSearchManager(
      ElasticsearchClient client,
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
        String queryToProcess = EsUtils.parseJsonQuery(queryString);
        Query query = Query.of(qb -> qb.withJson(new StringReader(queryToProcess)));
        requestBuilder.query(query);
      } catch (Exception e) {
        LOG.warn("Error parsing queryString parameter, ignoring: {}", e.getMessage());
      }
    }

    // Apply filter
    if (!nullOrEmpty(filter) && !filter.equals("{}")) {
      applySearchFilter(filter, requestBuilder);
    }

    return doListWithOffset(limit, offset, index, searchSortFilter, requestBuilder);
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
      throw new IOException("Elasticsearch client is not available");
    }

    ElasticSearchRequestBuilder requestBuilder = new ElasticSearchRequestBuilder();

    if (!nullOrEmpty(q)) {
      ElasticSearchSourceBuilderFactory searchBuilderFactory = getSearchBuilderFactory();
      requestBuilder =
          searchBuilderFactory.getSearchSourceBuilderV2(index, q, offset, limit, false);
    }

    if (!nullOrEmpty(queryString)) {
      try {
        String queryToProcess = EsUtils.parseJsonQuery(queryString);
        Query query = Query.of(qb -> qb.withJson(new StringReader(queryToProcess)));
        requestBuilder.query(query);
      } catch (Exception e) {
        LOG.warn("Error parsing queryString parameter, ignoring: {}", e.getMessage());
      }
    }

    if (!nullOrEmpty(filter) && !filter.equals("{}")) {
      applySearchFilter(filter, requestBuilder);
    }

    applyRbacCondition(subjectContext, requestBuilder);

    return doListWithOffset(limit, offset, index, searchSortFilter, requestBuilder);
  }

  @NotNull
  private SearchResultListMapper doListWithOffset(
      int limit,
      int offset,
      String index,
      SearchSortFilter searchSortFilter,
      ElasticSearchRequestBuilder requestBuilder)
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

  private void applyRbacCondition(
      SubjectContext subjectContext, ElasticSearchRequestBuilder requestBuilder) {
    if (shouldApplyRbacConditions(subjectContext, rbacConditionEvaluator)) {
      OMQueryBuilder rbacQueryBuilder = rbacConditionEvaluator.evaluateConditions(subjectContext);
      if (rbacQueryBuilder != null) {
        Query rbacQuery = ((ElasticQueryBuilder) rbacQueryBuilder).buildV2();
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
      Object[] lastDocumentsInBatch = null;

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

        if (hits.size() <= size) {
          Hit<JsonData> lastHit = hits.getLast();

          List<FieldValue> sortValues = lastHit.sort();
          if (sortValues != null && !sortValues.isEmpty()) {
            lastDocumentsInBatch =
                sortValues.stream()
                    .map(v -> v == null ? null : String.valueOf(v._get()))
                    .toArray(String[]::new);
          }
        }
      }

      long totalHits = 0;
      if (response.hits().total() != null) {
        totalHits = response.hits().total().value();
      }

      return new SearchResultListMapper(
          results, totalHits, lastHitSortValues, lastDocumentsInBatch);
    } catch (ElasticsearchException e) {
      if (e.status() == 404) {
        throw new SearchIndexNotFoundException(String.format("Failed to find index %s", index));
      } else {
        throw new SearchException(String.format("Search failed due to %s", e.getMessage()));
      }
    }
  }

  /**
   * Search with Natural Language Query (NLQ).
   * Transforms natural language query to Elasticsearch query using NLQ service,
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
        io.micrometer.core.instrument.Timer.Sample searchTimerSample =
            org.openmetadata.service.monitoring.RequestLatencyContext.startSearchOperation();

        // Parse the transformed query and create Query object
        ElasticSearchRequestBuilder requestBuilder = new ElasticSearchRequestBuilder();
        String queryToProcess = EsUtils.parseJsonQuery(transformedQuery);
        Query nlqQuery = Query.of(q -> q.withJson(new StringReader(queryToProcess)));
        requestBuilder.query(nlqQuery);

        requestBuilder.from(request.getFrom());
        requestBuilder.size(request.getSize());

        // Add aggregations for NLQ query
        addAggregationsToNLQQuery(requestBuilder, request.getIndex());

        SearchRequest searchRequest = requestBuilder.build(request.getIndex());
        SearchResponse<JsonData> response = client.search(searchRequest, JsonData.class);

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

        return Response.status(Response.Status.OK)
            .entity(serializeSearchResponse(response))
            .build();
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

  @Override
  public Response searchEntityRelationship(
      String fqn, int upstreamDepth, int downstreamDepth, String queryFilter, boolean deleted)
      throws IOException {
    java.util.Map<String, Object> responseMap =
        searchEntityRelationshipInternal(fqn, upstreamDepth, downstreamDepth, queryFilter, deleted);
    return Response.status(OK).entity(responseMap).build();
  }

  @Override
  public Response searchSchemaEntityRelationship(
      String fqn, int upstreamDepth, int downstreamDepth, String queryFilter, boolean deleted)
      throws IOException {
    java.util.Map<String, Object> responseMap =
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
            serializeSearchResponse(searchResponse), "$.hits.hits[*]._source", List.class);

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
      String queryToProcess = EsUtils.parseJsonQuery(queryFilter);
      Query filterQuery = Query.of(q -> q.withJson(new StringReader(queryToProcess)));
      filterQueries.add(filterQuery);
    }

    Query boolQuery = Query.of(q -> q.bool(b -> b.must(mustQueries).filter(filterQueries)));

    return client.search(s -> s.index(indexName).query(boolQuery).size(1000), JsonData.class);
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

  private void addAggregationsToNLQQuery(
      ElasticSearchRequestBuilder requestBuilder, String indexName) {
    ElasticSearchSourceBuilderFactory sourceBuilderFactory = getSearchBuilderFactory();
    SearchSettings searchSettings =
        SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class);
    AssetTypeConfiguration assetConfig =
        sourceBuilderFactory.findAssetTypeConfig(indexName, searchSettings);
    sourceBuilderFactory.addConfiguredAggregationsV2(requestBuilder, assetConfig);
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

  public Response doSearch(
      org.openmetadata.schema.search.SearchRequest request,
      SubjectContext subjectContext,
      SearchSettings searchSettings,
      String clusterAlias)
      throws IOException {
    if (!isClientAvailable) {
      throw new IOException("Elasticsearch client is not available");
    }

    String indexName = Entity.getSearchRepository().getIndexNameWithoutAlias(request.getIndex());
    ElasticSearchSourceBuilderFactory searchBuilderFactory =
        new ElasticSearchSourceBuilderFactory(searchSettings);

    ElasticSearchRequestBuilder requestBuilder =
        searchBuilderFactory.getSearchSourceBuilderV2(
            request.getIndex(),
            request.getQuery(),
            request.getFrom(),
            request.getSize(),
            request.getExplain(),
            request.getIncludeAggregations() != null ? request.getIncludeAggregations() : true);

    LOG.debug(
        "Elasticsearch query for index '{}' with sanitized query '{}': {}",
        request.getIndex(),
        request.getQuery(),
        requestBuilder.query());

    // Apply RBAC query
    applyRbacCondition(subjectContext, requestBuilder);

    // Apply query filter
    if (!nullOrEmpty(request.getQueryFilter()) && !request.getQueryFilter().equals("{}")) {
      try {
        String queryToProcess = EsUtils.parseJsonQuery(request.getQueryFilter());
        Query filterQuery = Query.of(q -> q.withJson(new StringReader(queryToProcess)));
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
        String postFilterToProcess = EsUtils.parseJsonQuery(request.getPostFilter());
        Query postFilterQuery = Query.of(q -> q.withJson(new StringReader(postFilterToProcess)));
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
    if (!nullOrEmpty(request.getSortFieldParam()) && !request.getIsHierarchy()) {
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
        String responseJson = serializeSearchResponse(searchResponse);
        return Response.status(OK).entity(responseJson).build();
      } else {
        List<?> response = buildSearchHierarchy(request, searchResponse, clusterAlias);
        return Response.status(OK).entity(response).build();
      }

    } catch (ElasticsearchException e) {
      if (e.status() == 404) {
        throw new SearchIndexNotFoundException(
            String.format("Failed to find index %s", request.getIndex()));
      } else {
        throw new SearchException(String.format("Search failed due to %s", e.getMessage()));
      }
    }
  }

  private ElasticSearchRequestBuilder buildHierarchyQuery(
      org.openmetadata.schema.search.SearchRequest request,
      ElasticSearchRequestBuilder requestBuilder,
      String clusterAlias)
      throws IOException {

    String indexName = request.getIndex();
    String glossaryTermIndex =
        Entity.getSearchRepository().getIndexMapping(GLOSSARY_TERM).getIndexName(clusterAlias);
    String domainIndex =
        Entity.getSearchRepository().getIndexMapping(DOMAIN).getIndexName(clusterAlias);

    Query existingQuery = requestBuilder.query();
    org.openmetadata.service.search.elasticsearch.ElasticQueryBuilder.BoolQueryBuilder
        baseQueryBuilder =
            org.openmetadata.service.search.elasticsearch.ElasticQueryBuilder.boolQuery()
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
          .must(Query.of(q -> q.match(m -> m.field("entityStatus").query("Approved"))));
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
        "fqnParts_agg", Aggregation.of(a -> a.terms(t -> t.field("fqnParts").size(1000))));

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
          String fqnPart = bucket.key().stringValue();
          Query matchQuery =
              Query.of(qt -> qt.match(m -> m.field("fullyQualifiedName").query(fqnPart)));
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
                            b.must(m -> m.match(ma -> ma.field("entityStatus").query("Approved")));
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

      ElasticSearchRequestBuilder requestBuilder = new ElasticSearchRequestBuilder();

      // Build basic query_string query using new API
      Query queryStringQuery =
          Query.of(
              q -> q.queryString(qs -> qs.query(request.getQuery()).defaultOperator(Operator.And)));

      requestBuilder.query(queryStringQuery);
      requestBuilder.from(request.getFrom());
      requestBuilder.size(request.getSize());

      // Apply RBAC constraints using new API
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

      // Add aggregations for fallback NLQ search
      addAggregationsToNLQQuery(requestBuilder, request.getIndex());

      SearchRequest searchRequest = requestBuilder.build(request.getIndex());
      SearchResponse<JsonData> searchResponse = client.search(searchRequest, JsonData.class);

      return Response.status(Response.Status.OK)
          .entity(serializeSearchResponse(searchResponse))
          .build();
    } catch (Exception e) {
      LOG.error("Error in fallback search: {}", e.getMessage(), e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity(String.format("Failed to execute natural language search: %s", e.getMessage()))
          .build();
    }
  }

  private Map<String, Object> searchEntityRelationshipInternal(
      String fqn, int upstreamDepth, int downstreamDepth, String queryFilter, boolean deleted)
      throws IOException {
    Map<String, Object> responseMap = new HashMap<>();
    Set<Map<String, Object>> edges = new HashSet<>();
    Set<Map<String, Object>> nodes = new HashSet<>();

    Query query =
        Query.of(
            q ->
                q.term(
                    t ->
                        t.field("fullyQualifiedName")
                            .value(es.co.elastic.clients.elasticsearch._types.FieldValue.of(fqn))));

    SearchRequest searchRequest =
        SearchRequest.of(
            s ->
                s.index(Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS))
                    .query(query)
                    .size(1000));

    SearchResponse<JsonData> searchResponse = client.search(searchRequest, JsonData.class);

    for (Hit<JsonData> hit : searchResponse.hits().hits()) {
      if (hit.source() != null) {
        Map<String, Object> tempMap = new HashMap<>(EsUtils.jsonDataToMap(hit.source()));
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

  private Map<String, Object> searchSchemaEntityRelationshipInternal(
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

    SearchResponse<JsonData> searchResponse = client.search(searchRequest, JsonData.class);

    for (Hit<JsonData> hit : searchResponse.hits().hits()) {
      if (hit.source() != null) {
        Map<String, Object> tempMap = new HashMap<>(EsUtils.jsonDataToMap(hit.source()));
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
                            .value(
                                es.co.elastic.clients.elasticsearch._types.FieldValue.of(
                                    FullyQualifiedName.buildHash(fqn)))));

    Query mainQuery = directionQuery;
    if (!CommonUtil.nullOrEmpty(deleted)) {
      Query deletedQuery =
          Query.of(q -> q.term(t -> t.field("deleted").value(FieldValue.of(deleted))));
      mainQuery = Query.of(q -> q.bool(b -> b.must(directionQuery).must(deletedQuery)));
    }

    if (!nullOrEmpty(queryFilter) && !queryFilter.equals("{}")) {
      try {
        String queryToProcess = EsUtils.parseJsonQuery(queryFilter);
        Query filterQuery = Query.of(q -> q.withJson(new java.io.StringReader(queryToProcess)));
        Query finalMainQueryTemp = mainQuery;
        mainQuery = Query.of(q -> q.bool(b -> b.must(finalMainQueryTemp).filter(filterQuery)));
      } catch (Exception ex) {
        LOG.warn("Error parsing query_filter from query parameters, ignoring filter", ex);
      }
    }

    Query finalMainQuery = mainQuery;
    SearchRequest searchRequest =
        SearchRequest.of(
            s ->
                s.index(Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS))
                    .query(finalMainQuery)
                    .size(1000));

    SearchResponse<JsonData> searchResponse = client.search(searchRequest, JsonData.class);

    for (Hit<JsonData> hit : searchResponse.hits().hits()) {
      if (hit.source() == null) {
        continue;
      }
      Map<String, Object> sourceAsMap = EsUtils.jsonDataToMap(hit.source());
      List<Map<String, Object>> entityRelationship =
          (List<Map<String, Object>>) sourceAsMap.get("entityRelationship");
      if (entityRelationship == null) {
        continue;
      }
      HashMap<String, Object> tempMap = new HashMap<>(sourceAsMap);
      tempMap.keySet().removeAll(FIELDS_TO_REMOVE_ENTITY_RELATIONSHIP);
      nodes.add(tempMap);
      for (Map<String, Object> er : entityRelationship) {
        Map<String, String> entity = (HashMap<String, String>) er.get("entity");
        Map<String, String> relatedEntity = (HashMap<String, String>) er.get("relatedEntity");
        if (direction.equalsIgnoreCase(ENTITY_RELATIONSHIP_DIRECTION_ENTITY)) {
          if (!edges.contains(er) && entity.get("fqn").equals(fqn)) {
            edges.add(er);
            getEntityRelationship(
                relatedEntity.get("fqn"), depth - 1, edges, nodes, queryFilter, direction, deleted);
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
