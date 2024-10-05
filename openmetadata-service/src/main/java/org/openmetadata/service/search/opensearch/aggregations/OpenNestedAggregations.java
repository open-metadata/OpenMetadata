package org.openmetadata.service.search.opensearch.aggregations;

import os.org.opensearch.search.aggregations.AggregationBuilder;
import os.org.opensearch.search.aggregations.AggregationBuilders;
import os.org.opensearch.search.aggregations.bucket.nested.NestedAggregationBuilder;
import javax.json.JsonObject;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class OpenNestedAggregations implements OpenAggregations {
    public static final String aggregationType = "nested";
    AggregationBuilder elasticAggregationBuilder;

    @Override
    public void createAggregation(JsonObject jsonAggregation, String key) {
        JsonObject nestedAggregation = jsonAggregation.getJsonObject(aggregationType);
        NestedAggregationBuilder aggregationBuilders = AggregationBuilders.nested(
                        nestedAggregation.getString("path"), nestedAggregation.getString("path"));
        setElasticAggregationBuilder(aggregationBuilders);
    }

    @Override
    public void setSubAggregation(AggregationBuilder aggregation) {
        if (elasticAggregationBuilder != null) {
            elasticAggregationBuilder.subAggregation(aggregation);
        }
    }
}
