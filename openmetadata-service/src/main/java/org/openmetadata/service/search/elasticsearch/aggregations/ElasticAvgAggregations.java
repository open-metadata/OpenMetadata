package org.openmetadata.service.search.elasticsearch.aggregations;

import es.org.elasticsearch.search.aggregations.AggregationBuilder;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.aggregations.BaseAggregationBuilder;
import es.org.elasticsearch.search.aggregations.PipelineAggregationBuilder;
import lombok.Getter;
import lombok.Setter;

import javax.json.JsonObject;

@Setter
@Getter
public class ElasticAvgAggregations implements ElasticAggregations {
    static final String aggregationType = "avg";
    AggregationBuilder elasticAggregationBuilder;

    @Override
    public void createAggregation(JsonObject jsonAggregation, String key) {
        JsonObject avgAggregation = jsonAggregation.getJsonObject(aggregationType);
        AggregationBuilder aggregationBuilders = AggregationBuilders.avg(key).field(avgAggregation.getString("field"));
        setElasticAggregationBuilder(aggregationBuilders);
    }

    @Override
    public void setSubAggregation(PipelineAggregationBuilder aggregation) {
        if (elasticAggregationBuilder != null) {
            elasticAggregationBuilder.subAggregation(aggregation);
        }
    }

    @Override
    public void setSubAggregation(AggregationBuilder aggregation) {
        if (elasticAggregationBuilder != null) {
            elasticAggregationBuilder.subAggregation(aggregation);
        }
    }
}
