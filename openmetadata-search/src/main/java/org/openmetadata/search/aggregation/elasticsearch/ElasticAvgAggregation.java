package org.openmetadata.search.aggregation.elasticsearch;

import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.aggregations.AverageAggregation;
import java.util.Map;
import org.openmetadata.search.SearchAggregationNode;

public class ElasticAvgAggregation extends ElasticBaseAggregation {

  public ElasticAvgAggregation() {
    super("avg");
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

    AverageAggregation.Builder avgBuilder = new AverageAggregation.Builder().field(field);
    this.aggregationBuilder = new Aggregation.Builder().avg(avgBuilder);
  }
}
