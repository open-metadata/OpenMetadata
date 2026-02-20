package org.openmetadata.service.search.opensearch.aggregations;

import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;
import os.org.opensearch.client.opensearch._types.SortOrder;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregation;
import os.org.opensearch.client.opensearch._types.aggregations.BucketSortAggregation;

@Setter
@Getter
public class OpenBucketSortAggregations implements OpenAggregations {
  private final String aggregationType = "bucket_sort";
  private String aggregationName;
  private Aggregation aggregation;
  private Map<String, Aggregation> subAggregations = new HashMap<>();

  @Override
  public void createAggregation(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();
    this.aggregationName = node.getName();

    String sizeStr = params.get("size");
    String fromStr = params.get("from");
    String sortField = params.get("sort_field");
    String sortOrderStr = params.get("sort_order");

    BucketSortAggregation.Builder builder = new BucketSortAggregation.Builder();

    if (sizeStr != null) {
      builder.size(Integer.parseInt(sizeStr));
    }

    if (fromStr != null) {
      builder.from(Integer.parseInt(fromStr));
    }

    if (sortField != null && sortOrderStr != null) {
      SortOrder sortOrder = sortOrderStr.equalsIgnoreCase("asc") ? SortOrder.Asc : SortOrder.Desc;
      builder.sort(s -> s.field(f -> f.field(sortField).order(sortOrder)));
    }

    this.aggregation = Aggregation.of(a -> a.bucketSort(builder.build()));
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
