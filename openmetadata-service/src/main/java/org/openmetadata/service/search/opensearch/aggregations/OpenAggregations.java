package org.openmetadata.service.search.opensearch.aggregations;

import org.openmetadata.service.search.SearchAggregationNode;
import os.org.opensearch.search.aggregations.AggregationBuilder;
import os.org.opensearch.search.aggregations.PipelineAggregationBuilder;

public interface OpenAggregations {
  void createAggregation(SearchAggregationNode node);

  default Boolean isPipelineAggregation() {
    return false;
  }

  default void setAggregation(AggregationBuilder aggregation) {}

  default void setSubAggregation(AggregationBuilder subAggregation) {}

  default void setAggregation(PipelineAggregationBuilder aggregation) {}

  default void setSubAggregation(PipelineAggregationBuilder subAggregation) {}

  default AggregationBuilder getElasticAggregationBuilder() {
    return null;
  }

  default PipelineAggregationBuilder getElasticPipelineAggregationBuilder() {
    return null;
  }
}
