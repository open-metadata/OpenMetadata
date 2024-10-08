package org.openmetadata.service.search.elasticsearch.aggregations;

import java.util.List;
import org.openmetadata.service.search.SearchAggregationNode;

public class ElasticAggregationsBuilder {
  public static List<ElasticAggregations> buildAggregation(
      SearchAggregationNode node,
      ElasticAggregations aggregation,
      List<ElasticAggregations> aggregations) {
    String type = node.getType();
    if (type == "root") {
      for (SearchAggregationNode child : node.getChildren()) {
        buildAggregation(child, null, aggregations);
      }
      return aggregations;
    }
    ElasticAggregations elasticAggregations = getAggregation(type);
    elasticAggregations.createAggregation(node);
    if (aggregation != null) {
      if (elasticAggregations.isPipelineAggregation()) {
        aggregation.setSubAggregation(elasticAggregations.getElasticPipelineAggregationBuilder());
      } else {
        aggregation.setSubAggregation(elasticAggregations.getElasticAggregationBuilder());
      }
    }
    if (aggregation == null) aggregations.add(elasticAggregations);
    for (SearchAggregationNode child : node.getChildren()) {
      buildAggregation(child, elasticAggregations, aggregations);
    }
    return aggregations;
  }

  public static ElasticAggregations getAggregation(String aggregationType) {
    return switch (aggregationType) {
      case "bucket_selector" -> new ElasticBucketSelectorAggregations();
      case "date_histogram" -> new ElasticDateHistogramAggregations();
      case "terms" -> new ElasticTermsAggregations();
      case "avg" -> new ElasticAvgAggregations();
      case "min" -> new ElasticMinAggregations();
      case "cardinality" -> new ElasticCardinalityAggregations();
      case "nested" -> new ElasticNestedAggregations();
      case "top_hits" -> new ElasticTopHitsAggregations();
      default -> throw new IllegalArgumentException("Invalid aggregation type: " + aggregationType);
    };
  }
}
