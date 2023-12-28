package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.org.elasticsearch.search.aggregations.Aggregations;
import es.org.elasticsearch.search.aggregations.bucket.MultiBucketsAggregation;
import es.org.elasticsearch.search.aggregations.metrics.Sum;
import java.util.List;
import java.util.Optional;
import org.openmetadata.service.dataInsight.MostViewedEntitiesAggregator;

public class ElasticSearchMostViewedEntitiesAggregator
    extends MostViewedEntitiesAggregator<
        Aggregations, MultiBucketsAggregation.Bucket, MultiBucketsAggregation, Sum> {
  public ElasticSearchMostViewedEntitiesAggregator(Aggregations aggregations) {
    super(aggregations);
  }

  @Override
  protected Optional<Double> getValue(Sum key) {
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
