package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import java.util.List;
import org.openmetadata.service.dataInsight.TotalEntitiesByTierAggregator;
import org.opensearch.search.aggregations.Aggregations;
import org.opensearch.search.aggregations.bucket.MultiBucketsAggregation;
import org.opensearch.search.aggregations.metrics.Sum;

public class OpenSearchTotalEntitiesByTierAggregator
    extends TotalEntitiesByTierAggregator<Aggregations, MultiBucketsAggregation.Bucket, MultiBucketsAggregation, Sum> {
  public OpenSearchTotalEntitiesByTierAggregator(Aggregations aggregations) {
    super(aggregations);
  }

  @Override
  protected Double getValue(Sum key) {
    return key.getValue();
  }

  @Override
  protected Sum getSumAggregations(MultiBucketsAggregation.Bucket bucket, String key) {
    return bucket.getAggregations().get(key);
  }

  @Override
  protected MultiBucketsAggregation getEntityTierBuckets(MultiBucketsAggregation.Bucket bucket) {
    return bucket.getAggregations().get(ENTITY_TIER);
  }

  @Override
  protected String getKeyAsString(MultiBucketsAggregation.Bucket bucket) {
    return bucket.getKeyAsString();
  }

  @Override
  protected List<? extends MultiBucketsAggregation.Bucket> getBuckets(MultiBucketsAggregation buckets) {
    return buckets.getBuckets();
  }

  @Override
  protected MultiBucketsAggregation getTimestampBuckets(Aggregations aggregations) {
    return aggregations.get(TIMESTAMP);
  }
}
