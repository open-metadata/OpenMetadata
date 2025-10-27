package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import java.util.List;
import java.util.Map;
import org.openmetadata.service.dataInsight.MostViewedEntitiesAggregator;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregate;
import os.org.opensearch.client.opensearch._types.aggregations.StringTermsBucket;

public class OpenSearchMostViewedEntitiesAggregator
    extends MostViewedEntitiesAggregator<
        Map<String, Aggregate>, StringTermsBucket, Aggregate, Aggregate> {
  public OpenSearchMostViewedEntitiesAggregator(Map<String, Aggregate> aggregations) {
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
    return bucket.key();
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
