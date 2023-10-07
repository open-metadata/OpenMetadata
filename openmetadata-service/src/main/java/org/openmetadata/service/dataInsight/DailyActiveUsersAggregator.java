package org.openmetadata.service.dataInsight;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.dataInsight.type.DailyActiveUsers;

public abstract class DailyActiveUsersAggregator<A, H, B> implements DataInsightAggregatorInterface {
  private final A aggregations;

  public DailyActiveUsersAggregator(A aggregations) {
    this.aggregations = aggregations;
  }

  @Override
  public List<Object> aggregate() throws ParseException {
    H histogramBucket = getHistogramBucket(this.aggregations);
    List<Object> data = new ArrayList<>();
    for (B bucket : getBuckets(histogramBucket)) {
      String dateTimeString = getKeyAsString(bucket);
      Long timestamp = convertDatTimeStringToTimestamp(dateTimeString);
      long activeUsers = getDocCount(bucket);

      data.add(new DailyActiveUsers().withTimestamp(timestamp).withActiveUsers((int) activeUsers));
    }
    return data;
  }

  protected abstract H getHistogramBucket(A aggregations);

  protected abstract List<? extends B> getBuckets(H histogramBucket);

  protected abstract String getKeyAsString(B bucket);

  protected abstract Long getDocCount(B bucket);
}
