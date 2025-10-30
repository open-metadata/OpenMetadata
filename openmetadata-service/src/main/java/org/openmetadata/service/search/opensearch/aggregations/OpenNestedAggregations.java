package org.openmetadata.service.search.opensearch.aggregations;

import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;
import os.org.opensearch.search.aggregations.AggregationBuilder;
import os.org.opensearch.search.aggregations.AggregationBuilders;
import os.org.opensearch.search.aggregations.bucket.nested.NestedAggregationBuilder;

@Setter
@Getter
public class OpenNestedAggregations implements OpenAggregations {
  public static final String aggregationType = "nested";
  AggregationBuilder elasticAggregationBuilder;

  @Override
  public void createAggregation(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();
    NestedAggregationBuilder aggregationBuilders =
        AggregationBuilders.nested(params.get("path"), params.get("path"));
    setElasticAggregationBuilder(aggregationBuilders);
  }

  @Override
  public void setSubAggregation(AggregationBuilder aggregation) {
    if (elasticAggregationBuilder != null) {
      elasticAggregationBuilder.subAggregation(aggregation);
    }
  }
}
