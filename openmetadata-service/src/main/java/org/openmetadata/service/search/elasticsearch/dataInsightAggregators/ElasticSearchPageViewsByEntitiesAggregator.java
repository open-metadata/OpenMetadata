package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregate;
import es.co.elastic.clients.elasticsearch._types.aggregations.DateHistogramBucket;
import es.co.elastic.clients.elasticsearch._types.aggregations.StringTermsBucket;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.service.dataInsight.PageViewsByEntitiesAggregator;

public class ElasticSearchPageViewsByEntitiesAggregator
    extends PageViewsByEntitiesAggregator<Map<String, Aggregate>, Object, Aggregate, Aggregate> {

  public ElasticSearchPageViewsByEntitiesAggregator(Map<String, Aggregate> aggregations) {
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
      Aggregate aggregate = ((DateHistogramBucket) bucket).aggregations().get("entityType");
      return (aggregate != null && aggregate.isSterms()) ? aggregate : null;
    }
    return null;
  }

  @Override
  protected String getKeyAsString(Object bucket) {
    if (bucket instanceof StringTermsBucket) {
      return ((StringTermsBucket) bucket).key().stringValue();
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
