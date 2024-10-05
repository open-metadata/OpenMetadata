package org.openmetadata.service.search.opensearch.aggregations;

import os.org.opensearch.search.aggregations.AggregationBuilder;
import os.org.opensearch.search.aggregations.AggregationBuilders;
import os.org.opensearch.search.aggregations.PipelineAggregationBuilder;
import os.org.opensearch.search.sort.SortOrder;
import javax.json.JsonObject;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class OpenTopHitsAggregations implements OpenAggregations {
    static final String aggregationType = "top_hits";
    AggregationBuilder elasticAggregationBuilder;

    @Override
    public void createAggregation(JsonObject jsonAggregation, String key) {
        JsonObject topHitsAggregation = jsonAggregation.getJsonObject(aggregationType);
        AggregationBuilder aggregationBuilder = AggregationBuilders.topHits(key)
                        .size(topHitsAggregation.getInt("size"))
                        .sort(
                                topHitsAggregation.getString("sort_field"),
                                SortOrder.fromString(topHitsAggregation.getString("sort_order")));
        setElasticAggregationBuilder(aggregationBuilder);
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
