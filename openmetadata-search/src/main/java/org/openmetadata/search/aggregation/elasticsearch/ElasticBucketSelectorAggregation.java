package org.openmetadata.search.aggregation.elasticsearch;

import org.openmetadata.search.SearchAggregationNode;

public class ElasticBucketSelectorAggregation extends ElasticBaseAggregation {

  public ElasticBucketSelectorAggregation() {
    super("bucket_selector");
  }

  @Override
  public boolean isPipelineAggregation() {
    return true;
  }

  @Override
  public void createAggregation(SearchAggregationNode node) {
    this.name = node.getName();
    buildSpecificAggregation(node);
  }

  @Override
  protected void buildSpecificAggregation(SearchAggregationNode node) {
    // Bucket selector is a pipeline aggregation - implementation would be more complex
    // For now, stub implementation
  }
}
