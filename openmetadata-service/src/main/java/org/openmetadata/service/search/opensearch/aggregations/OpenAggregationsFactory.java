package org.openmetadata.service.search.opensearch.aggregations;

public class OpenAggregationsFactory {
    public static OpenAggregations getAggregation(String aggregationType) {
        return switch (aggregationType) {
            case "bucket_selector" -> new OpenBucketSelectorAggregations();
            case "date_histogram" -> new OpenDateHistogramAggregations();
            case "terms" -> new OpenTermsAggregations();
            case "avg" -> new OpenAvgAggregations();
            case "cardinality" -> new OpenCardinalityAggregations();
            case "nested" -> new OpenNestedAggregations();
            case "top_hits" -> new OpenTopHitsAggregations();
            default -> null;
        };
    }
}
