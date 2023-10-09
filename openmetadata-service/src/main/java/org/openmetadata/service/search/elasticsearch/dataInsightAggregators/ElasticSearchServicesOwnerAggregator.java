package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.org.elasticsearch.search.aggregations.Aggregations;
import es.org.elasticsearch.search.aggregations.bucket.MultiBucketsAggregation;
import es.org.elasticsearch.search.aggregations.metrics.Sum;
import java.util.List;
import org.openmetadata.service.dataInsight.ServicesOwnerAggregator;

public class ElasticSearchServicesOwnerAggregator
    extends ServicesOwnerAggregator<Aggregations, MultiBucketsAggregation.Bucket, MultiBucketsAggregation, Sum> {
  public ElasticSearchServicesOwnerAggregator(Aggregations aggregations) {
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
