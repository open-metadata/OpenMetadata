package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.org.elasticsearch.search.aggregations.Aggregations;
import es.org.elasticsearch.search.aggregations.bucket.histogram.Histogram;
import es.org.elasticsearch.search.aggregations.bucket.histogram.Histogram.Bucket;
import es.org.elasticsearch.search.aggregations.metrics.Sum;
import java.util.List;
import org.openmetadata.service.dataInsight.AggregatedUsedvsUnusedAssetsSizeAggregator;

public class ElasticSearchAggregatedUsedvsUnusedAssetsSizeAggregator
  extends AggregatedUsedvsUnusedAssetsSizeAggregator<Aggregations, Histogram, Bucket, Sum> {

  public ElasticSearchAggregatedUsedvsUnusedAssetsSizeAggregator(Aggregations aggregations) {
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
    return aggregations != null ? aggregations.getValue() : 0.0;
  }
}
