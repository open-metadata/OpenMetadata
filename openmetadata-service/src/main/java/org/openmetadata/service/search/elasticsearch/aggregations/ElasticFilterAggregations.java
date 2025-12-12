package org.openmetadata.service.search.elasticsearch.aggregations;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.json.JsonpMapper;
import java.io.StringReader;
import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.search.SearchAggregationNode;

@Setter
@Getter
@Slf4j
public class ElasticFilterAggregations implements ElasticAggregations {
  private String aggregationName;
  private Aggregation aggregation;
  private Map<String, Aggregation> subAggregations = new HashMap<>();
  private JsonpMapper mapper;
  private Query filterQuery;
  private ObjectMapper objectMapper;

  public ElasticFilterAggregations() {}

  public ElasticFilterAggregations(JsonpMapper mapper) {
    this.mapper = mapper;
    this.objectMapper = new ObjectMapper();
  }

  @Override
  public void createAggregation(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();
    String queryJson = params.get("query");
    this.aggregationName = node.getName();

    try {
      if (mapper == null) {
        throw new IllegalStateException("JsonpMapper is required for filter aggregations");
      }

      String queryToProcess = queryJson;
      if (queryJson != null && !queryJson.equals("{}")) {
        try {
          JsonNode rootNode = objectMapper.readTree(queryJson);
          JsonNode queryNode = rootNode.get("query");
          if (queryNode != null) {
            queryToProcess = queryNode.toString();
          }
        } catch (Exception e) {
          // If parsing fails, use original query string
          LOG.error(
              "Failed to parse query, fallback to query string passed: {}", e.getMessage(), e);
        }
      }

      final String finalQueryToProcess = queryToProcess;
      this.filterQuery = Query.of(q -> q.withJson(new StringReader(finalQueryToProcess)));
      this.aggregation = Aggregation.of(a -> a.filter(this.filterQuery));
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid filter query JSON: " + queryJson, e);
    }
  }

  @Override
  public void setSubAggregations(Map<String, Aggregation> subAggregations) {
    this.subAggregations = subAggregations;
    if (!subAggregations.isEmpty() && this.filterQuery != null) {
      this.aggregation =
          Aggregation.of(a -> a.filter(this.filterQuery).aggregations(subAggregations));
    }
  }

  @Override
  public Boolean supportsSubAggregationsNatively() {
    return true;
  }
}
