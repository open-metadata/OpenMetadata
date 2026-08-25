package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.service.dataInsight.PageViewsByEntitiesAggregator;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregate;
import os.org.opensearch.client.opensearch._types.aggregations.DateHistogramBucket;
import os.org.opensearch.client.opensearch._types.aggregations.StringTermsBucket;

public class OpenSearchPageViewsByEntitiesAggregator
    extends PageViewsByEntitiesAggregator<Map<String, Aggregate>, Object, Aggregate, Aggregate> {

  public OpenSearchPageViewsByEntitiesAggregator(Map<String, Aggregate> aggregations) {
    super(aggregations);
  }

  @Override
  protected Double getValue(Aggregate key) {
    return key != null && key.isSum() ? key.sum().value() : null;
  }

  @Override
  protected Aggregate getSumAggregations(Object bucket, String key) {
    if (bucket instanceof DateHistogramBucket) {
      return ((DateHistogramBucket) bucket).aggregations().get(key);
    } else if (bucket instanceof StringTermsBucket) {
      return ((StringTermsBucket) bucket).aggregations().get(key);
    }
    return null;
  }

  @Override
  protected Aggregate getEntityBuckets(Object bucket) {
    if (bucket instanceof DateHistogramBucket) {
      Aggregate entityTypeAgg = ((DateHistogramBucket) bucket).aggregations().get("entityType");
      if (entityTypeAgg != null && entityTypeAgg.isSterms()) {
        return entityTypeAgg;
      }
    }
    return null;
  }

  @Override
  protected String getKeyAsString(Object bucket) {
    if (bucket instanceof StringTermsBucket) {
      return ((StringTermsBucket) bucket).key();
    }
    return null;
  }

  @Override
  protected long getKeyAsEpochTimestamp(Object bucket) {
    if (bucket instanceof DateHistogramBucket) {
      return ((DateHistogramBucket) bucket).key();
    }
    return 0;
  }

  @Override
  protected List<Object> getBuckets(Aggregate aggregate) {
    List<Object> buckets = new ArrayList<>();
    if (aggregate.isDateHistogram()) {
      buckets.addAll(aggregate.dateHistogram().buckets().array());
    } else if (aggregate.isSterms()) {
      buckets.addAll(aggregate.sterms().buckets().array());
    }
    return buckets;
  }

  @Override
  protected Aggregate getTimestampBuckets(Map<String, Aggregate> aggregations) {
    return aggregations.get(TIMESTAMP);
  }
}
