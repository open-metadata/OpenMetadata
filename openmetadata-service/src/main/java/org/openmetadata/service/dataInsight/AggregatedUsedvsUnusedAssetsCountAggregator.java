package org.openmetadata.service.dataInsight;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.openmetadata.schema.dataInsight.type.AggregatedUsedVsUnusedAssetsCount;

public abstract class AggregatedUsedvsUnusedAssetsCountAggregator<A, H, B, S>
    implements DataInsightAggregatorInterface {
  private final A aggregations;

  protected AggregatedUsedvsUnusedAssetsCountAggregator(A aggregations) {
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
      Optional<Double> used = getValue(totalUsed);
      Optional<Double> unused = getValue(totalUnused);
      Optional<Double> total = used.flatMap(u -> unused.map(uu -> u + uu));
      Double usedPercentage = used.flatMap(u -> total.map(t -> u / t)).orElse(null);
      Double unusedPercentage = unused.flatMap(uu -> total.map(t -> uu / t)).orElse(null);
      data.add(
          new AggregatedUsedVsUnusedAssetsCount()
              .withTimestamp(timestamp)
              .withUnused(unused.orElse(null))
              .withUnusedPercentage(unusedPercentage)
              .withUsed(used.orElse(null))
              .withUsedPercentage(usedPercentage));
    }
    return data;
  }

  protected abstract H getHistogramBucket(A aggregations);

  protected abstract List<? extends B> getBuckets(H histogramBucket);

  protected abstract String getKeyAsString(B bucket);

  protected abstract S getAggregations(B bucket, String key);

  protected abstract Optional<Double> getValue(S aggregations);
}
