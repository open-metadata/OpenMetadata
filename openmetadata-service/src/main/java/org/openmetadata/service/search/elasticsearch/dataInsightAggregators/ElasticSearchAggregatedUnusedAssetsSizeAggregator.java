package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregate;
import es.co.elastic.clients.elasticsearch._types.aggregations.DateHistogramBucket;
import java.util.List;
import java.util.Map;
import org.openmetadata.service.dataInsight.AggregatedUnusedAssetsSizeAggregator;

public class ElasticSearchAggregatedUnusedAssetsSizeAggregator
    extends AggregatedUnusedAssetsSizeAggregator<
        Map<String, Aggregate>, Aggregate, DateHistogramBucket, Aggregate> {
  public ElasticSearchAggregatedUnusedAssetsSizeAggregator(Map<String, Aggregate> aggregations) {
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
  protected Aggregate getAggregations(DateHistogramBucket bucket, String key) {
    return bucket.aggregations().get(key);
  }

  @Override
  protected Double getValue(Aggregate aggregations) {
    return aggregations != null && aggregations.isSum() ? aggregations.sum().value() : null;
  }
}
