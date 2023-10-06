package org.openmetadata.service.dataInsight;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.openmetadata.schema.dataInsight.type.AggregatedUnusedAssetsCount;

public abstract class AggregatedUnusedAssetsCountAggregator<A, H, B, S> implements DataInsightAggregatorInterface {
  private final A aggregations;

  public AggregatedUnusedAssetsCountAggregator(A aggregations) {
    this.aggregations = aggregations;
  }

  @Override
  public List<Object> aggregate() throws ParseException {
    H histogramBucket = getHistogramBucket(this.aggregations);
    List<Object> data = new ArrayList<>();
    for (B bucket : getBuckets(histogramBucket)) {
      String dateTimeString = getKeyAsString(bucket);
      Long timestamp = convertDatTimeStringToTimestamp(dateTimeString);
      S threeDays = getAggregations(bucket, "threeDays");
      S sevenDays = getAggregations(bucket, "sevenDays");
      S fourteenDays = getAggregations(bucket, "fourteenDays");
      S thirtyDays = getAggregations(bucket, "thirtyDays");
      S sixtyDays = getAggregations(bucket, "sixtyDays");
      S totalUnused = getAggregations(bucket, "totalUnused");
      S totalUsed = getAggregations(bucket, "totalUsed");
      Double used = Objects.requireNonNullElse(getValue(totalUsed), 0.0);
      Double unused = Objects.requireNonNullElse(getValue(totalUnused), 0.0);
      Double total = used + unused;

      data.add(
          new AggregatedUnusedAssetsCount()
              .withTimestamp(timestamp)
              .withThreeDays(getValue(threeDays))
              .withSevenDays(getValue(sevenDays))
              .withFourteenDays(getValue(fourteenDays))
              .withThirtyDays(getValue(thirtyDays))
              .withSixtyDays(getValue(sixtyDays))
              .withTotal(total));
    }
    return data;
  }

  protected abstract H getHistogramBucket(A aggregations);

  protected abstract List<? extends B> getBuckets(H histogramBucket);

  protected abstract String getKeyAsString(B bucket);

  protected abstract S getAggregations(B bucket, String key);

  protected abstract Double getValue(S aggregations);
}
