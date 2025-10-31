package org.openmetadata.service.search.elasticsearch.aggregations;

import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import java.util.Map;
import org.openmetadata.service.search.SearchAggregationNode;

public interface ElasticAggregations {
  void createAggregation(SearchAggregationNode node);

  default Boolean isPipelineAggregation() {
    return false;
  }

  default Boolean supportsSubAggregationsNatively() {
    return false;
  }

  default void setSubAggregations(Map<String, Aggregation> subAggregations) {}

  default Aggregation getAggregation() {
    return null;
  }

  default String getAggregationName() {
    return null;
  }
}
