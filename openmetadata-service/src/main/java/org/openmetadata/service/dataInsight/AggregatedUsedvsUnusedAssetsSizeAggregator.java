package org.openmetadata.service.dataInsight;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.openmetadata.schema.dataInsight.type.AggregatedUsedVsUnusedAssetsSize;

public abstract class AggregatedUsedvsUnusedAssetsSizeAggregator<A, H, B, S> implements DataInsightAggregatorInterface {
  private final A aggregations;

  public AggregatedUsedvsUnusedAssetsSizeAggregator(A aggregations) {
    this.aggregations = aggregations;
  }

  @Override
  public List<Object> aggregate() throws ParseException {
    H histogramBucket = getHistogramBucket(this.aggregations);
    List<Object> data = new ArrayList<>();
    for (B bucket : getBuckets(histogramBucket)) {
      String dateTimeString = getKeyAsString(bucket);
      Long timestamp = convertDatTimeStringToTimestamp(dateTimeString);
      S totalUnused = getAggregations(bucket, "totalUnused");
      S totalUsed = getAggregations(bucket, "totalUsed");
      Double used = Objects.requireNonNullElse(getValue(totalUsed), 0.0);
      Double unused = Objects.requireNonNullElse(getValue(totalUnused), 0.0);
      Double total = used + unused;
      Double usedPercentage = 0.0;
      Double unusedPercentage = 0.0;
      if(total != 0){
        usedPercentage = used / total;
        unusedPercentage = unused / total;
      }
      data.add(
          new AggregatedUsedVsUnusedAssetsSize()
              .withTimestamp(timestamp)
              .withUnused(unused)
              .withUnusedPercentage(unusedPercentage)
              .withUsed(used)
              .withUsedPercentage(usedPercentage));
    }
    return data;
  }

  protected abstract H getHistogramBucket(A aggregations);

  protected abstract List<? extends B> getBuckets(H histogramBucket);

  protected abstract String getKeyAsString(B bucket);

  protected abstract S getAggregations(B bucket, String key);

  protected abstract Double getValue(S aggregations);
}
