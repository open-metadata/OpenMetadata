package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import java.util.List;
import java.util.Optional;
import org.openmetadata.service.dataInsight.AggregatedUnusedAssetsCountAggregator;
import os.org.opensearch.search.aggregations.Aggregations;
import os.org.opensearch.search.aggregations.bucket.histogram.Histogram;
import os.org.opensearch.search.aggregations.bucket.histogram.Histogram.Bucket;
import os.org.opensearch.search.aggregations.metrics.Sum;

public class OpenSearchAggregatedUnusedAssetsCountAggregator
    extends AggregatedUnusedAssetsCountAggregator<Aggregations, Histogram, Bucket, Sum> {
  public OpenSearchAggregatedUnusedAssetsCountAggregator(Aggregations aggregations) {
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
  protected Optional<Double> getValue(Sum aggregations) {
    return Optional.ofNullable(aggregations != null ? aggregations.getValue() : null);
  }
}
