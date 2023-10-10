package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import java.util.List;
import os.org.opensearch.search.aggregations.Aggregations;
import os.org.opensearch.search.aggregations.bucket.histogram.Histogram;

public class OpenSearchDailyActiveUsersAggregator
    extends org.openmetadata.service.dataInsight.DailyActiveUsersAggregator<Aggregations, Histogram, Histogram.Bucket> {
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
  protected String getKeyAsString(Histogram.Bucket bucket) {
    return bucket.getKeyAsString();
  }

  @Override
  protected Long getDocCount(Histogram.Bucket bucket) {
    return bucket.getDocCount();
  }
}
