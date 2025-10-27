package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregate;
import es.co.elastic.clients.elasticsearch._types.aggregations.DateHistogramBucket;
import java.util.List;
import java.util.Map;
import org.openmetadata.service.dataInsight.DailyActiveUsersAggregator;

public class ElasticSearchDailyActiveUsersAggregator
    extends DailyActiveUsersAggregator<Map<String, Aggregate>, Aggregate, DateHistogramBucket> {
  public ElasticSearchDailyActiveUsersAggregator(Map<String, Aggregate> aggregations) {
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
