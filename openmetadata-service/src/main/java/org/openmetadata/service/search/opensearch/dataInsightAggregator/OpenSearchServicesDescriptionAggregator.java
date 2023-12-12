package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import java.util.List;
import org.openmetadata.service.dataInsight.ServicesDescriptionAggregator;
import os.org.opensearch.search.aggregations.Aggregations;
import os.org.opensearch.search.aggregations.bucket.MultiBucketsAggregation;
import os.org.opensearch.search.aggregations.metrics.Sum;

public class OpenSearchServicesDescriptionAggregator
  extends ServicesDescriptionAggregator<Aggregations, MultiBucketsAggregation.Bucket, MultiBucketsAggregation, Sum> {

  public OpenSearchServicesDescriptionAggregator(Aggregations aggregations) {
    super(aggregations);
  }

  @Override
  protected Double getValue(Sum key) {
    return key != null ? key.getValue() : 0.0;
  }

  @Override
  protected Sum getSumAggregations(MultiBucketsAggregation.Bucket bucket, String key) {
    return bucket.getAggregations().get(key);
  }

  @Override
  protected MultiBucketsAggregation getServiceBuckets(MultiBucketsAggregation.Bucket bucket) {
    return bucket.getAggregations().get(SERVICE_NAME);
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
