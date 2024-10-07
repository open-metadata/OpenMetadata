package org.openmetadata.service.search.opensearch.aggregations;

import java.util.List;
import org.openmetadata.service.search.SearchAggregationNode;

public class OpenAggregationsBuilder {
  public static List<OpenAggregations> buildAggregation(
      SearchAggregationNode node,
      OpenAggregations aggregation,
      List<OpenAggregations> aggregations) {
    String type = node.getType();
    if (type == "root") {
      for (SearchAggregationNode child : node.getChildren()) {
        buildAggregation(child, null, aggregations);
      }
      return aggregations;
    }
    OpenAggregations OpenAggregations = getAggregation(type);
    OpenAggregations.createAggregation(node);
    if (aggregation != null) {
      if (OpenAggregations.isPipelineAggregation()) {
        aggregation.setSubAggregation(OpenAggregations.getElasticPipelineAggregationBuilder());
      } else {
        aggregation.setSubAggregation(OpenAggregations.getElasticAggregationBuilder());
      }
    }
    if (aggregation == null) aggregations.add(OpenAggregations);
    for (SearchAggregationNode child : node.getChildren()) {
      buildAggregation(child, OpenAggregations, aggregations);
    }
    return aggregations;
  }

  public static OpenAggregations getAggregation(String aggregationType) {
    return switch (aggregationType) {
      case "bucket_selector" -> new OpenBucketSelectorAggregations();
      case "date_histogram" -> new OpenDateHistogramAggregations();
      case "terms" -> new OpenTermsAggregations();
      case "avg" -> new OpenAvgAggregations();
      case "min" -> new OpenMinAggregations();
      case "cardinality" -> new OpenCardinalityAggregations();
      case "nested" -> new OpenNestedAggregations();
      case "top_hits" -> new OpenTopHitsAggregations();
      default -> throw new IllegalArgumentException("Invalid aggregation type: " + aggregationType);
    };
  }
}
