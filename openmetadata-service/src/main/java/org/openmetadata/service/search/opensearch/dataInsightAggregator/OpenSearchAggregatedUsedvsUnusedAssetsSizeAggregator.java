package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import java.util.List;
import org.openmetadata.service.dataInsight.AggregatedUsedvsUnusedAssetsSizeAggregator;
import os.org.opensearch.search.aggregations.Aggregations;
import os.org.opensearch.search.aggregations.bucket.histogram.Histogram;
import os.org.opensearch.search.aggregations.bucket.histogram.Histogram.Bucket;
import os.org.opensearch.search.aggregations.metrics.Sum;

public class OpenSearchAggregatedUsedvsUnusedAssetsSizeAggregator
    extends AggregatedUsedvsUnusedAssetsSizeAggregator<Aggregations, Histogram, Bucket, Sum> {
  public OpenSearchAggregatedUsedvsUnusedAssetsSizeAggregator(Aggregations aggregations) {
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
