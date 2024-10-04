package org.openmetadata.service.search.elasticsearch.aggregations;

import es.org.elasticsearch.search.aggregations.AggregationBuilder;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.aggregations.bucket.nested.NestedAggregationBuilder;
import lombok.Getter;
import lombok.Setter;

import javax.json.JsonObject;

@Setter
@Getter
public class ElasticNestedAggregations implements ElasticAggregations {
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
