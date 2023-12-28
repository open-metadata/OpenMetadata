package org.openmetadata.service.dataInsight;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
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
        Optional<Double> entityCount = getValue(sumEntityCount);
        Optional<Double> hasOwner = getValue(sumHasOwner);
        Double hasOwnerFraction = hasOwner.flatMap(ho -> entityCount.map(ec -> ho / ec)).orElse(null);

        data.add(
            new PercentageOfEntitiesWithOwnerByType()
                .withTimestamp(timestamp)
                .withEntityType(entityType)
                .withEntityCount(entityCount.orElse(null))
                .withHasOwner(hasOwner.orElse(null))
                .withHasOwnerFraction(hasOwnerFraction));
      }
    }
    return data;
  }

  protected abstract Optional<Double> getValue(S sumEntityCount);

  protected abstract S getAggregations(B entityTypeBucket, String key);

  protected abstract M getEntityBuckets(B timestampBucket);

  protected abstract String getKeyAsString(B timestampBucket);

  protected abstract List<? extends B> getBuckets(M timestampBuckets);

  protected abstract M getTimestampBuckets(A aggregations);
}
