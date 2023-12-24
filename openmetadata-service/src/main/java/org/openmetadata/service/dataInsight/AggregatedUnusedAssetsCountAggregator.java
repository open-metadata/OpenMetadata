package org.openmetadata.service.dataInsight;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.analytics.DataAssetValues;
import org.openmetadata.schema.dataInsight.type.AggregatedUnusedAssetsCount;

public abstract class AggregatedUnusedAssetsCountAggregator<A, H, B, S>
    implements DataInsightAggregatorInterface {
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
      S unusedThreeDays = getAggregations(bucket, "unusedDataAssetsThreeDays");
      S unusedSevenDays = getAggregations(bucket, "unusedDataAssetsSevenDays");
      S unusedFourteenDays = getAggregations(bucket, "unusedDataAssetsFourteenDays");
      S unusedThirtyDays = getAggregations(bucket, "unusedDataAssetsThirtyDays");
      S unusedSixtyDays = getAggregations(bucket, "unusedDataAssetsSixtyDays");
      S frequentlyUsedThreeDays = getAggregations(bucket, "frequentlyUsedDataAssetsThreeDays");
      S frequentlyUsedSevenDays = getAggregations(bucket, "frequentlyUsedDataAssetsSevenDays");
      S frequentlyUsedFourteenDays =
          getAggregations(bucket, "frequentlyUsedDataAssetsFourteenDays");
      S frequentlyUsedThirtyDays = getAggregations(bucket, "frequentlyUsedDataAssetsThirtyDays");
      S frequentlyUsedSixtyDays = getAggregations(bucket, "frequentlyUsedDataAssetsSixtyDays");

      data.add(
          new AggregatedUnusedAssetsCount()
              .withTimestamp(timestamp)
              .withUnusedDataAssets(
                  new DataAssetValues()
                      .withThreeDays(getValue(unusedThreeDays))
                      .withSevenDays(getValue(unusedSevenDays))
                      .withFourteenDays(getValue(unusedFourteenDays))
                      .withThirtyDays(getValue(unusedThirtyDays))
                      .withSixtyDays(getValue(unusedSixtyDays)))
              .withFrequentlyUsedDataAssets(
                  new DataAssetValues()
                      .withThreeDays(getValue(frequentlyUsedThreeDays))
                      .withSevenDays(getValue(frequentlyUsedSevenDays))
                      .withFourteenDays(getValue(frequentlyUsedFourteenDays))
                      .withThirtyDays(getValue(frequentlyUsedThirtyDays))
                      .withSixtyDays(getValue(frequentlyUsedSixtyDays))));
    }
    return data;
  }

  protected abstract H getHistogramBucket(A aggregations);

  protected abstract List<? extends B> getBuckets(H histogramBucket);

  protected abstract String getKeyAsString(B bucket);

  protected abstract S getAggregations(B bucket, String key);

  protected abstract Double getValue(S aggregations);
}
