package org.openmetadata.service.search.opensearch;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.Timer;
import jakarta.json.JsonObject;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.Base64;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.AggregationManagementClient;
import org.openmetadata.service.search.SearchAggregation;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.SearchUtils;
import org.openmetadata.service.search.opensearch.aggregations.OpenAggregationsBuilder;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilder;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.security.RBACConditionEvaluator;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.FieldValue;
import os.org.opensearch.client.opensearch._types.SortOrder;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregation;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;

@Slf4j
public class OpenSearchAggregationManager implements AggregationManagementClient {
  private final OpenSearchClient client;
  private final boolean isClientAvailable;
  private final ObjectMapper mapper;
  private RBACConditionEvaluator rbacConditionEvaluator;

  public OpenSearchAggregationManager(OpenSearchClient client) {
    this.client = client;
    this.isClientAvailable = client != null;
    mapper = new ObjectMapper();
  }

  public OpenSearchAggregationManager(
      OpenSearchClient client, RBACConditionEvaluator rbacConditionEvaluator) {
    this.client = client;
    this.isClientAvailable = client != null;
    this.rbacConditionEvaluator = rbacConditionEvaluator;
    mapper = new ObjectMapper();
  }

  private SearchResponse<JsonData> searchWithLenientDeserialization(SearchRequest request)
      throws IOException {
    return OsUtils.searchWithLenientDeserialization(client, request);
  }

  private String praseJsonQuery(String jsonQuery) throws JsonProcessingException {
    JsonNode rootNode = mapper.readTree(jsonQuery);
    String queryToProcess = jsonQuery;
    try {
      if (rootNode.has("query")) {
        queryToProcess = rootNode.get("query").toString();
      }
    } catch (Exception e) {
      LOG.debug("Query does not contain outer 'query' wrapper, using as-is");
    }
    return Base64.getEncoder().encodeToString(queryToProcess.getBytes());
  }

  @Override
  public Response aggregate(AggregationRequest request) throws IOException {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot perform aggregation.");
      throw new IOException("OpenSearch client is not available");
    }

