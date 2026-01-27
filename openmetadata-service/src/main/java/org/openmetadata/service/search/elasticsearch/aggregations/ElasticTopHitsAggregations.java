package org.openmetadata.service.search.elasticsearch.aggregations;

import es.co.elastic.clients.elasticsearch._types.SortOrder;
import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.aggregations.TopHitsAggregation;
import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;

@Setter
@Getter
public class ElasticTopHitsAggregations implements ElasticAggregations {
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
