package org.openmetadata.service.search.opensearch;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.AggregationManagementClient;
import org.openmetadata.service.search.SearchAggregation;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.opensearch.aggregations.OpenAggregationsBuilder;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.json.JsonpMapper;
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

  public OpenSearchAggregationManager(OpenSearchClient client) {
    this.client = client;
    this.isClientAvailable = client != null;
    mapper = new ObjectMapper();
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

      SearchResponse<JsonData> searchResponse =
          client.search(searchRequestBuilder.build(), JsonData.class);
      return Response.status(Response.Status.OK).entity(searchResponse.toJsonString()).build();
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

      SearchResponse<JsonData> searchResponse =
          client.search(searchRequestBuilder.build(), JsonData.class);

      // Extract aggregations directly from the response
      Map<String, os.org.opensearch.client.opensearch._types.aggregations.Aggregate>
          aggregationsMap = searchResponse.aggregations();

      if (aggregationsMap == null || aggregationsMap.isEmpty()) {
        return SearchIndexUtils.parseAggregationResults(
            Optional.empty(), aggregationMetadata.getAggregationMetadata());
      }

      // Serialize aggregations to JSON for parsing
      JsonpMapper mapper = client._transport().jsonpMapper();
      jakarta.json.spi.JsonProvider provider = mapper.jsonProvider();
      java.io.StringWriter stringWriter = new java.io.StringWriter();
      jakarta.json.stream.JsonGenerator generator = provider.createGenerator(stringWriter);

      generator.writeStartObject();
      generator.writeKey("aggregations");
      generator.writeStartObject();
      for (Map.Entry<String, os.org.opensearch.client.opensearch._types.aggregations.Aggregate>
          entry : aggregationsMap.entrySet()) {
        generator.writeKey(entry.getKey());
        entry.getValue().serialize(generator, mapper);
      }
      generator.writeEnd();
      generator.writeEnd();
      generator.close();

      String aggregationsJson = stringWriter.toString();
      JsonObject jsonResponse = JsonUtils.readJson(aggregationsJson).asJsonObject();
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

      SearchResponse<JsonData> searchResponse =
          client.search(searchRequestBuilder.build(), JsonData.class);

      // Extract aggregations directly from the response
      Map<String, os.org.opensearch.client.opensearch._types.aggregations.Aggregate>
          aggregationsMap = searchResponse.aggregations();

      if (aggregationsMap == null || aggregationsMap.isEmpty()) {
        return null;
      }

      // Serialize aggregations to JSON for parsing
      JsonpMapper mapper = client._transport().jsonpMapper();
      jakarta.json.spi.JsonProvider provider = mapper.jsonProvider();
      java.io.StringWriter stringWriter = new java.io.StringWriter();
      jakarta.json.stream.JsonGenerator generator = provider.createGenerator(stringWriter);

      generator.writeStartObject();
      for (Map.Entry<String, os.org.opensearch.client.opensearch._types.aggregations.Aggregate>
          entry : aggregationsMap.entrySet()) {
        generator.writeKey(entry.getKey());
        entry.getValue().serialize(generator, mapper);
      }
      generator.writeEnd();
      generator.close();

      String aggregationsJson = stringWriter.toString();
      return JsonUtils.readJson(aggregationsJson).asJsonObject();
    } catch (Exception e) {
      LOG.error("Failed to execute aggregation", e);
      throw new IOException("Failed to execute aggregation: " + e.getMessage(), e);
    }
  }
}
