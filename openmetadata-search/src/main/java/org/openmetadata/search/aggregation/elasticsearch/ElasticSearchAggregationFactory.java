package org.openmetadata.search.aggregation.elasticsearch;

import org.openmetadata.search.aggregation.OMSearchAggregation;
import org.openmetadata.search.aggregation.OMSearchAggregationFactory;

public class ElasticSearchAggregationFactory implements OMSearchAggregationFactory {

  @Override
  public OMSearchAggregation createAggregation(String type) {
    return switch (type) {
      case "bucket_selector" -> new ElasticBucketSelectorAggregation();
      case "date_histogram" -> new ElasticDateHistogramAggregation();
      case "terms" -> new ElasticTermsAggregation();
      case "avg" -> new ElasticAvgAggregation();
      case "min" -> new ElasticMinAggregation();
      case "cardinality" -> new ElasticCardinalityAggregation();
      case "nested" -> new ElasticNestedAggregation();
      case "top_hits" -> new ElasticTopHitsAggregation();
      case "sum" -> new ElasticSumAggregation();
      case "max" -> new ElasticMaxAggregation();
      case "histogram" -> new ElasticHistogramAggregation();
      case "range" -> new ElasticRangeAggregation();
      case "filter" -> new ElasticFilterAggregation();
      default -> throw new IllegalArgumentException("Unsupported aggregation type: " + type);
    };
  }
}
