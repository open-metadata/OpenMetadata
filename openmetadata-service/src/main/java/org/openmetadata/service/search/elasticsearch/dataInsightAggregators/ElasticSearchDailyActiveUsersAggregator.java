package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import java.util.List;
import org.elasticsearch.search.aggregations.Aggregations;
import org.elasticsearch.search.aggregations.bucket.histogram.Histogram;
import org.openmetadata.service.dataInsight.DailyActiveUsersAggregator;

public class ElasticSearchDailyActiveUsersAggregator
    extends DailyActiveUsersAggregator<Aggregations, Histogram, Histogram.Bucket> {
  public ElasticSearchDailyActiveUsersAggregator(Aggregations aggregations) {
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
