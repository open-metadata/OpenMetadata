package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.org.elasticsearch.search.aggregations.Aggregations;
import es.org.elasticsearch.search.aggregations.bucket.MultiBucketsAggregation;
import es.org.elasticsearch.search.aggregations.metrics.Sum;
import java.util.List;
import org.openmetadata.service.dataInsight.PageViewsByEntitiesAggregator;

public class ElasticSearchPageViewsByEntitiesAggregator
    extends PageViewsByEntitiesAggregator<Aggregations, MultiBucketsAggregation.Bucket, MultiBucketsAggregation, Sum> {

  public ElasticSearchPageViewsByEntitiesAggregator(Aggregations aggregations) {
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
  protected MultiBucketsAggregation getEntityBuckets(MultiBucketsAggregation.Bucket bucket) {
    return bucket.getAggregations().get("entityType");
  }

  @Override
  protected String getKeyAsString(MultiBucketsAggregation.Bucket bucket) {
    return bucket.getKeyAsString();
  }

  @Override
  protected List<? extends MultiBucketsAggregation.Bucket> getBuckets(MultiBucketsAggregation multiBucketsAggregation) {
    return multiBucketsAggregation.getBuckets();
  }

  @Override
  protected MultiBucketsAggregation getTimestampBuckets(Aggregations aggregations) {
    return aggregations.get(TIMESTAMP);
  }
}
