package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.org.elasticsearch.search.aggregations.Aggregations;
import es.org.elasticsearch.search.aggregations.bucket.MultiBucketsAggregation;
import es.org.elasticsearch.search.aggregations.metrics.Sum;
import java.util.List;
import org.openmetadata.service.dataInsight.EntitiesOwnerAggregator;

public class ElasticSearchEntitiesOwnerAggregator
  extends EntitiesOwnerAggregator<Aggregations, MultiBucketsAggregation.Bucket, MultiBucketsAggregation, Sum> {

  public ElasticSearchEntitiesOwnerAggregator(Aggregations aggregations) {
    super(aggregations);
  }

  @Override
  protected Double getValue(Sum key) {
    return key != null ? key.getValue() : 0.0;
  }

  @Override
  protected Sum getAggregations(MultiBucketsAggregation.Bucket bucket, String key) {
    return bucket.getAggregations().get(key);
  }

  @Override
  protected MultiBucketsAggregation getEntityBuckets(MultiBucketsAggregation.Bucket timestampBucket) {
    return timestampBucket.getAggregations().get(ENTITY_TYPE);
  }

  @Override
  protected String getKeyAsString(MultiBucketsAggregation.Bucket bucket) {
    return bucket.getKeyAsString();
  }

  @Override
  protected List<? extends MultiBucketsAggregation.Bucket> getBuckets(MultiBucketsAggregation multiBucketsAggregation) {
    return multiBucketsAggregation.getBuckets();
  }

  protected MultiBucketsAggregation getTimestampBuckets(Aggregations aggregations) {
    return aggregations.get(TIMESTAMP);
  }
}
