package org.openmetadata.service.search.opensearch.aggregations;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.search.SearchAggregationNode;
import os.org.opensearch.client.json.JsonpMapper;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregation;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;

@Setter
@Getter
@Slf4j
public class OpenFilterAggregations implements OpenAggregations {
  private String aggregationName;
  private Aggregation aggregation;
  private Map<String, Aggregation> subAggregations = new HashMap<>();
  private JsonpMapper mapper;
  private Query filterQuery;
  private ObjectMapper objectMapper;

  public OpenFilterAggregations() {}

  public OpenFilterAggregations(JsonpMapper mapper) {
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

      String base64Query = Base64.getEncoder().encodeToString(queryToProcess.getBytes());
      this.filterQuery = Query.of(q -> q.wrapper(w -> w.query(base64Query)));
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
