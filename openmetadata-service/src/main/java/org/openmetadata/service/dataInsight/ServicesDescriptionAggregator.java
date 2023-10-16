package org.openmetadata.service.dataInsight;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.dataInsight.type.PercentageOfServicesWithDescription;

public abstract class ServicesDescriptionAggregator<A, B, M, S> implements DataInsightAggregatorInterface {
  private final A aggregations;

  public ServicesDescriptionAggregator(A aggregations) {
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
        S sumCompletedDescriptions = getSumAggregations(serviceBucket, COMPLETED_DESCRIPTION_FRACTION);
        S sumEntityCount = getSumAggregations(serviceBucket, ENTITY_COUNT);

        data.add(
            new PercentageOfServicesWithDescription()
                .withTimestamp(timestamp)
                .withServiceName(serviceName)
                .withEntityCount(getValue(sumEntityCount))
                .withCompletedDescription(getValue(sumCompletedDescriptions))
                .withCompletedDescriptionFraction(getValue(sumCompletedDescriptions) / getValue(sumEntityCount)));
      }
    }
    return data;
  }

  protected abstract Double getValue(S key);

  protected abstract S getSumAggregations(B bucket, String key);

  protected abstract M getServiceBuckets(B bucket);

  protected abstract String getKeyAsString(B bucket);

  protected abstract List<? extends B> getBuckets(M buckets);

  protected abstract M getTimestampBuckets(A aggregations);
}
