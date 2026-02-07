package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import java.util.List;
import java.util.Map;
import org.openmetadata.service.dataInsight.AggregatedUsedvsUnusedAssetsSizeAggregator;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregate;
import os.org.opensearch.client.opensearch._types.aggregations.DateHistogramBucket;

public class OpenSearchAggregatedUsedvsUnusedAssetsSizeAggregator
    extends AggregatedUsedvsUnusedAssetsSizeAggregator<
        Map<String, Aggregate>, Aggregate, DateHistogramBucket, Aggregate> {
  public OpenSearchAggregatedUsedvsUnusedAssetsSizeAggregator(Map<String, Aggregate> aggregations) {
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
