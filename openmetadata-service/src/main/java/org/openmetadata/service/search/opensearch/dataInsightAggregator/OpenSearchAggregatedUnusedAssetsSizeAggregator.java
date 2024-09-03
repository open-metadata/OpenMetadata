package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import java.time.ZonedDateTime;
import java.util.List;
import org.openmetadata.service.dataInsight.AggregatedUnusedAssetsSizeAggregator;
import os.org.opensearch.search.aggregations.Aggregations;
import os.org.opensearch.search.aggregations.bucket.histogram.Histogram;
import os.org.opensearch.search.aggregations.bucket.histogram.Histogram.Bucket;
import os.org.opensearch.search.aggregations.metrics.Sum;

public class OpenSearchAggregatedUnusedAssetsSizeAggregator
    extends AggregatedUnusedAssetsSizeAggregator<Aggregations, Histogram, Bucket, Sum> {
  public OpenSearchAggregatedUnusedAssetsSizeAggregator(Aggregations aggregations) {
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
  protected long getKeyAsEpochTimestamp(Bucket bucket) {
    return ((ZonedDateTime) bucket.getKey()).toInstant().toEpochMilli();
  }

  @Override
  protected Sum getAggregations(Bucket bucket, String key) {
    return bucket.getAggregations().get(key);
  }

  @Override
  protected Double getValue(Sum aggregations) {
    return aggregations != null ? aggregations.getValue() : null;
  }
}
