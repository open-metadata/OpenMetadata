package org.openmetadata.service.dataInsight;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.dataInsight.type.AggregatedUnusedAssets;

public abstract class AggregatedUnusedAssetsAggregator<A, H, B, S> implements DataInsightAggregatorInterface {
  private final A aggregations;

  public AggregatedUnusedAssetsAggregator(A aggregations) {
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

      data.add(
          new AggregatedUnusedAssets()
              .withTimestamp(timestamp)
              .withThreeDays(getValue(threeDays))
              .withSevenDays(getValue(sevenDays))
              .withFourteenDays(getValue(fourteenDays))
              .withThirtyDays(getValue(thirtyDays))
              .withSixtyDays(getValue(sixtyDays)));
    }
    return data;
  }

  protected abstract H getHistogramBucket(A aggregations);

  protected abstract List<? extends B> getBuckets(H histogramBucket);

  protected abstract String getKeyAsString(B bucket);

  protected abstract S getAggregations(B bucket, String key);

  protected abstract Double getValue(S aggregations);
}
