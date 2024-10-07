package org.openmetadata.service.search.opensearch.aggregations;


import org.openmetadata.service.search.opensearch.aggregations.OpenAggregations;
import os.org.opensearch.search.aggregations.AggregationBuilders;
import os.org.opensearch.search.aggregations.PipelineAggregationBuilder;
import javax.json.JsonObject;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;
import os.org.opensearch.search.aggregations.AggregationBuilder;

import java.util.Map;

@Setter
@Getter
public class OpenMinAggregations implements OpenAggregations {
    static final String aggregationType = "min";
    AggregationBuilder OpenAggregationBuilder;

    @Override
    public void createAggregation(SearchAggregationNode node) {
        Map<String, String> params = node.getValue();
        AggregationBuilder aggregationBuilders =
                AggregationBuilders.min(node.getName()).field(params.get("field"));
        setOpenAggregationBuilder(aggregationBuilders);
    }

    @Override
    public void setSubAggregation(PipelineAggregationBuilder aggregation) {
        if (OpenAggregationBuilder != null) {
            OpenAggregationBuilder.subAggregation(aggregation);
        }
    }

    @Override
    public void setSubAggregation(AggregationBuilder aggregation) {
        if (OpenAggregationBuilder != null) {
            OpenAggregationBuilder.subAggregation(aggregation);
        }
    }
}
