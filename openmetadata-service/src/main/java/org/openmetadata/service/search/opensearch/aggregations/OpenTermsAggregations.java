package org.openmetadata.service.search.opensearch.aggregations;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import os.org.opensearch.search.aggregations.AggregationBuilder;
import os.org.opensearch.search.aggregations.AggregationBuilders;
import os.org.opensearch.search.aggregations.PipelineAggregationBuilder;
import os.org.opensearch.search.aggregations.bucket.terms.IncludeExclude;
import os.org.opensearch.search.aggregations.bucket.terms.TermsAggregationBuilder;
import javax.json.JsonObject;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class OpenTermsAggregations implements OpenAggregations {
    static final String aggregationType = "terms";
    AggregationBuilder elasticAggregationBuilder;

    @Override
    public void createAggregation(JsonObject jsonAggregation, String key) {
        String[] includes = null;
        JsonObject termAggregation = jsonAggregation.getJsonObject(aggregationType);
        String includesStr = termAggregation.getString("include", null);
        if (!nullOrEmpty(includesStr)) includes = includesStr.split(",");
        int size = termAggregation.getInt("size", -1);
        TermsAggregationBuilder termsAggregationBuilder =
                AggregationBuilders
                        .terms(key)
                        .field(termAggregation.getString("field"));

        if (size > 0) termsAggregationBuilder.size(size);
        if (!nullOrEmpty(includes)) {
            IncludeExclude includeExclude = new IncludeExclude(includes, null);
            termsAggregationBuilder.includeExclude(includeExclude);
        }
        setElasticAggregationBuilder(termsAggregationBuilder);
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
