package org.openmetadata.service.search.opensearch.aggregations;

import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;
import os.org.opensearch.search.aggregations.AggregationBuilder;
import os.org.opensearch.search.aggregations.AggregationBuilders;
import os.org.opensearch.search.aggregations.PipelineAggregationBuilder;
import os.org.opensearch.search.sort.SortOrder;

@Setter
@Getter
public class OpenTopHitsAggregations implements OpenAggregations {
  static final String aggregationType = "top_hits";
  AggregationBuilder elasticAggregationBuilder;

  @Override
  public void createAggregation(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();
    AggregationBuilder aggregationBuilder =
        AggregationBuilders.topHits(node.getName())
            .size(Integer.parseInt(params.get("size")))
            .sort(params.get("sort_field"), SortOrder.fromString(params.get("sort_order")));
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
