package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import java.util.List;
import org.elasticsearch.search.aggregations.Aggregations;
import org.elasticsearch.search.aggregations.bucket.histogram.Histogram;
import org.elasticsearch.search.aggregations.bucket.histogram.Histogram.Bucket;
import org.elasticsearch.search.aggregations.metrics.Sum;
import org.openmetadata.service.dataInsight.AggregatedUnusedAssetsCountAggregator;

public class ElasticSearchAggregatedUnusedAssetsCountAggregator
    extends AggregatedUnusedAssetsCountAggregator<Aggregations, Histogram, Bucket, Sum> {
  public ElasticSearchAggregatedUnusedAssetsCountAggregator(Aggregations aggregations) {
    super(aggregations);
  }

  @Override
  protected Histogram getHistogramBucket(Aggregations aggregations) {
    return aggregations.get(TIMESTAMP);
  }

  @Override
  protected List<? extends Bucket> getBuckets(Histogram histogramBucket) {
    return histogramBucket.getBuckets();
  }

  @Override
  protected String getKeyAsString(Bucket bucket) {
    return bucket.getKeyAsString();
  }

  @Override
  protected Sum getAggregations(Bucket bucket, String key) {
    return bucket.getAggregations().get(key);
  }

  @Override
  protected Double getValue(Sum aggregations) {
    return aggregations.getValue();
  }
}