    try {
      SearchRequest.Builder searchRequestBuilder = new SearchRequest.Builder();

      String indexName = Entity.getSearchRepository().getIndexOrAliasName(request.getIndex());
      searchRequestBuilder.index(indexName);

      Query query = null;

      if (request.getQuery() != null && !request.getQuery().isEmpty()) {
        if (request.getQuery().trim().startsWith("{")) {
          try {
            final var queryToProcess = praseJsonQuery(request.getQuery());
            query = Query.of(q -> q.wrapper(w -> w.query(queryToProcess)));
          } catch (Exception e) {
            LOG.error("Failed to parse JSON query: {}", request.getQuery(), e);
            throw new IOException("Failed to parse JSON query: " + e.getMessage(), e);
          }
        } else {
          query = Query.of(q -> q.queryString(qs -> qs.query(request.getQuery())));
        }
      }

      if (request.getDeleted() != null) {
        Query deletedQuery =
            Query.of(
                q -> q.term(t -> t.field("deleted").value(FieldValue.of(request.getDeleted()))));

        if (query != null) {
          final Query finalQuery = query;
          query = Query.of(q -> q.bool(b -> b.must(finalQuery).must(deletedQuery)));
        } else {
          query = deletedQuery;
        }
      }

      if (query != null) {
        searchRequestBuilder.query(query);
      }

      String aggregationField = request.getFieldName();
      if (aggregationField == null || aggregationField.isBlank()) {
        throw new IllegalArgumentException("Aggregation field (fieldName) cannot be null or empty");
      }

      int bucketSize = request.getSize();
      String includeValue = request.getFieldValue().toLowerCase();

      Map<String, Aggregation> aggregations = new HashMap<>();

      Aggregation termsAgg;

      if (request.getSourceFields() != null && !request.getSourceFields().isEmpty()) {
        List<String> topHitFields = request.getSourceFields();
        int topHitSize = request.getTopHits() != null ? request.getTopHits().getSize() : 10;

        termsAgg =
            Aggregation.of(
                a ->
                    a.terms(
                            t ->
                                t.field(aggregationField)
                                    .size(bucketSize)
                                    .order(Collections.singletonMap("_key", SortOrder.Asc))
                                    .include(tb -> tb.regexp(includeValue)))
                        .aggregations(
                            "top",
                            Aggregation.of(
                                th ->
                                    th.topHits(
                                        topHit ->
                                            topHit
                                                .size(topHitSize)
                                                .source(
                                                    s ->
                                                        s.filter(
                                                            f -> f.includes(topHitFields)))))));
      } else {
        termsAgg =
            Aggregation.of(
                a ->
                    a.terms(
                        t ->
                            t.field(aggregationField)
                                .size(bucketSize)
                                .order(Collections.singletonMap("_key", SortOrder.Asc))
                                .include(tb -> tb.regexp(includeValue))));
      }

      aggregations.put(aggregationField, termsAgg);

      searchRequestBuilder.aggregations(aggregations);
      searchRequestBuilder.size(0);
      searchRequestBuilder.timeout("30s");

      Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
      SearchResponse<JsonData> searchResponse;
      try {
        searchResponse = searchWithLenientDeserialization(searchRequestBuilder.build());
      } finally {
        if (searchTimerSample != null) {
          RequestLatencyContext.endSearchOperation(searchTimerSample);
        }
      }
      return Response.status(Response.Status.OK)
          .entity(OsUtils.toJsonStringLenient(searchResponse))
          .build();
    } catch (Exception e) {
      LOG.error("Failed to execute aggregation", e);
      throw new IOException("Failed to execute aggregation: " + e.getMessage(), e);
    }
  }

  @Override
  public DataQualityReport genericAggregation(
      String query, String index, SearchAggregation aggregationMetadata) throws IOException {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot perform aggregation.");
      throw new IOException("OpenSearch client is not available");
    }

    try {
      OpenAggregationsBuilder aggregationsBuilder =
          new OpenAggregationsBuilder(client._transport().jsonpMapper());
      Map<String, Aggregation> aggregations =
          aggregationsBuilder.buildAggregations(aggregationMetadata.getAggregationTree());

      SearchRequest.Builder searchRequestBuilder = new SearchRequest.Builder();
      String indexName = Entity.getSearchRepository().getIndexOrAliasName(index);
      searchRequestBuilder.index(indexName);

      Query parsedQuery;
      if (query != null) {
        // Check if query string contains outer "query" wrapper and extract inner query
        if (query.trim().startsWith("{")) {
          final var queryToProcess = praseJsonQuery(query);
          parsedQuery = Query.of(q -> q.wrapper(w -> w.query(queryToProcess)));
        } else {
          parsedQuery = Query.of(q -> q.queryString(qs -> qs.query(query)));
        }
        searchRequestBuilder.query(parsedQuery);
      }

      searchRequestBuilder.aggregations(aggregations);
      searchRequestBuilder.size(0);
      searchRequestBuilder.timeout("30s");

      Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
      SearchResponse<JsonData> searchResponse;
      try {
        searchResponse = searchWithLenientDeserialization(searchRequestBuilder.build());
      } finally {
        if (searchTimerSample != null) {
          RequestLatencyContext.endSearchOperation(searchTimerSample);
        }
      }

      String response = OsUtils.toJsonStringLenient(searchResponse);
      JsonObject jsonResponse = JsonUtils.readJson(response).asJsonObject();
      Optional<JsonObject> aggregationResults =
          Optional.ofNullable(jsonResponse.getJsonObject("aggregations"));
      return SearchIndexUtils.parseAggregationResults(
          aggregationResults, aggregationMetadata.getAggregationMetadata());
    } catch (Exception e) {
      LOG.error("Failed to execute generic aggregation", e);
      throw new IOException("Failed to execute generic aggregation: " + e.getMessage(), e);
    }
  }

  @Override
  public DataQualityReport genericAggregation(
      String query,
      String index,
      SearchAggregation aggregationMetadata,
      SubjectContext subjectContext)
      throws IOException {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot perform aggregation.");
      throw new IOException("OpenSearch client is not available");
    }

    try {
      OpenAggregationsBuilder aggregationsBuilder =
          new OpenAggregationsBuilder(client._transport().jsonpMapper());
      Map<String, Aggregation> aggregations =
          aggregationsBuilder.buildAggregations(aggregationMetadata.getAggregationTree());

      SearchRequest.Builder searchRequestBuilder = new SearchRequest.Builder();
      String indexName = Entity.getSearchRepository().getIndexOrAliasName(index);
      searchRequestBuilder.index(indexName);

      Query parsedQuery = null;
      if (query != null) {
        // Check if query string contains outer "query" wrapper and extract inner query
        if (query.trim().startsWith("{")) {
          final var queryToProcess = praseJsonQuery(query);
          parsedQuery = Query.of(q -> q.wrapper(w -> w.query(queryToProcess)));
        } else {
          parsedQuery = Query.of(q -> q.queryString(qs -> qs.query(query)));
        }
      }

      // Apply RBAC conditions
      if (SearchUtils.shouldApplyRbacConditions(subjectContext, rbacConditionEvaluator)) {
        OMQueryBuilder rbacQueryBuilder = rbacConditionEvaluator.evaluateConditions(subjectContext);
        if (rbacQueryBuilder != null) {
          Query rbacQuery = ((OpenSearchQueryBuilder) rbacQueryBuilder).buildV2();
          if (parsedQuery != null) {
            final Query existingQuery = parsedQuery;
            Query combinedQuery =
                Query.of(
                    qb ->
                        qb.bool(
                            b -> {
                              b.must(existingQuery);
                              b.filter(rbacQuery);
                              return b;
                            }));
            parsedQuery = combinedQuery;
          } else {
            parsedQuery = rbacQuery;
          }
        }
      }

      if (parsedQuery != null) {
        searchRequestBuilder.query(parsedQuery);
      }

      searchRequestBuilder.aggregations(aggregations);
      searchRequestBuilder.size(0);
      searchRequestBuilder.timeout("30s");

      Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
      SearchResponse<JsonData> searchResponse;
      try {
        searchResponse = searchWithLenientDeserialization(searchRequestBuilder.build());
      } finally {
        if (searchTimerSample != null) {
          RequestLatencyContext.endSearchOperation(searchTimerSample);
        }
      }

      String response = OsUtils.toJsonStringLenient(searchResponse);
      JsonObject jsonResponse = JsonUtils.readJson(response).asJsonObject();
      Optional<JsonObject> aggregationResults =
          Optional.ofNullable(jsonResponse.getJsonObject("aggregations"));
      return SearchIndexUtils.parseAggregationResults(
          aggregationResults, aggregationMetadata.getAggregationMetadata());
    } catch (Exception e) {
      LOG.error("Failed to execute generic aggregation with RBAC", e);
      throw new IOException(
          "Failed to execute generic aggregation with RBAC: " + e.getMessage(), e);
    }
  }

  @Override
  public JsonObject aggregate(
      String query, String index, SearchAggregation searchAggregation, String filter)
      throws IOException {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot perform aggregation.");
      throw new IOException("OpenSearch client is not available");
    }

    if (searchAggregation == null) {
      return null;
    }

    try {
      OpenAggregationsBuilder aggregationsBuilder =
          new OpenAggregationsBuilder(client._transport().jsonpMapper());
      Map<String, Aggregation> aggregations =
          aggregationsBuilder.buildAggregations(searchAggregation.getAggregationTree());

      SearchRequest.Builder searchRequestBuilder = new SearchRequest.Builder();
      String indexName = Entity.getSearchRepository().getIndexOrAliasName(index);
      searchRequestBuilder.index(indexName);

      Query parsedQuery = null;
      if (query != null) {
        // Check if query string contains outer "query" wrapper and extract inner query
        if (query.trim().startsWith("{")) {
          final var queryToProcess = praseJsonQuery(query);
          parsedQuery = Query.of(q -> q.wrapper(w -> w.query(queryToProcess)));
        } else {
          parsedQuery = Query.of(q -> q.queryString(qs -> qs.query(query)));
        }
      }

      Query filterQuery = null;
      if (filter != null && !filter.isEmpty() && !filter.equals("{}")) {
        // Check if filter string contains outer "query" wrapper and extract inner query
        if (filter.trim().startsWith("{")) {
          final var filterToProcess = praseJsonQuery(filter);
          filterQuery = Query.of(q -> q.wrapper(w -> w.query(filterToProcess)));
        } else {
          filterQuery = Query.of(q -> q.queryString(qs -> qs.query(filter)));
        }
      }

      final Query finalParsedQuery = parsedQuery;
      final Query finalFilterQuery = filterQuery;

      if (finalParsedQuery != null && finalFilterQuery != null) {
        searchRequestBuilder.query(
            q -> q.bool(b -> b.must(finalParsedQuery).filter(finalFilterQuery)));
      } else if (finalParsedQuery != null) {
        searchRequestBuilder.query(finalParsedQuery);
      } else if (finalFilterQuery != null) {
        searchRequestBuilder.query(q -> q.bool(b -> b.filter(finalFilterQuery)));
      }

      searchRequestBuilder.aggregations(aggregations);
      searchRequestBuilder.size(0);
      searchRequestBuilder.timeout("30s");

      Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
      SearchResponse<JsonData> searchResponse;
      try {
        searchResponse = searchWithLenientDeserialization(searchRequestBuilder.build());
      } finally {
        if (searchTimerSample != null) {
          RequestLatencyContext.endSearchOperation(searchTimerSample);
        }
      }

      String response = OsUtils.toJsonStringLenient(searchResponse);
      JsonObject jsonResponse = JsonUtils.readJson(response).asJsonObject();
      return jsonResponse.getJsonObject("aggregations");
    } catch (Exception e) {
      LOG.error("Failed to execute aggregation", e);
      throw new IOException("Failed to execute aggregation: " + e.getMessage(), e);
    }
  }

  @Override
  public Response getEntityTypeCounts(
      org.openmetadata.schema.search.SearchRequest request, String index) throws IOException {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot perform get entity type counts");
      throw new IOException("OpenSearch client is not available");
    }

    try {
      // Get search settings for consistency with other search operations
      SearchSettings searchSettings =
          SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class);

      // Build request using the source builder factory for consistency
      OpenSearchSourceBuilderFactory searchBuilderFactory =
          new OpenSearchSourceBuilderFactory(searchSettings);
      OpenSearchRequestBuilder requestBuilder =
          searchBuilderFactory.getSearchSourceBuilderV2(
              index,
              request.getQuery() != null ? request.getQuery() : "*",
              0, // from
              0, // size - we only need aggregations
              false); // explain

      // Apply deleted filter if specified
      if (request.getDeleted() != null && request.getDeleted()) {
        Query currentQuery = requestBuilder.query();
        Query deletedQuery =
            Query.of(
                q -> q.term(t -> t.field("deleted").value(FieldValue.of(request.getDeleted()))));

        if (currentQuery != null) {
          final Query finalQuery = currentQuery;
          Query combined = Query.of(q -> q.bool(b -> b.must(finalQuery).must(deletedQuery)));
          requestBuilder.query(combined);
        } else {
          requestBuilder.query(deletedQuery);
        }
      }

      // Apply query filter if specified
      if (request.getQueryFilter() != null
          && !request.getQueryFilter().isEmpty()
          && !request.getQueryFilter().equals("{}")) {
        try {
          String queryToProcess = OsUtils.parseJsonQuery(request.getQueryFilter());
          Query filter = Query.of(q -> q.wrapper(w -> w.query(queryToProcess)));
          Query currentQuery = requestBuilder.query();

          if (currentQuery != null) {
            final Query finalQuery = currentQuery;
            Query combined = Query.of(q -> q.bool(b -> b.must(finalQuery).must(filter)));
            requestBuilder.query(combined);
          } else {
            requestBuilder.query(filter);
          }
        } catch (Exception ex) {
          LOG.error(
              "Error parsing query_filter from query parameters, ignoring filter: {}",
              request.getQueryFilter(),
              ex);
        }
      }

      // Set basic parameters
      requestBuilder.from(0);
      requestBuilder.size(0);
      requestBuilder.trackTotalHits(true);

      // Resolve the index alias properly
      String resolvedIndex =
          Entity.getSearchRepository().getIndexOrAliasName(index != null ? index : "all");

      // Build and execute search
      SearchRequest searchRequest = requestBuilder.build(resolvedIndex);
      Timer.Sample searchTimerSample = RequestLatencyContext.startSearchOperation();
      SearchResponse<JsonData> searchResponse;
      try {
        searchResponse = searchWithLenientDeserialization(searchRequest);
      } finally {
        if (searchTimerSample != null) {
          RequestLatencyContext.endSearchOperation(searchTimerSample);
        }
      }

      LOG.info("Entity type counts query for index '{}' (resolved: '{}')", index, resolvedIndex);

      String jsonResponse = OsUtils.toJsonStringLenient(searchResponse);
      return Response.status(Response.Status.OK).entity(jsonResponse).build();

    } catch (Exception e) {
      LOG.error(
          "Error executing entity type counts search for index: {}, query: {}",
          index,
          request.getQuery(),
          e);
      throw new SearchException(
          String.format("Failed to get entity type counts: %s", e.getMessage()));
    }
  }
}
