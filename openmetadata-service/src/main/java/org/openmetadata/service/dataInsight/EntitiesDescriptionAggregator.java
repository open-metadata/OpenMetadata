package org.openmetadata.service.dataInsight;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.openmetadata.schema.dataInsight.type.PercentageOfEntitiesWithDescriptionByType;

public abstract class EntitiesDescriptionAggregator<A, B, M, S>
    implements DataInsightAggregatorInterface {
  private final A aggregations;

  protected EntitiesDescriptionAggregator(A aggregations) {
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
        Optional<Double> entityCount = getValue(sumEntityCount);
        Optional<Double> completedDescription = getValue(sumCompletedDescriptions);
        Double completedDescriptionFraction =
            completedDescription.flatMap(cd -> entityCount.map(ec -> cd / ec)).orElse(null);

        data.add(
            new PercentageOfEntitiesWithDescriptionByType()
                .withTimestamp(timestamp)
                .withEntityType(entityType)
                .withEntityCount(entityCount.orElse(null))
                .withCompletedDescription(completedDescription.orElse(null))
                .withCompletedDescriptionFraction(completedDescriptionFraction));
      }
    }
    return data;
  }

  protected abstract String getKeyAsString(B bucket);

  protected abstract List<? extends B> getBuckets(M bucket);

  protected abstract M getEntityBuckets(B timestampBucket);

  protected abstract M getTimestampBuckets(A aggregations);

  protected abstract S getAggregations(B bucket, String key);

  protected abstract Optional<Double> getValue(S aggregations);
}
