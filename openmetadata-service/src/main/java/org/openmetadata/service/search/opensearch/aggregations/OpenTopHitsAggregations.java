package org.openmetadata.service.search.opensearch.aggregations;

import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;
import os.org.opensearch.client.opensearch._types.SortOrder;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregation;
import os.org.opensearch.client.opensearch._types.aggregations.TopHitsAggregation;

@Setter
@Getter
public class OpenTopHitsAggregations implements OpenAggregations {
  static final String aggregationType = "top_hits";
  private String aggregationName;
  private Aggregation aggregation;
  private Map<String, Aggregation> subAggregations = new HashMap<>();

  @Override
  public void createAggregation(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();
    this.aggregationName = node.getName();

    int size = Integer.parseInt(params.get("size"));
    String sortField = params.get("sort_field");
    String sortOrderParam = params.get("sort_order");
    SortOrder sortOrder = sortOrderParam.equalsIgnoreCase("desc") ? SortOrder.Desc : SortOrder.Asc;

    this.aggregation =
        Aggregation.of(
            a ->
                a.topHits(
                    TopHitsAggregation.of(
                        th ->
                            th.size(size)
                                .sort(s -> s.field(f -> f.field(sortField).order(sortOrder))))));
  }

  @Override
  public void setSubAggregations(Map<String, Aggregation> subAggregations) {
    this.subAggregations = subAggregations;
  }
}
