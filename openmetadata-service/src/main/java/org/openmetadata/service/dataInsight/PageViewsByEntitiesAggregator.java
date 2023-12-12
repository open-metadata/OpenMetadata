package org.openmetadata.service.dataInsight;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.dataInsight.type.PageViewsByEntities;

public abstract class PageViewsByEntitiesAggregator<A, B, M, S> implements DataInsightAggregatorInterface {

  private final A aggregations;

  public PageViewsByEntitiesAggregator(A aggregations) {
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
        S sumPageViews = getSumAggregations(entityTypeBucket, "pageViews");

        data.add(
          new PageViewsByEntities()
            .withEntityType(entityType)
            .withTimestamp(timestamp)
            .withPageViews(getValue(sumPageViews))
        );
      }
    }
    return data;
  }

  protected abstract Double getValue(S key);

  protected abstract S getSumAggregations(B bucket, String key);

  protected abstract M getEntityBuckets(B bucket);

  protected abstract String getKeyAsString(B bucket);

  protected abstract List<? extends B> getBuckets(M multiBucketsAggregation);

  protected abstract M getTimestampBuckets(A aggregations);
}
