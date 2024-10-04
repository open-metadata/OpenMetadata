package org.openmetadata.service.search.elasticsearch.aggregations;

import es.org.elasticsearch.search.aggregations.AggregationBuilder;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.aggregations.PipelineAggregationBuilder;
import es.org.elasticsearch.search.aggregations.bucket.terms.IncludeExclude;
import es.org.elasticsearch.search.aggregations.bucket.terms.TermsAggregationBuilder;
import lombok.Getter;
import lombok.Setter;

import javax.json.JsonObject;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

@Setter
@Getter
public class ElasticTermsAggregations implements ElasticAggregations {
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
