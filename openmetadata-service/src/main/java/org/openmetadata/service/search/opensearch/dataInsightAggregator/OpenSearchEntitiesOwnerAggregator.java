package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import java.util.List;
import java.util.Optional;

import org.openmetadata.service.dataInsight.EntitiesOwnerAggregator;
import os.org.opensearch.search.aggregations.Aggregations;
import os.org.opensearch.search.aggregations.bucket.MultiBucketsAggregation;
import os.org.opensearch.search.aggregations.metrics.Sum;

public class OpenSearchEntitiesOwnerAggregator
    extends EntitiesOwnerAggregator<
        Aggregations, MultiBucketsAggregation.Bucket, MultiBucketsAggregation, Sum> {

  public OpenSearchEntitiesOwnerAggregator(Aggregations aggregations) {
    super(aggregations);
  }

  @Override
  protected Optional<Double> getValue(Sum key) {
    return key != null ? key.getValue() : null;
  }

  @Override
  protected Sum getAggregations(MultiBucketsAggregation.Bucket bucket, String key) {
    return bucket.getAggregations().get(key);
  }

  @Override
  protected MultiBucketsAggregation getEntityBuckets(
      MultiBucketsAggregation.Bucket timestampBucket) {
    return timestampBucket.getAggregations().get(ENTITY_TYPE);
  }

  @Override
  protected String getKeyAsString(MultiBucketsAggregation.Bucket bucket) {
    return bucket.getKeyAsString();
  }

  @Override
  protected List<? extends MultiBucketsAggregation.Bucket> getBuckets(
      MultiBucketsAggregation multiBucketsAggregation) {
    return multiBucketsAggregation.getBuckets();
  }

  protected MultiBucketsAggregation getTimestampBuckets(Aggregations aggregations) {
    return aggregations.get(TIMESTAMP);
  }
}
