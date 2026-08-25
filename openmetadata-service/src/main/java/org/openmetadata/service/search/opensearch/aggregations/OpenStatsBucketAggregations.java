package org.openmetadata.service.search.opensearch.aggregations;

import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregation;
import os.org.opensearch.client.opensearch._types.aggregations.StatsBucketAggregation;

@Setter
@Getter
public class OpenStatsBucketAggregations implements OpenAggregations {
  static final String aggregationType = "stats_bucket";
  private String aggregationName;
  private Aggregation aggregation;
  private Map<String, Aggregation> subAggregations = new HashMap<>();

  @Override
  public void createAggregation(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();
    this.aggregationName = node.getName();
    String bucketsPath = params.get("buckets_path");
    this.aggregation =
        Aggregation.of(
            a ->
                a.statsBucket(
                    StatsBucketAggregation.of(sb -> sb.bucketsPath(b -> b.single(bucketsPath)))));
  }

  @Override
  public Boolean isPipelineAggregation() {
    return true;
  }

  @Override
  public void setSubAggregations(Map<String, Aggregation> subAggregations) {
    this.subAggregations = subAggregations;
  }
}
