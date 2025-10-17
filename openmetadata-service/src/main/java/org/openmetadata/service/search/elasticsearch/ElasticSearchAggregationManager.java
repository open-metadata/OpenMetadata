package org.openmetadata.service.search.elasticsearch;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.SortOrder;
import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.elasticsearch.core.SearchResponse;
import es.co.elastic.clients.json.JsonData;
import es.co.elastic.clients.json.JsonpMapper;
import es.co.elastic.clients.util.NamedValue;
import jakarta.json.spi.JsonProvider;
import jakarta.json.stream.JsonParser;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.StringReader;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.AggregationManagementClient;

@Slf4j
public class ElasticSearchAggregationManager implements AggregationManagementClient {
  private final ElasticsearchClient client;
  private final boolean isClientAvailable;

  public ElasticSearchAggregationManager(ElasticsearchClient client) {
    this.client = client;
    this.isClientAvailable = client != null;
  }

  @Override
  public Response aggregate(AggregationRequest request) throws IOException {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot perform aggregation.");
      throw new IOException("ElasticSearch client is not available");
    }

    try {
      SearchRequest.Builder searchRequestBuilder = new SearchRequest.Builder();

      String indexName = Entity.getSearchRepository().getIndexOrAliasName(request.getIndex());
      searchRequestBuilder.index(indexName);

      Query query = null;

      if (request.getQuery() != null && !request.getQuery().isEmpty()) {
        if (request.getQuery().trim().startsWith("{")) {
          try {
            JsonpMapper mapper = client._transport().jsonpMapper();
            JsonProvider provider = mapper.jsonProvider();
            JsonParser parser = provider.createParser(new StringReader(request.getQuery()));

            query = Query._DESERIALIZER.deserialize(parser, mapper);
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
            Query.of(q -> q.term(t -> t.field("deleted").value(request.getDeleted())));

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
                                    .order(
                                        Collections.singletonList(
                                            NamedValue.of("_key", SortOrder.Asc)))
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
                                .order(
                                    Collections.singletonList(NamedValue.of("_key", SortOrder.Asc)))
                                .include(tb -> tb.regexp(includeValue))));
      }

      aggregations.put(aggregationField, termsAgg);

      searchRequestBuilder.aggregations(aggregations);
      searchRequestBuilder.size(0);
      searchRequestBuilder.timeout("30s");

      SearchResponse<JsonData> searchResponse =
          client.search(searchRequestBuilder.build(), JsonData.class);
      return Response.status(Response.Status.OK).entity(searchResponse.toString()).build();
    } catch (Exception e) {
      LOG.error("Failed to execute aggregation", e);
      throw new IOException("Failed to execute aggregation: " + e.getMessage(), e);
    }
  }
}
