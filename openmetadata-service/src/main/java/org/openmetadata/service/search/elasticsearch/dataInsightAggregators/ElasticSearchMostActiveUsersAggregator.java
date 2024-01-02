package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.org.elasticsearch.search.aggregations.Aggregations;
import es.org.elasticsearch.search.aggregations.bucket.MultiBucketsAggregation;
import es.org.elasticsearch.search.aggregations.metrics.Max;
import es.org.elasticsearch.search.aggregations.metrics.Sum;
import java.util.List;
import java.util.Optional;
import org.openmetadata.service.dataInsight.MostActiveUsersAggregator;

public class ElasticSearchMostActiveUsersAggregator
    extends MostActiveUsersAggregator<
        Aggregations, MultiBucketsAggregation.Bucket, MultiBucketsAggregation, Sum, Max> {

  public ElasticSearchMostActiveUsersAggregator(Aggregations aggregations) {
    super(aggregations);
  }

  @Override
  protected Optional<Double> getSumValue(Sum key) {
    return Optional.ofNullable(key != null ? key.getValue() : null);
  }

  @Override
  protected Optional<Long> getMaxValue(Max key) {
    return Optional.ofNullable(key != null ? (long) key.getValue() : null);
  }

  @Override
  protected String getKeyAsString(MultiBucketsAggregation.Bucket bucket) {
    return bucket.getKeyAsString();
  }

  @Override
  protected Sum getSumAggregations(MultiBucketsAggregation.Bucket bucket, String key) {
    return bucket.getAggregations().get(key);
  }

  @Override
  protected Max getMaxAggregations(MultiBucketsAggregation.Bucket bucket, String key) {
    return bucket.getAggregations().get(key);
  }

  @Override
  protected List<? extends MultiBucketsAggregation.Bucket> getBuckets(
      MultiBucketsAggregation buckets) {
    return buckets.getBuckets();
  }

  @Override
  protected MultiBucketsAggregation getUserNameBuckets(Aggregations aggregations) {
    return aggregations.get("userName");
  }

  @Override
  protected MultiBucketsAggregation getTeamBuckets(MultiBucketsAggregation.Bucket bucket) {
    return bucket.getAggregations().get("team");
  }
}
