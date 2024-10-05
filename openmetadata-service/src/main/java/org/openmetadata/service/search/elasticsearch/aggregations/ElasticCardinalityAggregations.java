package org.openmetadata.service.search.elasticsearch.aggregations;

import es.org.elasticsearch.search.aggregations.AggregationBuilder;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.aggregations.PipelineAggregationBuilder;
import javax.json.JsonObject;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class ElasticCardinalityAggregations implements ElasticAggregations {
  static final String aggregationType = "cardinality";
  AggregationBuilder elasticAggregationBuilder;

  @Override
  public void createAggregation(JsonObject jsonAggregation, String key) {
    JsonObject cardinalityAggregation = jsonAggregation.getJsonObject(aggregationType);
    AggregationBuilder aggregationBuilder =
        AggregationBuilders.cardinality(key).field(cardinalityAggregation.getString("field"));
    setElasticAggregationBuilder(aggregationBuilder);
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
