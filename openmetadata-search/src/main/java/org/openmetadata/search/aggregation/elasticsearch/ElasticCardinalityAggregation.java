package org.openmetadata.search.aggregation.elasticsearch;

import org.openmetadata.search.SearchAggregationNode;

// Stub implementations for remaining aggregation types
class ElasticCardinalityAggregation extends ElasticBaseAggregation {
  public ElasticCardinalityAggregation() {
    super("cardinality");
  }

  @Override
  public void createAggregation(SearchAggregationNode node) {
    this.name = node.getName();
    buildSpecificAggregation(node);
  }

  @Override
  protected void buildSpecificAggregation(SearchAggregationNode node) {
    /* stub */
  }
}
