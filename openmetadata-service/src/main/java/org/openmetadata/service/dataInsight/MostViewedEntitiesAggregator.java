package org.openmetadata.service.dataInsight;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.dataInsight.type.MostViewedEntities;

public abstract class MostViewedEntitiesAggregator<A, B, M, S> implements DataInsightAggregatorInterface {

  protected final A aggregations;

  protected MostViewedEntitiesAggregator(A aggregations) {
    this.aggregations = aggregations;
  }

  @Override
  public List<Object> aggregate() {
    M entityFqnBuckets = getEntityFqnBuckets(this.aggregations);
    List<Object> data = new ArrayList<>();
    for (B entityFqnBucket : getBuckets(entityFqnBuckets)) {
      String tableFqn = getKeyAsString(entityFqnBucket);
      S sumPageViews = getAggregations(entityFqnBucket, "pageViews");
      M ownerBucket = getBucketAggregation(entityFqnBucket, "owner");
      M entityTypeBucket = getBucketAggregation(entityFqnBucket, "entityType");
      M entityHrefBucket = getBucketAggregation(entityFqnBucket, "entityHref");
      String owner = getFirstValueFromBucketOrNull(ownerBucket);
      String entityType = getFirstValueFromBucketOrNull(entityTypeBucket);
      String entityHref = getFirstValueFromBucketOrNull(entityHrefBucket);

      data.add(
        new MostViewedEntities()
          .withEntityFqn(tableFqn)
          .withOwner(owner)
          .withEntityType(entityType)
          .withEntityHref(entityHref)
          .withPageViews(getValue(sumPageViews))
      );
    }

    return data;
  }

  protected abstract Double getValue(S sumPageViews);

  protected abstract M getBucketAggregation(B bucket, String key);

  protected abstract S getAggregations(B bucket, String key);

  protected abstract String getKeyAsString(B bucket);

  protected abstract List<? extends B> getBuckets(M bucket);

  protected abstract M getEntityFqnBuckets(A aggregations);

  protected String getFirstValueFromBucketOrNull(M bucket) {
    // for list values we'll pick the first value
    if (!getBuckets(bucket).isEmpty()) {
      return getKeyAsString(getBuckets(bucket).get(0));
    }
    return null;
  }
}
