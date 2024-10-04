package org.openmetadata.service.search.elasticsearch.aggregations;

import es.org.elasticsearch.script.Script;
import es.org.elasticsearch.search.aggregations.AggregationBuilder;
import es.org.elasticsearch.search.aggregations.PipelineAggregationBuilder;
import es.org.elasticsearch.search.aggregations.PipelineAggregatorBuilders;
import es.org.elasticsearch.search.aggregations.pipeline.BucketSelectorPipelineAggregationBuilder;
import lombok.Getter;
import lombok.Setter;

import javax.json.JsonObject;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

@Setter
@Getter
public class ElasticBucketSelectorAggregations implements ElasticAggregations {
    private final String aggregationType = "bucket_selector";
    PipelineAggregationBuilder elasticPipelineAggregationBuilder;

    @Override
    public void createAggregation(JsonObject jsonAggregation, String key) {
        JsonObject bucketSelectorAggregation = jsonAggregation.getJsonObject(aggregationType);
        String[] pathValues = bucketSelectorAggregation.getString("pathValues", "").split(",");
        String[] pathKeys = bucketSelectorAggregation.getString("pathKeys", "").split(",");
        String scriptStr = bucketSelectorAggregation.getString("script", null);

        if (!validateParams(pathKeys, pathValues, scriptStr)) {
            throw new IllegalArgumentException(
                    "Invalid parameters. pathKeys & pathValues should be non-empty arrays of equal length" +
                            " and script should be non-empty"
            );
        }

        Map<String, String> bucketsPaths = getBucketsPaths(pathKeys, pathValues);
        Script script = new Script(bucketSelectorAggregation.getString("script"));
        BucketSelectorPipelineAggregationBuilder bucketSelectorPipelineAggregationBuilder =
                PipelineAggregatorBuilders.bucketSelector(
                        key,
                        bucketsPaths,
                        script);
        setElasticPipelineAggregationBuilder(bucketSelectorPipelineAggregationBuilder);
    }

    @Override
    public Boolean isPipelineAggregation() {
        return true;
    }

    private Map<String, String> getBucketsPaths(String[] pathKeys, String[] pathValues) {
        return IntStream.range(0, pathKeys.length)
                .mapToObj(i -> Map.entry(pathKeys[i], pathValues[i]))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    private Boolean validateParams(String[] pathKeys, String[] pathValues, String scriptStr) {
        if ((pathKeys.length != pathValues.length) || (pathKeys.length == 0)) return false;
        return !nullOrEmpty(scriptStr);
    }
}
