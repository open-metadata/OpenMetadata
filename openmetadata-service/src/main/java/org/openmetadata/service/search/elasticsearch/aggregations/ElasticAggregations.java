package org.openmetadata.service.search.elasticsearch.aggregations;

import es.org.elasticsearch.search.aggregations.AggregationBuilder;
import es.org.elasticsearch.search.aggregations.PipelineAggregationBuilder;
import javax.json.JsonObject;

public interface ElasticAggregations {
  void createAggregation(JsonObject jsonAggregation, String key);

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
