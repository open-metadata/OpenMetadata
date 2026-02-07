package org.openmetadata.service.search.elasticsearch.aggregations;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import es.co.elastic.clients.elasticsearch._types.Script;
import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.aggregations.BucketSelectorAggregation;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;

@Setter
@Getter
public class ElasticBucketSelectorAggregations implements ElasticAggregations {
  private final String aggregationType = "bucket_selector";
  private String aggregationName;
  private Aggregation aggregation;
  private Map<String, Aggregation> subAggregations = new HashMap<>();

  @Override
  public void createAggregation(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();
    this.aggregationName = node.getName();

    String[] pathValues = Optional.ofNullable(params.get("pathValues")).orElse("").split(",");
    String[] pathKeys = Optional.ofNullable(params.get("pathKeys")).orElse("").split(",");
    String scriptStr = params.get("script");

    if (!validateParams(pathKeys, pathValues, scriptStr)) {
      throw new IllegalArgumentException(
          "Invalid parameters. pathKeys & pathValues should be non-empty arrays of equal length"
              + " and script should be non-empty");
    }

    Map<String, String> bucketsPaths = getBucketsPaths(pathKeys, pathValues);

    this.aggregation =
        Aggregation.of(
            a ->
                a.bucketSelector(
                    BucketSelectorAggregation.of(
                        bs ->
                            bs.bucketsPath(bp -> bp.dict(bucketsPaths))
                                .script(
                                    Script.of(s -> s.source(ss -> ss.scriptString(scriptStr)))))));
  }

  @Override
  public Boolean isPipelineAggregation() {
    return true;
  }

  @Override
  public void setSubAggregations(Map<String, Aggregation> subAggregations) {
    this.subAggregations = subAggregations;
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
