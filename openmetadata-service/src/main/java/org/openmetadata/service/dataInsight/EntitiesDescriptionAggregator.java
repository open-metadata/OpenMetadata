package org.openmetadata.service.dataInsight;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.dataInsight.type.PercentageOfEntitiesWithDescriptionByType;

public abstract class EntitiesDescriptionAggregator<A, B, M, S>
    implements DataInsightAggregatorInterface {
  private final A aggregations;

  public EntitiesDescriptionAggregator(A aggregations) {
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
        S sumCompletedDescriptions =
            getAggregations(entityTypeBucket, COMPLETED_DESCRIPTION_FRACTION);
        S sumEntityCount = getAggregations(entityTypeBucket, ENTITY_COUNT);

        data.add(
            new PercentageOfEntitiesWithDescriptionByType()
                .withTimestamp(timestamp)
                .withEntityType(entityType)
                .withEntityCount(getValue(sumEntityCount))
                .withCompletedDescription(getValue(sumCompletedDescriptions))
                .withCompletedDescriptionFraction(
                    getValue(sumCompletedDescriptions) / getValue(sumEntityCount)));
      }
    }
    return data;
  }

  protected abstract String getKeyAsString(B bucket);

  protected abstract List<? extends B> getBuckets(M bucket);

  protected abstract M getEntityBuckets(B timestampBucket);

  protected abstract M getTimestampBuckets(A aggregations);

  protected abstract S getAggregations(B bucket, String key);

  protected abstract Double getValue(S aggregations);
}
