package org.openmetadata.service.search.elasticsearch.aggregations;

public class ElasticAggregationsFactory {
    public static ElasticAggregations getAggregation(String aggregationType) {
        return switch (aggregationType) {
            case "bucket_selector" -> new ElasticBucketSelectorAggregations();
            case "date_histogram" -> new ElasticDateHistogramAggregations();
            case "terms" -> new ElasticTermsAggregations();
            case "avg" -> new ElasticAvgAggregations();
            case "cardinality" -> new ElasticCardinalityAggregations();
            case "nested" -> new ElasticNestedAggregations();
            case "top_hits" -> new ElasticTopHitsAggregations();
            default -> null;
        };
    }
}
