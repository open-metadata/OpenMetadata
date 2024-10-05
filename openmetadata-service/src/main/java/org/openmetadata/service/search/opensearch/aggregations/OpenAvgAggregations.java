package org.openmetadata.service.search.opensearch.aggregations;

import javax.json.JsonObject;
import lombok.Getter;
import lombok.Setter;
import os.org.opensearch.search.aggregations.AggregationBuilder;
import os.org.opensearch.search.aggregations.AggregationBuilders;
import os.org.opensearch.search.aggregations.PipelineAggregationBuilder;

@Setter
@Getter
public class OpenAvgAggregations implements OpenAggregations {
  static final String aggregationType = "avg";
  AggregationBuilder elasticAggregationBuilder;

  @Override
  public void createAggregation(JsonObject jsonAggregation, String key) {
    JsonObject avgAggregation = jsonAggregation.getJsonObject(aggregationType);
    AggregationBuilder aggregationBuilders =
        AggregationBuilders.avg(key).field(avgAggregation.getString("field"));
    setElasticAggregationBuilder(aggregationBuilders);
  }

  @Override
  public void setSubAggregation(PipelineAggregationBuilder aggregation) {
    if (elasticAggregationBuilder != null) {
      elasticAggregationBuilder.subAggregation(aggregation);
    }
  }

  @Override
  public void setSubAggregation(AggregationBuilder aggregation) {
    if (elasticAggregationBuilder != null) {
      elasticAggregationBuilder.subAggregation(aggregation);
    }
  }
}
