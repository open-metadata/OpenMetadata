package org.openmetadata.service.search.opensearch.aggregations;

import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregation;
import os.org.opensearch.client.opensearch._types.aggregations.AverageAggregation;

@Setter
@Getter
public class OpenAvgAggregations implements OpenAggregations {
  static final String aggregationType = "avg";
  private String aggregationName;
  private Aggregation aggregation;
  private Map<String, Aggregation> subAggregations = new HashMap<>();

  @Override
  public void createAggregation(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();
    this.aggregationName = node.getName();
    this.aggregation =
        Aggregation.of(a -> a.avg(AverageAggregation.of(avg -> avg.field(params.get("field")))));
  }

  @Override
  public void setSubAggregations(Map<String, Aggregation> subAggregations) {
    this.subAggregations = subAggregations;
  }
}
