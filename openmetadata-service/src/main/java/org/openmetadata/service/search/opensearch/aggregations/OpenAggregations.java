package org.openmetadata.service.search.opensearch.aggregations;

import java.util.Map;
import org.openmetadata.service.search.SearchAggregationNode;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregation;

public interface OpenAggregations {
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
