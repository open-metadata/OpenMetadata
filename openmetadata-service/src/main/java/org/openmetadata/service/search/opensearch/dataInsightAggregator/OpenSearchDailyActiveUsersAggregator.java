package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import java.util.List;
import java.util.Map;
import org.openmetadata.service.dataInsight.DailyActiveUsersAggregator;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregate;
import os.org.opensearch.client.opensearch._types.aggregations.DateHistogramBucket;

public class OpenSearchDailyActiveUsersAggregator
    extends DailyActiveUsersAggregator<Map<String, Aggregate>, Aggregate, DateHistogramBucket> {
  public OpenSearchDailyActiveUsersAggregator(Map<String, Aggregate> aggregations) {
    super(aggregations);
  }

  @Override
  protected Aggregate getHistogramBucket(Map<String, Aggregate> aggregations) {
    return aggregations.get(TIMESTAMP);
  }

  @Override
  protected List<DateHistogramBucket> getBuckets(Aggregate histogramBucket) {
    return histogramBucket.dateHistogram().buckets().array();
  }

  @Override
  protected long getKeyAsEpochTimestamp(DateHistogramBucket bucket) {
    return bucket.key();
  }

  @Override
  protected Long getDocCount(DateHistogramBucket bucket) {
    return bucket.docCount();
  }
}
