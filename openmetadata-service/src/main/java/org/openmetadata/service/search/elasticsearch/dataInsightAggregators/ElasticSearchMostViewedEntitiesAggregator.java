package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregate;
import es.co.elastic.clients.elasticsearch._types.aggregations.StringTermsBucket;
import java.util.List;
import java.util.Map;
import org.openmetadata.service.dataInsight.MostViewedEntitiesAggregator;

public class ElasticSearchMostViewedEntitiesAggregator
    extends MostViewedEntitiesAggregator<
        Map<String, Aggregate>, StringTermsBucket, Aggregate, Aggregate> {
  public ElasticSearchMostViewedEntitiesAggregator(Map<String, Aggregate> aggregations) {
    super(aggregations);
  }

  @Override
  protected Double getValue(Aggregate key) {
    return key != null && key.isSum() ? key.sum().value() : null;
  }

  @Override
  protected Aggregate getBucketAggregation(StringTermsBucket bucket, String key) {
    return bucket.aggregations().get(key);
  }

  @Override
  protected Aggregate getAggregations(StringTermsBucket bucket, String key) {
    return bucket.aggregations().get(key);
  }

  @Override
  protected String getKeyAsString(StringTermsBucket bucket) {
    return bucket.key().stringValue();
  }

  @Override
  protected List<StringTermsBucket> getBuckets(Aggregate bucket) {
    return bucket.sterms().buckets().array();
  }

  @Override
  protected Aggregate getEntityFqnBuckets(Map<String, Aggregate> aggregations) {
    return aggregations.get("entityFqn");
  }
}
