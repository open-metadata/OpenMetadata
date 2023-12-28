package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import java.util.List;
import java.util.Optional;

import org.openmetadata.service.dataInsight.EntitiesDescriptionAggregator;
import os.org.opensearch.search.aggregations.Aggregations;
import os.org.opensearch.search.aggregations.bucket.MultiBucketsAggregation;
import os.org.opensearch.search.aggregations.metrics.Sum;

public class OpenSearchEntitiesDescriptionAggregator
    extends EntitiesDescriptionAggregator<
        Aggregations, MultiBucketsAggregation.Bucket, MultiBucketsAggregation, Sum> {

  public OpenSearchEntitiesDescriptionAggregator(Aggregations aggregations) {
    super(aggregations);
  }

  @Override
  protected String getKeyAsString(MultiBucketsAggregation.Bucket bucket) {
    return bucket.getKeyAsString();
  }

  @Override
  protected List<? extends MultiBucketsAggregation.Bucket> getBuckets(
      MultiBucketsAggregation bucket) {
    return bucket.getBuckets();
  }

  @Override
  protected MultiBucketsAggregation getEntityBuckets(
      MultiBucketsAggregation.Bucket timestampBucket) {
    return timestampBucket.getAggregations().get(ENTITY_TYPE);
  }

  @Override
  protected MultiBucketsAggregation getTimestampBuckets(Aggregations aggregations) {
    return aggregations.get(TIMESTAMP);
  }

  @Override
  protected Sum getAggregations(MultiBucketsAggregation.Bucket bucket, String key) {
    return bucket.getAggregations().get(key);
  }

  @Override
  protected Optional<Double> getValue(Sum aggregations) {
    return aggregations != null ? aggregations.getValue() : null;
  }
}
