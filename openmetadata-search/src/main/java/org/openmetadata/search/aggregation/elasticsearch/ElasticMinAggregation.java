package org.openmetadata.search.aggregation.elasticsearch;

import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.aggregations.MinAggregation;
import java.util.Map;
import org.openmetadata.search.SearchAggregationNode;

public class ElasticMinAggregation extends ElasticBaseAggregation {

  public ElasticMinAggregation() {
    super("min");
  }

  @Override
  public void createAggregation(SearchAggregationNode node) {
    this.name = node.getName();
    buildSpecificAggregation(node);
  }

  @Override
  protected void buildSpecificAggregation(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();
    String field = params.get("field");

    MinAggregation.Builder minBuilder = new MinAggregation.Builder().field(field);
    this.aggregationBuilder = new Aggregation.Builder().min(minBuilder);
  }
}
