package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregate;
import es.co.elastic.clients.elasticsearch._types.aggregations.StringTermsBucket;
import java.util.List;
import java.util.Map;
import org.openmetadata.service.dataInsight.MostActiveUsersAggregator;

public class ElasticSearchMostActiveUsersAggregator
    extends MostActiveUsersAggregator<
        Map<String, Aggregate>, StringTermsBucket, Aggregate, Aggregate, Aggregate> {

  public ElasticSearchMostActiveUsersAggregator(Map<String, Aggregate> aggregations) {
    super(aggregations);
  }

  @Override
  protected Double getSumValue(Aggregate key) {
    return key != null && key.isSum() ? key.sum().value() : null;
  }

  @Override
  protected Long getMaxValue(Aggregate key) {
    if (key != null && key.isMax()) {
      Double maxValue = key.max().value();
      return maxValue != null ? maxValue.longValue() : null;
    }
    return null;
  }

  @Override
  protected String getKeyAsString(StringTermsBucket bucket) {
    return bucket.key().stringValue();
  }

  @Override
  protected Aggregate getSumAggregations(StringTermsBucket bucket, String key) {
    return bucket.aggregations().get(key);
  }

  @Override
  protected Aggregate getMaxAggregations(StringTermsBucket bucket, String key) {
    return bucket.aggregations().get(key);
  }

  @Override
  protected List<StringTermsBucket> getBuckets(Aggregate buckets) {
    return buckets.sterms().buckets().array();
  }

  @Override
  protected Aggregate getUserNameBuckets(Map<String, Aggregate> aggregations) {
    return aggregations.get("userName");
  }

  @Override
  protected Aggregate getTeamBuckets(StringTermsBucket bucket) {
    return bucket.aggregations().get("team");
  }
}
