package org.openmetadata.service.dataInsight;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.dataInsight.type.PercentageOfEntitiesWithOwnerByType;

public abstract class EntitiesOwnerAggregator<A, B, M, S>
    implements DataInsightAggregatorInterface {
  private final A aggregations;

  protected EntitiesOwnerAggregator(A aggregations) {
    this.aggregations = aggregations;
  }

  @Override
  public List<Object> aggregate() throws ParseException {
    M timestampBuckets = getTimestampBuckets(this.aggregations);
    List<Object> data = new ArrayList<>();
    for (B timestampBucket : getBuckets(timestampBuckets)) {
      String dateTimeString = getKeyAsString(timestampBucket);
      Long timestamp = convertDatTimeStringToTimestamp(dateTimeString);
      M entityTypeBuckets = getEntityBuckets(timestampBucket);
      for (B entityTypeBucket : getBuckets(entityTypeBuckets)) {
        String entityType = getKeyAsString(entityTypeBucket);
        S sumHasOwner = getAggregations(entityTypeBucket, HAS_OWNER_FRACTION);
        S sumEntityCount = getAggregations(entityTypeBucket, ENTITY_COUNT);

        data.add(
            new PercentageOfEntitiesWithOwnerByType()
                .withTimestamp(timestamp)
                .withEntityType(entityType)
                .withEntityCount(getValue(sumEntityCount))
                .withHasOwner(getValue(sumHasOwner))
                .withHasOwnerFraction(getValue(sumHasOwner) / getValue(sumEntityCount)));
      }
    }
    return data;
  }

  protected abstract Double getValue(S sumEntityCount);

  protected abstract S getAggregations(B entityTypeBucket, String key);

  protected abstract M getEntityBuckets(B timestampBucket);

  protected abstract String getKeyAsString(B timestampBucket);

  protected abstract List<? extends B> getBuckets(M timestampBuckets);

  protected abstract M getTimestampBuckets(A aggregations);
}
