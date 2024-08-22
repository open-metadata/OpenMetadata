package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import java.util.List;
import org.openmetadata.service.dataInsight.MostViewedEntitiesAggregator;
import os.org.opensearch.search.aggregations.Aggregations;
import os.org.opensearch.search.aggregations.bucket.MultiBucketsAggregation;
import os.org.opensearch.search.aggregations.metrics.Sum;

public class OpenSearchMostViewedEntitiesAggregator
    extends MostViewedEntitiesAggregator<
        Aggregations, MultiBucketsAggregation.Bucket, MultiBucketsAggregation, Sum> {
  public OpenSearchMostViewedEntitiesAggregator(Aggregations aggregations) {
    super(aggregations);
  }

  @Override
  protected Double getValue(Sum key) {
    return key != null ? key.getValue() : null;
  }

  @Override
  protected MultiBucketsAggregation getBucketAggregation(
      MultiBucketsAggregation.Bucket bucket, String key) {
    return bucket.getAggregations().get(key);
  }

  @Override
  protected Sum getAggregations(MultiBucketsAggregation.Bucket bucket, String key) {
    return bucket.getAggregations().get(key);
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
  protected MultiBucketsAggregation getEntityFqnBuckets(Aggregations aggregations) {
    return aggregations.get("entityFqn");
  }
}
