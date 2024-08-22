package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import java.time.ZonedDateTime;
import java.util.List;
import os.org.opensearch.search.aggregations.Aggregations;
import os.org.opensearch.search.aggregations.bucket.histogram.Histogram;

public class OpenSearchDailyActiveUsersAggregator
    extends org.openmetadata.service.dataInsight.DailyActiveUsersAggregator<
        Aggregations, Histogram, Histogram.Bucket> {
  public OpenSearchDailyActiveUsersAggregator(Aggregations aggregations) {
    super(aggregations);
  }

  @Override
  protected Histogram getHistogramBucket(Aggregations aggregations) {
    return aggregations.get(TIMESTAMP);
  }

  @Override
  protected List<? extends Histogram.Bucket> getBuckets(Histogram histogramBucket) {
    return histogramBucket.getBuckets();
  }

  @Override
  protected long getKeyAsEpochTimestamp(Histogram.Bucket bucket) {

    return ((ZonedDateTime) bucket.getKey()).toInstant().toEpochMilli();
  }

  @Override
  protected Long getDocCount(Histogram.Bucket bucket) {
    return bucket.getDocCount();
  }
}
