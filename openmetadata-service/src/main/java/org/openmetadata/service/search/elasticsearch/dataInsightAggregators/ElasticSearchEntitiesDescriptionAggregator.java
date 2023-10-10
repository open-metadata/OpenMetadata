package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.org.elasticsearch.search.aggregations.Aggregations;
import es.org.elasticsearch.search.aggregations.bucket.MultiBucketsAggregation;
import es.org.elasticsearch.search.aggregations.metrics.Sum;
import java.util.List;
import org.openmetadata.service.dataInsight.EntitiesDescriptionAggregator;

public class ElasticSearchEntitiesDescriptionAggregator
    extends EntitiesDescriptionAggregator<Aggregations, MultiBucketsAggregation.Bucket, MultiBucketsAggregation, Sum> {

  public ElasticSearchEntitiesDescriptionAggregator(Aggregations aggregations) {
    super(aggregations);
  }

  @Override
  protected String getKeyAsString(MultiBucketsAggregation.Bucket bucket) {
    return bucket.getKeyAsString();
  }

  @Override
  protected List<? extends MultiBucketsAggregation.Bucket> getBuckets(MultiBucketsAggregation bucket) {
    return bucket.getBuckets();
  }

  @Override
  protected MultiBucketsAggregation getEntityBuckets(MultiBucketsAggregation.Bucket timestampBucket) {
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
  protected Double getValue(Sum aggregations) {
    return aggregations.getValue();
  }
}
