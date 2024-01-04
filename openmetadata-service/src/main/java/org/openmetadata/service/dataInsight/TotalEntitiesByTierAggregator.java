package org.openmetadata.service.dataInsight;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.openmetadata.schema.dataInsight.type.TotalEntitiesByTier;

public abstract class TotalEntitiesByTierAggregator<A, B, M, S>
    implements DataInsightAggregatorInterface {
  private final A aggregations;

  protected TotalEntitiesByTierAggregator(A aggregations) {
    this.aggregations = aggregations;
  }

  @Override
  public List<Object> aggregate() throws ParseException {
    M timestampBuckets = getTimestampBuckets(this.aggregations);
    List<Object> data = new ArrayList<>();
    for (B timestampBucket : getBuckets(timestampBuckets)) {
      List<TotalEntitiesByTier> timestampData = new ArrayList<>();
      double totalEntityCount = 0.0;
      String dateTimeString = getKeyAsString(timestampBucket);
      Long timestamp = convertDatTimeStringToTimestamp(dateTimeString);

      M entityTierBuckets = getEntityTierBuckets(timestampBucket);
      for (B entityTierBucket : getBuckets(entityTierBuckets)) {
        String entityTier = getKeyAsString(entityTierBucket);
        S sumEntityCount = getSumAggregations(entityTierBucket, ENTITY_COUNT);
        Optional<Double> entityCount = getValue(sumEntityCount);

        timestampData.add(
            new TotalEntitiesByTier()
                .withTimestamp(timestamp)
                .withEntityTier(entityTier)
                .withEntityCount(entityCount.orElse(null)));
        totalEntityCount = totalEntityCount + entityCount.orElse(0.0);
      }
      for (TotalEntitiesByTier el : timestampData) {
        if (totalEntityCount != 0.0) {
          el.withEntityCountFraction(el.getEntityCount() / totalEntityCount);
        } else {
          el.withEntityCountFraction(Double.NaN);
        }
        data.add((el));
      }
    }
    return data;
  }

  protected abstract Optional<Double> getValue(S key);

  protected abstract S getSumAggregations(B bucket, String key);

  protected abstract M getEntityTierBuckets(B bucket);

  protected abstract String getKeyAsString(B bucket);

  protected abstract List<? extends B> getBuckets(M buckets);

  protected abstract M getTimestampBuckets(A aggregations);
}
