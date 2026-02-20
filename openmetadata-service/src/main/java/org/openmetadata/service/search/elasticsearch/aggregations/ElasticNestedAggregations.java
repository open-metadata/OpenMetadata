package org.openmetadata.service.search.elasticsearch.aggregations;

import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.aggregations.NestedAggregation;
import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;

@Setter
@Getter
public class ElasticNestedAggregations implements ElasticAggregations {
  public static final String aggregationType = "nested";
  private String aggregationName;
  private Aggregation aggregation;
  private Map<String, Aggregation> subAggregations = new HashMap<>();
  private String path;

  @Override
  public void createAggregation(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();
    this.aggregationName = node.getName();
    this.path = params.get("path");
    this.aggregation =
        Aggregation.of(a -> a.nested(NestedAggregation.of(nested -> nested.path(path))));
  }

  @Override
  public void setSubAggregations(Map<String, Aggregation> subAggregations) {
    this.subAggregations = subAggregations;
    this.aggregation =
        Aggregation.of(
            a ->
                a.nested(NestedAggregation.of(nested -> nested.path(path)))
                    .aggregations(subAggregations));
  }

  @Override
  public Boolean supportsSubAggregationsNatively() {
    return true;
  }
}
