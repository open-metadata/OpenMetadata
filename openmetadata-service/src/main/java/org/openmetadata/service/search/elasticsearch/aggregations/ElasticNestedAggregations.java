package org.openmetadata.service.search.elasticsearch.aggregations;

import es.org.elasticsearch.search.aggregations.AggregationBuilder;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.aggregations.bucket.nested.NestedAggregationBuilder;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;

@Setter
@Getter
public class ElasticNestedAggregations implements ElasticAggregations {
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
