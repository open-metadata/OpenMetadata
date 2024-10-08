package org.openmetadata.service.search.elasticsearch.aggregations;

import es.org.elasticsearch.search.aggregations.AggregationBuilder;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.aggregations.PipelineAggregationBuilder;
import es.org.elasticsearch.search.sort.SortOrder;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;

@Setter
@Getter
public class ElasticTopHitsAggregations implements ElasticAggregations {
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
