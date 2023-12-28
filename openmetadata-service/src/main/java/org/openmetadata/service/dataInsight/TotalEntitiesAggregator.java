package org.openmetadata.service.dataInsight;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.openmetadata.schema.dataInsight.type.TotalEntitiesByType;

public abstract class TotalEntitiesAggregator<A, B, M, S>
    implements DataInsightAggregatorInterface {
  private final A aggregations;

  protected TotalEntitiesAggregator(A aggregations) {
    this.aggregations = aggregations;
  }

  @Override
  public List<Object> aggregate() throws ParseException {
    M timestampBuckets = getTimestampBuckets(this.aggregations);
    List<Object> data = new ArrayList<>();
    List<Double> entityCount = new ArrayList<>();

    for (B timestampBucket : getBuckets(timestampBuckets)) {
      String dateTimeString = getKeyAsString(timestampBucket);
      Long timestamp = convertDatTimeStringToTimestamp(dateTimeString);
      M entityTypeBuckets = getEntityBuckets(timestampBucket);
      for (B entityTypeBucket : getBuckets(entityTypeBuckets)) {
        String entityType = getKeyAsString(entityTypeBucket);
        S sumEntityCount = getSumAggregations(entityTypeBucket, ENTITY_COUNT);

        data.add(
            new TotalEntitiesByType()
                .withTimestamp(timestamp)
                .withEntityType(entityType)
                .withEntityCount(getValue(sumEntityCount)));
        entityCount.add(getValue(sumEntityCount));
      }
    }

    double totalEntities = entityCount.stream().mapToDouble(v -> v).sum();
    for (Object o : data) {
      TotalEntitiesByType totalEntitiesByType = (TotalEntitiesByType) o;
      totalEntitiesByType.withEntityCountFraction(
          totalEntitiesByType.getEntityCount() / totalEntities);
    }

    return data;
  }

  protected abstract Optional<Double> getValue(S key);

  protected abstract S getSumAggregations(B bucket, String key);

  protected abstract M getEntityBuckets(B bucket);

  protected abstract String getKeyAsString(B bucket);

  protected abstract List<? extends B> getBuckets(M buckets);

  protected abstract M getTimestampBuckets(A aggregations);
}
