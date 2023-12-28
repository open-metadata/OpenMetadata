package org.openmetadata.service.dataInsight;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.openmetadata.schema.dataInsight.type.PercentageOfServicesWithOwner;

public abstract class ServicesOwnerAggregator<A, B, M, S>
    implements DataInsightAggregatorInterface {
  protected final A aggregations;

  protected ServicesOwnerAggregator(A aggregations) {
    this.aggregations = aggregations;
  }

  @Override
  public List<Object> aggregate() throws ParseException {
    M timestampBuckets = getTimestampBuckets(this.aggregations);
    List<Object> data = new ArrayList<>();
    for (B timestampBucket : getBuckets(timestampBuckets)) {
      String dateTimeString = getKeyAsString(timestampBucket);
      Long timestamp = convertDatTimeStringToTimestamp(dateTimeString);
      M serviceBuckets = getServiceBuckets(timestampBucket);
      for (B serviceBucket : getBuckets(serviceBuckets)) {
        String serviceName = getKeyAsString(serviceBucket);
        S sumHasOwner = getSumAggregations(serviceBucket, HAS_OWNER_FRACTION);
        S sumEntityCount = getSumAggregations(serviceBucket, ENTITY_COUNT);
        Optional<Double> entityCount = getValue(sumEntityCount);
        Optional<Double> hasOwner = getValue(sumHasOwner);
        Double hasOwnerFraction =
            hasOwner.flatMap(hof -> entityCount.map(ec -> hof / ec)).orElse(null);

        data.add(
            new PercentageOfServicesWithOwner()
                .withTimestamp(timestamp)
                .withServiceName(serviceName)
                .withEntityCount(entityCount.orElse(null))
                .withHasOwner(hasOwner.orElse(null))
                .withHasOwnerFraction(hasOwnerFraction));
      }
    }
    return data;
  }

  protected abstract Optional<Double> getValue(S key);

  protected abstract S getSumAggregations(B bucket, String key);

  protected abstract M getServiceBuckets(B bucket);

  protected abstract String getKeyAsString(B bucket);

  protected abstract List<? extends B> getBuckets(M buckets);

  protected abstract M getTimestampBuckets(A aggregations);
}
