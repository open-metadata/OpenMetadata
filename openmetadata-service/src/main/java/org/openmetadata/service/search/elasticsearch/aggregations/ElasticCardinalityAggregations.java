package org.openmetadata.service.search.elasticsearch.aggregations;

import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.aggregations.CardinalityAggregation;
import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;

@Setter
@Getter
public class ElasticCardinalityAggregations implements ElasticAggregations {
  static final String aggregationType = "cardinality";
  private String aggregationName;
  private Aggregation aggregation;
  private Map<String, Aggregation> subAggregations = new HashMap<>();

  @Override
  public void createAggregation(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();
    this.aggregationName = node.getName();
    String precisionThreshold = params.get("precision_threshold");
    this.aggregation =
        Aggregation.of(
            a ->
                a.cardinality(
                    CardinalityAggregation.of(
                        card -> {
                          card.field(params.get("field"));
                          if (precisionThreshold != null) {
                            card.precisionThreshold(Integer.parseInt(precisionThreshold));
                          }
                          return card;
                        })));
  }

  @Override
  public void setSubAggregations(Map<String, Aggregation> subAggregations) {
    this.subAggregations = subAggregations;
  }
}
