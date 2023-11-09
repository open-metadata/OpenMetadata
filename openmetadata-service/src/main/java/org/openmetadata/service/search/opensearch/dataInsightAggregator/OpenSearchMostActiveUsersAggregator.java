package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import java.util.List;
import org.openmetadata.service.dataInsight.MostActiveUsersAggregator;
import os.org.opensearch.search.aggregations.Aggregations;
import os.org.opensearch.search.aggregations.bucket.MultiBucketsAggregation;
import os.org.opensearch.search.aggregations.metrics.Max;
import os.org.opensearch.search.aggregations.metrics.Sum;

public class OpenSearchMostActiveUsersAggregator
    extends MostActiveUsersAggregator<Aggregations, MultiBucketsAggregation.Bucket, MultiBucketsAggregation, Sum, Max> {

  public OpenSearchMostActiveUsersAggregator(Aggregations aggregations) {
    super(aggregations);
  }

  @Override
  protected Double getSumValue(Sum key) {
    return key != null ? key.getValue() : 0.0;
  }

  @Override
  protected Long getMaxValue(Max key) {
    return key != null ? (long) key.getValue() : 0;
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
  protected List<? extends MultiBucketsAggregation.Bucket> getBuckets(MultiBucketsAggregation buckets) {
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
